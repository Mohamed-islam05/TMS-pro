// ============================================================
// Prisma Seed Script - TMS Pro
// ============================================================
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { roundMoney, calculerTVA, calculerMontantTTC } from "../src/lib/calculations";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("ERROR: Seed script must not be run in production.");
    process.exit(1);
  }

  console.log("Seeding TMS Pro database...");

  const entreprise = await prisma.entreprise.create({
    data: {
      nom: "TMS Transport Pro",
      adresse: "123 Avenue Mohammed V, Casablanca",
      telephone: "+212 5 22 00 00 00",
      email: "contact@tmspro.ma",
      ice: "001234567000001",
    },
  });

  const hashedPassword = await bcrypt.hash("admin123", 12);

  await prisma.utilisateur.create({
    data: {
      id: "admin-user",
      nom: "Admin TMS",
      email: "admin@tms.com",
      password: hashedPassword,
      role: "ENTREPRISE_ADMIN",
      entrepriseId: entreprise.id,
    },
  });

  const entreprise2 = await prisma.entreprise.create({
    data: {
      nom: "Transport Express SARL",
      adresse: "456 Bd Zerktouni, Marrakech",
      telephone: "+212 5 24 00 00 00",
      email: "contact@trasportexpress.ma",
      ice: "002345678000002",
    },
  });

  await prisma.utilisateur.create({
    data: {
      id: "admin-user-2",
      nom: "Admin Transport Express",
      email: "admin@tms.com",
      password: hashedPassword,
      role: "ENTREPRISE_ADMIN",
      entrepriseId: entreprise2.id,
    },
  });

  const clients = await Promise.all([
    prisma.client.create({
      data: { nom: "Atlas Logistics", telephone: "+212 6 11 22 33 44", adresse: "Zone Industrielle, Rabat", entrepriseId: entreprise.id },
    }),
    prisma.client.create({
      data: { nom: "Sahara Transport", telephone: "+212 6 55 66 77 88", adresse: "Bd Zerktouni, Marrakech", entrepriseId: entreprise.id },
    }),
    prisma.client.create({
      data: { nom: "Med Port Distribution", telephone: "+212 6 99 88 77 66", adresse: "Port Tanger Med, Tanger", entrepriseId: entreprise.id },
    }),
    prisma.client.create({
      data: { nom: "Agri Export SA", telephone: "+212 5 33 44 55 66", adresse: "Agadir Centre, Agadir", entrepriseId: entreprise.id },
    }),
    prisma.client.create({
      data: { nom: "BuildMat Maroc", telephone: "+212 6 22 33 44 55", adresse: "Casa Nearshore, Casablanca", entrepriseId: entreprise.id },
    }),
  ]);

  const camions = await Promise.all([
    prisma.camion.create({
      data: { matricule: "A-1234-BB", type: "1", marque: "Mercedes", annee: 2020, dateVisiteTechnique: new Date("2026-08-15"), dateAssuranceMarchandise: new Date("2026-07-28"), entrepriseId: entreprise.id },
    }),
    prisma.camion.create({
      data: { matricule: "C-5678-DD", type: "2", marque: "Volvo", annee: 2021, dateVisiteTechnique: new Date("2026-09-20"), dateAssuranceMarchandise: new Date("2026-12-01"), entrepriseId: entreprise.id },
    }),
    prisma.camion.create({
      data: { matricule: "E-9012-FF", type: "3", marque: "Scania", annee: 2019, dateVisiteTechnique: new Date("2026-07-20"), dateAssuranceMarchandise: new Date("2026-08-05"), entrepriseId: entreprise.id },
    }),
    prisma.camion.create({
      data: { matricule: "G-3456-HH", type: "1", marque: "Renault", annee: 2022, dateVisiteTechnique: new Date("2027-01-15"), dateAssuranceMarchandise: new Date("2027-03-01"), entrepriseId: entreprise.id },
    }),
  ]);

  const chauffeurs = await Promise.all([
    prisma.chauffeur.create({
      data: { nom: "Mohammed Ali", telephone: "+212 6 10 20 30 40", cin: "BK 123456", type: "INTERNE", actif: true, camionId: camions[0].id, entrepriseId: entreprise.id },
    }),
    prisma.chauffeur.create({
      data: { nom: "Youssef Benani", telephone: "+212 6 20 30 40 50", cin: "BK 234567", type: "INTERNE", actif: true, camionId: camions[1].id, entrepriseId: entreprise.id },
    }),
    prisma.chauffeur.create({
      data: { nom: "Hassan Tazi", telephone: "+212 6 30 40 50 60", cin: "BK 345678", type: "EXTERNE", camionExterne: "Volvo FH16 - Mat 22345-B", actif: true, entrepriseId: entreprise.id },
    }),
    prisma.chauffeur.create({
      data: { nom: "Omar Fassi", telephone: "+212 6 40 50 60 70", cin: "BK 456789", type: "EXTERNE", camionExterne: "Mercedes Actros - Mat 33456-C", actif: false, entrepriseId: entreprise.id },
    }),
  ]);

  const operations = [];
  const routes = [
    ["Casablanca", "Marrakech"], ["Rabat", "Tanger"], ["Agadir", "Casablanca"],
    ["Marrakech", "Fes"], ["Tanger", "Casablanca"], ["Fes", "Agadir"],
    ["Casablanca", "Oujda"], ["Meknes", "Casablanca"], ["Agadir", "Marrakech"],
    ["Tanger", "Rabat"], ["Casablanca", "Tanger"], ["Marrakech", "Agadir"],
    ["Fes", "Tanger"], ["Rabat", "Casablanca"], ["Oujda", "Casablanca"],
    ["Tanger", "Fes"], ["Agadir", "Rabat"], ["Casablanca", "Fes"],
    ["Marrakech", "Rabat"], ["Tanger", "Agadir"],
  ];

  for (let i = 0; i < 20; i++) {
    const route = routes[i];
    const chauffeur = chauffeurs[i % 3];
    const camion = chauffeur.camionId ? camions.find((c) => c.id === chauffeur.camionId) : camions[i % camions.length];
    const client = clients[i % clients.length];
    const prixVente = 15000 + Math.floor(Math.random() * 35000);
    const prixAchat = prixVente - 3000 - Math.floor(Math.random() * 8000);
    const date = new Date();
    date.setDate(date.getDate() - (30 - i));

    const op = await prisma.dossier.create({
      data: {
        reference: `OP-${String(2026).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        statut: i < 15 ? "CLOTURE" : i < 17 ? "EN_ATTENTE_VALIDATION" : "OUVERT",
        lieuDepart: route[0], lieuArrivee: route[1],
        prixVente, prixAchat,
        clientId: client.id, camionId: camion!.id, chauffeurId: chauffeur.id,
        entrepriseId: entreprise.id,
      },
    });
    operations.push(op);
  }

  const chargeTypes = ["CARBURANT", "PEAGE", "REPARATION", "DEPLACEMENT_CHAUFFEUR", "AUTRE"];
  for (const op of operations) {
    const numCharges = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numCharges; j++) {
      await prisma.charge.create({
        data: {
          type: chargeTypes[j % chargeTypes.length],
          montant: 200 + Math.floor(Math.random() * 3000),
          commentaire: j === 0 ? "Carburant aller-retour" : j === 1 ? "Péage autoroute" : null,
          dossierId: op.id,
        },
      });
    }
  }

  for (const op of operations) {
    if (op.statut === "CLOTURE") {
      const dossier = await prisma.dossier.findUnique({ where: { id: op.id }, include: { charges: true } });
      if (dossier) {
        const montantHT = roundMoney(dossier.prixVente);
        const tva = calculerTVA(montantHT, 20);
        const montantTotal = calculerMontantTTC(montantHT, 20);
        await prisma.facture.create({
          data: { reference: `FAC-${op.reference}`, montantTotal, tva, montantHT, dossierId: op.id, entrepriseId: entreprise.id },
        });
      }
    }
  }

  console.log("Seed completed!");
  console.log(`  - 1 Entreprise, 1 Utilisateur`);
  console.log(`  - ${clients.length} Clients, ${camions.length} Camions, ${chauffeurs.length} Chauffeurs`);
  console.log(`  - ${operations.length} Dossiers with Charges & Factures`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
