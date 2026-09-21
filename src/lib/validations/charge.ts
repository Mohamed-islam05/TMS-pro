// ============================================================
// Zod Validation Schemas - Charge Entity
// ============================================================
import { z } from "zod";
import { emptyToUndefined } from "./helpers";

export const createChargeSchema = z.discriminatedUnion("categorie", [
  z.object({
    categorie: z.literal("DOSSIER"),
    dossierId: z.string().uuid("Dossier invalide"),
    type: z.enum(
      [
        "CARBURANT",
        "PEAGE",
        "DEPLACEMENT_CHAUFFEUR",
        "REPARATION",
        "AMENDE",
        "GARDIENNAGE",
        "KEROSENE",
        "TELEPHONE",
        "AUTRE",
      ],
      { errorMap: () => ({ message: "Type de charge invalide" }) }
    ),
    montant: z
      .preprocess(
        (v) => emptyToUndefined(v),
        z
          .coerce.number({ errorMap: () => ({ message: "Le montant est obligatoire" }) })
          .finite("Le montant doit être un nombre valide")
          .positive("Le montant doit être positif")
      ),
    commentaire: z.string().max(500).optional().or(z.literal("")),
    submissionKey: z.string().uuid("Clé de soumission invalide").optional(),
  }),
  z.object({
    categorie: z.literal("GENERALE"),
    dossierId: z.undefined().optional(),
    type: z.string().min(1, "Le type de charge est requis"),
    montant: z
      .preprocess(
        (v) => emptyToUndefined(v),
        z
          .coerce.number({ errorMap: () => ({ message: "Le montant est obligatoire" }) })
          .finite("Le montant doit être un nombre valide")
          .positive("Le montant doit être positif")
      ),
    commentaire: z.string().max(500).optional().or(z.literal("")),
    submissionKey: z.string().uuid("Clé de soumission invalide").optional(),
  }),
]);

export const updateChargeSchema = z.object({
  id: z.string().uuid("ID invalide"),
  categorie: z.enum(["DOSSIER", "GENERALE"]).optional(),
  dossierId: z.string().uuid("Dossier invalide").optional().nullable(),
  type: z.string().min(1, "Le type de charge est requis").optional(),
  montant: z
    .preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .coerce.number({ errorMap: () => ({ message: "Le montant est obligatoire" }) })
        .finite("Le montant doit être un nombre valide")
        .positive("Le montant doit être positif")
    )
    .optional(),
  commentaire: z.string().max(500).optional().or(z.literal("")),
});

export const deleteChargeSchema = z.object({
  id: z.string().uuid("ID invalide"),
});

export type CreateChargeInput = z.infer<typeof createChargeSchema>;
export type UpdateChargeInput = z.infer<typeof updateChargeSchema>;
export type DeleteChargeInput = z.infer<typeof deleteChargeSchema>;
