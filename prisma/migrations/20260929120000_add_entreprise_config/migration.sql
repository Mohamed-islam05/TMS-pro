-- CreateTable
CREATE TABLE "EntrepriseConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logoUrl" TEXT,
    "footerText" TEXT,
    "templateId" TEXT NOT NULL DEFAULT 'classic',
    "entrepriseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntrepriseConfig_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EntrepriseConfig_entrepriseId_key" ON "EntrepriseConfig"("entrepriseId");