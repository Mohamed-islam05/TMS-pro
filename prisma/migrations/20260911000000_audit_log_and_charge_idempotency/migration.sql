-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entrepriseId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuditLog_entrepriseId_createdAt_idx" ON "AuditLog"("entrepriseId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_module_targetId_idx" ON "AuditLog"("module", "targetId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AlterTable
ALTER TABLE "Charge" ADD COLUMN "submissionKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Charge_submissionKey_key" ON "Charge"("submissionKey");