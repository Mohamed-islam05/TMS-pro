-- CreateTable
CREATE TABLE "Entreprise" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "ice" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntrepriseConfig" (
    "id" TEXT NOT NULL,
    "logoUrl" TEXT,
    "footerText" TEXT,
    "templateId" TEXT NOT NULL DEFAULT 'classic',
    "entrepriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntrepriseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "specialite" TEXT,
    "entrepriseId" TEXT NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordChangedAt" TIMESTAMP(3),
    "roleChangedAt" TIMESTAMP(3),
    "permissionsChangedAt" TIMESTAMP(3),

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "ice" TEXT,
    "clientReference" TEXT,
    "entrepriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chauffeur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INTERNE',
    "camionExterne" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "entrepriseId" TEXT NOT NULL,
    "camionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chauffeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camion" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '1',
    "marque" TEXT,
    "annee" INTEGER,
    "assuranceCirculation" TIMESTAMP(3),
    "dateVisiteTechnique" TIMESTAMP(3),
    "dateAssuranceMarchandise" TIMESTAMP(3),
    "entrepriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "dateOperation" TIMESTAMP(3),
    "lieuDepart" TEXT NOT NULL,
    "lieuArrivee" TEXT NOT NULL,
    "prixVente" DOUBLE PRECISION NOT NULL,
    "prixAchat" DOUBLE PRECISION,
    "tvaRate" INTEGER NOT NULL DEFAULT 20,
    "typeVehicule" TEXT,
    "clientId" TEXT NOT NULL,
    "camionId" TEXT,
    "camionExterne" TEXT,
    "chauffeurId" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "commentaire" TEXT,
    "categorie" TEXT NOT NULL DEFAULT 'DOSSIER',
    "submissionKey" TEXT,
    "dossierId" TEXT,
    "entrepriseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facture" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "montantTotal" DOUBLE PRECISION NOT NULL,
    "tva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantHT" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dossierId" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "dateFacture" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntrepriseConfig_entrepriseId_key" ON "EntrepriseConfig"("entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_entrepriseId_key" ON "Utilisateur"("email", "entrepriseId");

-- CreateIndex
CREATE INDEX "UserPermission_entrepriseId_idx" ON "UserPermission"("entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON "UserPermission"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Chauffeur_camionId_key" ON "Chauffeur"("camionId");

-- CreateIndex
CREATE UNIQUE INDEX "Chauffeur_cin_entrepriseId_key" ON "Chauffeur"("cin", "entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "Camion_matricule_entrepriseId_key" ON "Camion"("matricule", "entrepriseId");

-- CreateIndex
CREATE INDEX "Dossier_chauffeurId_idx" ON "Dossier"("chauffeurId");

-- CreateIndex
CREATE INDEX "Dossier_camionId_idx" ON "Dossier"("camionId");

-- CreateIndex
CREATE INDEX "Dossier_statut_idx" ON "Dossier"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_reference_entrepriseId_key" ON "Dossier"("reference", "entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_submissionKey_key" ON "Charge"("submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_dossierId_key" ON "Facture"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "Facture_reference_entrepriseId_key" ON "Facture"("reference", "entrepriseId");

-- CreateIndex
CREATE INDEX "AuditLog_entrepriseId_createdAt_idx" ON "AuditLog"("entrepriseId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_targetId_idx" ON "AuditLog"("module", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "EntrepriseConfig" ADD CONSTRAINT "EntrepriseConfig_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chauffeur" ADD CONSTRAINT "Chauffeur_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chauffeur" ADD CONSTRAINT "Chauffeur_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camion" ADD CONSTRAINT "Camion_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_camionId_fkey" FOREIGN KEY ("camionId") REFERENCES "Camion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_chauffeurId_fkey" FOREIGN KEY ("chauffeurId") REFERENCES "Chauffeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facture" ADD CONSTRAINT "Facture_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

