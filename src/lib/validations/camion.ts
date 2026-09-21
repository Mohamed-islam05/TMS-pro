// ============================================================
// Zod Validation Schemas - Camion (Vehicle) Entity
// ============================================================
import { z } from "zod";
import { emptyToUndefined } from "./helpers";

export const createCamionSchema = z.object({
  matricule: z
    .string()
    .min(6, "Le matricule doit contenir au moins 6 caractères")
    .max(15, "Le matricule ne doit pas dépasser 15 caractères"),
  type: z.enum(["1", "2", "3", "4", "5", "6", "7"], {
    errorMap: () => ({ message: "Type de camion invalide" }),
  }),
  marque: z.string().max(50).optional().or(z.literal("")),
  annee: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: "L'année doit être un nombre" })
      .int("L'année doit être un nombre entier")
      .min(1990, "L'année ne peut pas être antérieure à 1990")
      .max(new Date().getFullYear() + 1, "L'année ne peut pas être dans le futur")
      .optional()
  ),
  assuranceCirculation: z.coerce.date().optional(),
  dateVisiteTechnique: z.coerce.date().optional(),
  dateAssuranceMarchandise: z.coerce.date().optional(),
});

export const updateCamionSchema = createCamionSchema.extend({
  id: z.string().uuid("ID invalide"),
});

export const deleteCamionSchema = z.object({
  id: z.string().uuid("ID invalide"),
});

export type CreateCamionInput = z.infer<typeof createCamionSchema>;
export type UpdateCamionInput = z.infer<typeof updateCamionSchema>;
export type DeleteCamionInput = z.infer<typeof deleteCamionSchema>;
