// ============================================================
// NextAuth.js v4 Configuration - TMS Pro
// ============================================================
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  isRateLimitConfigured,
  checkIpRateLimit,
  checkIdentityRateLimit,
  recordFailedIdentityAttempt,
} from "@/lib/rate-limit";
import { isSessionInvalidated } from "@/lib/session-invalidation";

const GENERIC_LOGIN_ERROR = "Email ou mot de passe incorrect";

// Fixed bcrypt hash of an arbitrary value. Used to perform a dummy compare
// when no user exists so response timing stays indistinguishable from a
// wrong-password attempt (prevents account enumeration via timing).
const DUMMY_PASSWORD_HASH =
  "$2b$12$n8m6fH7htZPowYgsO5ZTlOq2msKOLIBR0NoGlHnrCE.DTEeypMnkC";

async function dummyPasswordCompare(password?: string): Promise<void> {
  await bcrypt.compare(password ?? "", DUMMY_PASSWORD_HASH);
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      nom: string | null;
      role: string;
      entrepriseId: string;
      permissions: string[];
    };
  }

  interface User {
    id: string;
    email: string;
    nom: string | null;
    role: string;
    entrepriseId: string;
    permissions?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    nom: string | null;
    role: string;
    entrepriseId: string;
    permissions?: string[];
    passwordChangedAt?: number | null;
    roleChangedAt?: number | null;
    permissionsChangedAt?: number | null;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        ice: { label: "Code ICE", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, req) {
        const forwardedFor = req?.headers?.["x-forwarded-for"];
        const realIp = req?.headers?.["x-real-ip"];
        const ip = typeof forwardedFor === "string"
          ? forwardedFor.split(",")[0].trim()
          : typeof realIp === "string"
            ? realIp
            : "127.0.0.1";

        if (isRateLimitConfigured()) {
          const ipResult = await checkIpRateLimit(ip);
          if (!ipResult.success) {
            throw new Error(GENERIC_LOGIN_ERROR);
          }

          if (credentials?.email && credentials?.ice) {
            const identityKey = `${credentials.email.toLowerCase()}:${credentials.ice}`;
            const identityResult = await checkIdentityRateLimit(identityKey);
            if (!identityResult.success) {
              throw new Error(GENERIC_LOGIN_ERROR);
            }
          }
        }

        if (!credentials?.ice || !credentials?.email || !credentials?.password) {
          await dummyPasswordCompare(credentials?.password);
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        const entreprise = await prisma.entreprise.findFirst({
          where: { ice: credentials.ice },
        });

        if (!entreprise) {
          if (isRateLimitConfigured()) {
            const failedKey = `${credentials.email.toLowerCase()}:${credentials.ice}`;
            await recordFailedIdentityAttempt(failedKey);
          }
          await dummyPasswordCompare(credentials.password);
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        const user = await prisma.utilisateur.findFirst({
          where: {
            email: credentials.email,
            entrepriseId: entreprise.id,
          },
        });

        if (!user || !user.password) {
          if (isRateLimitConfigured()) {
            const failedKey = `${credentials.email.toLowerCase()}:${credentials.ice}`;
            await recordFailedIdentityAttempt(failedKey);
          }
          await dummyPasswordCompare(credentials.password);
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          if (isRateLimitConfigured()) {
            const failedKey = `${credentials.email.toLowerCase()}:${credentials.ice}`;
            await recordFailedIdentityAttempt(failedKey);
          }
          throw new Error(GENERIC_LOGIN_ERROR);
        }

        return {
          id: user.id,
          email: user.email,
          nom: user.nom,
          role: user.role,
          entrepriseId: user.entrepriseId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.nom = user.nom;
        token.role = user.role;
        token.entrepriseId = user.entrepriseId;
      }

      if (token.id && token.iat) {
        const iat = token.iat as number;
        const dbUser = await prisma.utilisateur.findUnique({
          where: { id: token.id },
          select: {
            passwordChangedAt: true,
            roleChangedAt: true,
            permissionsChangedAt: true,
            permissions: { select: { permission: true } },
          },
        });
        if (dbUser) {
          token.permissions = dbUser.permissions.map((p) => p.permission);
        }
        if (isSessionInvalidated(dbUser?.passwordChangedAt, iat)) {
          throw new Error("Session invalidated by password change");
        }
        if (isSessionInvalidated(dbUser?.roleChangedAt, iat)) {
          throw new Error("Session invalidated by role change");
        }
        if (isSessionInvalidated(dbUser?.permissionsChangedAt, iat)) {
          throw new Error("Session invalidated by permission change");
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        email: token.email,
        nom: token.nom,
        role: token.role,
        entrepriseId: token.entrepriseId,
        permissions: token.permissions ?? [],
      };
      return session;
    },
  },
};
