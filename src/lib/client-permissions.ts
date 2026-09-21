// ============================================================
// Client-side permission helper (session snapshot)
// ============================================================
"use client";

import { useSession } from "next-auth/react";

export function usePermissionCheck() {
  const { data, status } = useSession();
  const id = data?.user?.id ?? "";
  const isAdmin = data?.user?.role === "ENTREPRISE_ADMIN";
  const permissions = data?.user?.permissions ?? [];
  const can = (permission: string) => isAdmin || permissions.includes(permission);
  return { id, isAdmin, permissions, can, status };
}