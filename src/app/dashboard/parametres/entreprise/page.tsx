// ============================================================
// Entreprise Settings Page - TMS Pro
// Identity, logo and invoice branding, per-tenant (admin only).
// ============================================================
"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ImageIcon, Loader2, Trash2, Upload, Palette } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AccessDenied } from "@/components/access-denied";
import { usePermissionCheck } from "@/lib/client-permissions";
import { getEntrepriseSettings, updateEntrepriseSettings } from "@/lib/actions/settings";
import {
  updateEntrepriseSettingsSchema,
  INVOICE_TEMPLATES,
  invoiceTemplateLabels,
  invoiceTemplateDescriptions,
  type UpdateEntrepriseSettingsInput,
} from "@/lib/validations/entreprise-settings";

type SettingsData = NonNullable<
  Awaited<ReturnType<typeof getEntrepriseSettings>>["data"]
>;

const inputClass =
  "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const textareaClass =
  "flex min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const MAX_LOGO_BYTES = 500_000;

export default function EntrepriseSettingsPage() {
  const { isAdmin, status } = usePermissionCheck();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<UpdateEntrepriseSettingsInput>({
    resolver: zodResolver(updateEntrepriseSettingsSchema),
    defaultValues: {
      nom: "",
      adresse: "",
      telephone: "",
      email: "",
      ice: "",
      logoUrl: "",
      footerText: "",
      templateId: "classic",
    },
  });

  const templateId = watch("templateId");

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    getEntrepriseSettings()
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          setLogoPreview(d.config?.logoUrl || "");
          reset({
            nom: d.nom ?? "",
            adresse: d.adresse ?? "",
            telephone: d.telephone ?? "",
            email: d.email ?? "",
            ice: d.ice ?? "",
            logoUrl: d.config?.logoUrl || "",
            footerText: d.config?.footerText || "",
            templateId: (d.config?.templateId ?? "classic") as UpdateEntrepriseSettingsInput["templateId"],
          });
        }
      })
      .finally(() => setLoading(false));
  }, [isAdmin, status, reset]);

  function handleLogoFile(file: File | undefined) {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      toast.error("Format non supporté. Utilisez un fichier PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Le logo doit faire moins de 500 Ko.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setLogoPreview(dataUrl);
      setValue("logoUrl", dataUrl, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoPreview("");
    setValue("logoUrl", "", { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(data: UpdateEntrepriseSettingsInput) {
    setIsSubmitting(true);
    try {
      const res = await updateEntrepriseSettings(data);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement des paramètres");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paramètres entreprise" description="Identité, logo et personnalisation des factures" />
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paramètres entreprise" description="Identité, logo et personnalisation des factures" />
        <AccessDenied message="Vous n'avez pas l'autorisation d'accéder aux paramètres de l'entreprise." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres entreprise"
        description="Identité, logo et personnalisation des factures"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Identité de l'entreprise
            </CardTitle>
            <CardDescription>
              Ces informations apparaissent sur l'en-tête et le pied de vos factures.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="nom">Nom de l'entreprise</Label>
              <Input id="nom" placeholder="Ex : Transports & Logistique SARL" className="mt-1.5" {...register("nom")} />
              {errors.nom && <p className="mt-1 text-xs text-red-600">{errors.nom.message}</p>}
            </div>
            <div>
              <Label htmlFor="ice">ICE</Label>
              <Input id="ice" placeholder="Identifiant Commun de l'Entreprise" className="mt-1.5" {...register("ice")} />
              {errors.ice && <p className="mt-1 text-xs text-red-600">{errors.ice.message}</p>}
            </div>
            <div>
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" placeholder="Adresse complète" className="mt-1.5" {...register("adresse")} />
              {errors.adresse && <p className="mt-1 text-xs text-red-600">{errors.adresse.message}</p>}
            </div>
            <div>
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" placeholder="+212 6 00 00 00 00" className="mt-1.5" {...register("telephone")} />
              {errors.telephone && <p className="mt-1 text-xs text-red-600">{errors.telephone.message}</p>}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="contact@entreprise.com" className="mt-1.5" {...register("email")} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Logo
            </CardTitle>
            <CardDescription>
              Le logo s'affiche en haut de vos factures (PNG, JPG, WEBP ou SVG, 500 Ko maximum).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {logoPreview ? (
                <img src={logoPreview} alt="Aperçu du logo" className="h-full w-full object-contain p-1" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" /> Téléverser
                </Button>
                {logoPreview && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearLogo}>
                    <Trash2 className="mr-2 h-4 w-4 text-red-600" /> Retirer
                  </Button>
                )}
              </div>
              {errors.logoUrl && <p className="text-xs text-red-600">{errors.logoUrl.message}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => handleLogoFile(e.target.files?.[0])}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Factures & templates
            </CardTitle>
            <CardDescription>
              Choisissez la mise en page de vos factures et personnalisez le texte de pied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="templateId">Template de facture</Label>
              <Select value={templateId} onValueChange={(v) => setValue("templateId", v as UpdateEntrepriseSettingsInput["templateId"], { shouldValidate: true })}>
                <SelectTrigger id="templateId" className="mt-1.5">
                  <SelectValue placeholder="Choisir un template" />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl} value={tpl}>
                      {invoiceTemplateLabels[tpl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.templateId && <p className="mt-1 text-xs text-red-600">{errors.templateId.message}</p>}
              <p className="mt-2 text-sm text-muted-foreground">
                {invoiceTemplateDescriptions[templateId]}
              </p>
            </div>
            <div>
              <Label htmlFor="footerText">Texte de pied de facture</Label>
              <textarea
                id="footerText"
                rows={3}
                placeholder="Ex : Merci de votre confiance"
                className={`${textareaClass} mt-1.5`}
                {...register("footerText")}
              />
              {errors.footerText && <p className="mt-1 text-xs text-red-600">{errors.footerText.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer les paramètres"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}