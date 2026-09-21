// ============================================================
// Access Denied - Uniform unauthorized state for dashboard pages
// ============================================================
"use client";

import { Ban } from "lucide-react";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Ban className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Accès non autorisé</h1>
      <p className="mt-2 text-muted-foreground">
        {message ?? "Vous n'avez pas la permission d'accéder à cette page."}
      </p>
    </div>
  );
}