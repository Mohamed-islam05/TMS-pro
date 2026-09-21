// ============================================================
// Zod Validation Schemas - Client Entity
// ============================================================
import { z } from "zod";

export const createClientSchema = z.object({
  nom: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  telephone: z.string().max(15).optional().or(z.literal("")),
  adresse: z.string().max(200).optional().or(z.literal("")),
  ice: z.string().max(20).optional().or(z.literal("")),
  clientReference: z.string().max(50).optional().or(z.literal("")),
});

export const updateClientSchema = createClientSchema.extend({
  id: z.string().uuid("ID invalide"),
});

export const deleteClientSchema = z.object({
  id: z.string().uuid("ID invalide"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type DeleteClientInput = z.infer<typeof deleteClientSchema>;
