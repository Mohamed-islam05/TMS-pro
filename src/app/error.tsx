"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-xl font-bold">Une erreur est survenue</h1>
          <p className="text-sm text-muted-foreground">
            Un problème inattendu s&apos;est produit. Vous pouvez réessayer ou revenir à l&apos;accueil.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Référence d&apos;erreur : {error.digest}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Réessayer
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" /> Retour à l&apos;accueil
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}