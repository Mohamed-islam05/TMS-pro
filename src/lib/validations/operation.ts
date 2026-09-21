// ============================================================
// Zod Validation Schemas - Dossier (Operation) Entity
// ============================================================
import { z } from "zod";
import { emptyToUndefined } from "./helpers";

export const createDossierSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(2, "La référence doit contenir au moins 2 caractères")
    .max(50, "La référence ne doit pas dépasser 50 caractères"),
  clientId: z.string().uuid("Client invalide"),
  chauffeurId: z.string().uuid("Chauffeur invalide"),
  camionId: z.string().uuid("Camion invalide").optional().or(z.literal("")),
  camionExterne: z.string().max(100).optional().or(z.literal("")),
  lieuDepart: z
    .string()
    .min(2, "Le lieu de départ doit contenir au moins 2 caractères")
    .max(100, "Le lieu de départ ne doit pas dépasser 100 caractères"),
  lieuArrivee: z
    .string()
    .min(2, "Le lieu d'arrivée doit contenir au moins 2 caractères")
    .max(100, "Le lieu d'arrivée ne doit pas dépasser 100 caractères"),
  prixVente: z
    .preprocess(
      emptyToUndefined,
      z
        .coerce.number({ errorMap: () => ({ message: "Le prix de vente est obligatoire" }) })
        .min(0, "Le prix de vente ne peut pas être négatif")
    ),
  prixAchat: z
    .preprocess(
      emptyToUndefined,
      z
        .coerce.number({ errorMap: () => ({ message: "Le prix d'achat doit être un nombre" }) })
        .min(0, "Le prix d'achat ne peut pas être négatif")
    )
    .optional(),
  tvaRate: z.coerce.number().refine((v) => [0, 10, 20].includes(v), "La TVA doit être 0%, 10% ou 20%").default(20),
  typeVehicule: z.enum(["1", "2", "3", "4", "5", "6", "7"]).optional().or(z.literal("")),
  dateOperation: z.coerce.date({ errorMap: () => ({ message: "La date d'opération est obligatoire" }) }),
  statut: z.enum(["OUVERT", "EN_ATTENTE_VALIDATION", "CLOTURE"]).default("OUVERT"),
});

export const updateDossierSchema = createDossierSchema.extend({
  id: z.string().uuid("ID invalide"),
});

export const deleteDossierSchema = z.object({
  id: z.string().uuid("ID invalide"),
});

export type CreateDossierInput = z.infer<typeof createDossierSchema>;
export type UpdateDossierInput = z.infer<typeof updateDossierSchema>;
export type DeleteDossierInput = z.infer<typeof deleteDossierSchema>;
