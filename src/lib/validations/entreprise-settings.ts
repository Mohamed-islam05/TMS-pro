// ============================================================
// Entreprise Settings Validation Schemas
// ============================================================
import { z } from "zod";

export const INVOICE_TEMPLATES = ["classic", "modern", "compact"] as const;
export type InvoiceTemplate = (typeof INVOICE_TEMPLATES)[number];

export const invoiceTemplateLabels: Record<InvoiceTemplate, string> = {
  classic: "Classique",
  modern: "Moderne",
  compact: "Compact",
};

export const invoiceTemplateDescriptions: Record<InvoiceTemplate, string> = {
  classic: "En-tête classique avec tableau et totaux standards",
  modern: "En-tête coloré avec accents bleus",
  compact: "Mise en page compacte et allégée",
};

const LOGO_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export function isLogoDataUrl(value: string): boolean {
  return value === "" || LOGO_DATA_URL_PATTERN.test(value);
}

export const updateEntrepriseSettingsSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom de l'entreprise est requis")
    .max(120, "Le nom ne doit pas dépasser 120 caractères"),
  adresse: z.string().trim().max(200, "L'adresse ne doit pas dépasser 200 caractères"),
  telephone: z.string().trim().max(30, "Le téléphone ne doit pas dépasser 30 caractères"),
  email: z.union([
    z.literal(""),
    z.string().trim().email("Email invalide").max(255, "L'email ne doit pas dépasser 255 caractères"),
  ]),
  ice: z.string().trim().max(64, "Le code ICE ne doit pas dépasser 64 caractères"),
  logoUrl: z
    .string()
    .max(500_000, "Le logo est trop volumineux (500 Ko maximum)")
    .refine(isLogoDataUrl, { message: "Format de logo invalide (PNG, JPG, WEBP ou SVG requis)" }),
  footerText: z.string().trim().max(200, "Le texte de pied ne doit pas dépasser 200 caractères"),
  templateId: z.enum(INVOICE_TEMPLATES, {
    errorMap: () => ({ message: "Template de facture invalide" }),
  }),
});

export type UpdateEntrepriseSettingsInput = z.infer<typeof updateEntrepriseSettingsSchema>;