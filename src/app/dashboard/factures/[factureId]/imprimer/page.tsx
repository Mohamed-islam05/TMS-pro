// ============================================================
// Imprimer Facture Page - TMS Pro
// ============================================================
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePermissionCheck } from "@/lib/client-permissions";
import { ArrowLeft, FileX2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { AccessDenied } from "@/components/access-denied";
import { getFactureById } from "@/lib/actions/factures";
import FacturePrintView from "@/components/facture-print-view";

type FactureData = Awaited<ReturnType<typeof getFactureById>>["data"];

export default function ImprimerFacturePage() {
  const { factureId } = useParams<{ factureId: string }>();
  const { can, status } = usePermissionCheck();
  const canPrint = can("factures.print");
  const [facture, setFacture] = useState<FactureData>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!canPrint) {
      setLoading(false);
      return;
    }
    getFactureById(factureId)
      .then((res) => { if (res.success) setFacture(res.data); })
      .finally(() => setLoading(false));
  }, [factureId, canPrint, status]);

  if (status === "loading" || loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Imprimer la facture" description="Aperçu avant impression" />
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement de la facture...
        </div>
      </div>
    );
  }

  if (!canPrint) {
    return (
      <AccessDenied message="Vous n'avez pas la permission d'imprimer les factures." />
    );
  }

  if (!facture) {
    return (
      <div className="space-y-4">
        <PageHeader title="Imprimer la facture" description="Aperçu avant impression" />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileX2}
              title="Facture non trouvée"
              description="La facture demandée n'existe pas ou a été supprimée."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader className="no-print" title={`Facture ${facture.reference}`} description="Aperçu avant impression">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/factures">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux factures
          </Link>
        </Button>
      </PageHeader>
      <FacturePrintView facture={facture as any} />
    </div>
  );
}
