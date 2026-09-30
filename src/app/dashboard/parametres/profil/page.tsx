"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/password";
import { changePassword } from "@/lib/actions/auth";

export default function ProfilPage() {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(data: ChangePasswordInput) {
    setIsSubmitting(true);
    try {
      const result = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (result.success) {
        toast.success(result.message);
        reset();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Erreur lors du changement de mot de passe");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        description="Gérez vos informations personnelles"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Informations du compte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nom</p>
              <p className="text-sm">{session?.user?.nom || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{session?.user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rôle</p>
              <p className="text-sm">
                {session?.user?.role === "ENTREPRISE_ADMIN" ? "Administrateur" : "Staff"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Changer le mot de passe
            </CardTitle>
            <CardDescription>
              Modifiez votre mot de passe de connexion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <input
                    {...register("currentPassword")}
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.currentPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    {...register("newPassword")}
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    {...register("confirmPassword")}
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Modification en cours...
                  </>
                ) : (
                  "Modifier le mot de passe"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
