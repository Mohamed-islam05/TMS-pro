// ============================================================
// Email Service - Resend Integration
// ============================================================
import "server-only";
import { Resend } from "resend";
import { safeLogError } from "@/lib/utils";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const appUrl = process.env.APP_URL || "http://localhost:3000";

const resend = apiKey ? new Resend(apiKey) : null;

export function isEmailConfigured(): boolean {
  return Boolean(resend && from);
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend || !from) {
    console.error("Email not configured: RESEND_API_KEY or EMAIL_FROM missing");
    return { success: false, error: "Email service not configured" };
  }

  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    await resend.emails.send({
      from,
      to,
      subject: "Réinitialisation de votre mot de passe - TMS Pro",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">Réinitialisation de mot de passe</h2>
          <p style="color: #475569; line-height: 1.6;">
            Vous avez demandé la réinitialisation de votre mot de passe sur TMS Pro.
          </p>
          <p style="color: #475569; line-height: 1.6;">
            Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">
            Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
          </p>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", safeLogError(error));
    return { success: false, error: "Erreur lors de l'envoi de l'email" };
  }
}
