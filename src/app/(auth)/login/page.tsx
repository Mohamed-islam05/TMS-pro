"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Truck, Loader2, Eye, EyeOff, MapPin, ShieldCheck, Clock } from "lucide-react";
import { TruckAnimation } from "@/components/truck-animation";

const loginSchema = z.object({
  ice: z.string().min(1, "Code ICE requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginInput = z.infer<typeof loginSchema>;

const features = [
  { icon: MapPin, text: "Suivi des opérations et itinéraires en temps réel" },
  { icon: ShieldCheck, text: "Gestion sécurisée de vos clients et chauffeurs" },
  { icon: Clock, text: "Facturation automatique et pilotage de la rentabilité" },
];

function sanitizeCallbackUrl(raw: string | null): string {
  if (!raw) return "/dashboard";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    const path = url.pathname + url.search + url.hash;
    if (!path.startsWith("/")) return "/dashboard";
    return path;
  } catch {
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/dashboard";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setError(null);

    const result = await signIn("credentials", {
      ice: data.ice,
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou mot de passe incorrect");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  const inputClass =
    "flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ===== Left panel - Brand + Animation (desktop) ===== */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white lg:flex">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">TMS Pro</span>
              <p className="text-xs text-slate-400">Transport Management System</p>
            </div>
          </div>

          <h2 className="mt-12 max-w-md text-3xl font-bold leading-tight">
            Pilotez vos opérations de transport avec confiance
          </h2>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Gérez vos clients, chauffeurs, camions et factures depuis une seule plateforme.
          </p>
        </div>

        <div className="relative z-10">
          <TruckAnimation driving={focused} />
        </div>

        <div className="relative z-10 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.text} className="flex items-start gap-2 text-sm text-slate-300">
              <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <span className="text-xs">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Right panel - Form ===== */}
      <div className="flex items-center justify-center bg-muted/30 p-6 lg:bg-white lg:p-10">
        <div className="w-full max-w-md">
          {/* Mobile brand + compact animation */}
          <div className="mb-8 lg:hidden">
            <div className="mb-6 flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">TMS Pro</span>
            </div>
            <TruckAnimation driving={focused} />
          </div>

          <div className="rounded-2xl border bg-card p-8 shadow-xl">
            <div className="mb-8 text-center lg:text-left">
              <h1 className="text-2xl font-bold tracking-tight">Connexion</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Accédez à votre tableau de bord
              </p>
            </div>

            {error && (
              <div className="animate-fade-up mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  !
                </span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="ice" className="mb-1.5 block text-sm font-medium">
                  Code ICE
                </label>
                <input
                  {...register("ice")}
                  id="ice"
                  type="text"
                  placeholder="001234567000001"
                  autoComplete="organization"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className={inputClass}
                />
                {errors.ice && (
                  <p className="mt-1 text-xs text-red-600">{errors.ice.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <input
                  {...register("email")}
                  id="email"
                  type="email"
                  placeholder="admin@tms.com"
                  autoComplete="email"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className={inputClass}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </button>

              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </a>
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} TMS Pro — Plateforme de gestion de transport
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
