// ============================================================
// Audit Trail - durable write-only log
// ============================================================
import "server-only";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AuditModule =
  | "auth"
  | "users"
  | "dossiers"
  | "factures"
  | "charges"
  | "camions"
  | "chauffeurs"
  | "clients";

export interface AuditEntry {
  action: string;
  module: AuditModule;
  entrepriseId?: string | null;
  userId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
}

function buildData(entry: AuditEntry): Prisma.AuditLogCreateInput {
  return {
    action: entry.action,
    module: entry.module,
    entrepriseId: entry.entrepriseId ?? null,
    userId: entry.userId ?? null,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    details: entry.details ? JSON.stringify(entry.details) : null,
  };
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: buildData(entry) });
  } catch (error) {
    logger.error("Audit write failed", { module: entry.module, action: entry.action });
    if (error instanceof Error) logger.error(error.message);
  }
}

export async function logAuditTx(
  tx: Prisma.TransactionClient,
  entry: AuditEntry
): Promise<void> {
  try {
    await tx.auditLog.create({ data: buildData(entry) });
  } catch (error) {
    logger.error("Audit write failed (tx)", { module: entry.module, action: entry.action });
    if (error instanceof Error) logger.error(error.message);
  }
}