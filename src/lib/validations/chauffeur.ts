// ============================================================
// Zod Validation Schemas - Chauffeur Entity
// ============================================================
import { z } from "zod";

export const createChauffeurSchema = z.object({
  nom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  telephone: z
    .string()
    .min(10, "Le numéro de téléphone doit contenir au moins 10 chiffres")
    .max(15, "Le numéro de téléphone ne doit pas dépasser 15 chiffres"),
  cin: z
    .string()
    .min(4, "Le CIN doit contenir au moins 4 caractères")
    .max(20, "Le CIN ne doit pas dépasser 20 caractères"),
  type: z.enum(["INTERNE", "EXTERNE"]).default("INTERNE"),
  camionId: z.string().optional().or(z.literal("")),
  camionExterne: z.string().max(100).optional().or(z.literal("")),
  actif: z.boolean().default(true),
});

export const updateChauffeurSchema = createChauffeurSchema.extend({
  id: z.string().uuid("ID invalide"),
});

export const deleteChauffeurSchema = z.object({
  id: z.string().uuid("ID invalide"),
});

export type CreateChauffeurInput = z.infer<typeof createChauffeurSchema>;
export type UpdateChauffeurInput = z.infer<typeof updateChauffeurSchema>;
export type DeleteChauffeurInput = z.infer<typeof deleteChauffeurSchema>;
