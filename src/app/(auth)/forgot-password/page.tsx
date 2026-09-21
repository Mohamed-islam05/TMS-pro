"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Building2, ArrowLeft, CheckCircle2, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/password";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [genericMessage, setGenericMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset({ ice: data.ice, email: data.email });
      setGenericMessage(result.message);
      setSubmitted(true);
    } catch {
      setGenericMessage("Si cette adresse est associée à un compte, un lien de réinitialisation vous a été envoyé.");
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white lg:flex">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">TMS Pro</span>
              <p className="text-xs text-slate-400">Transport Management System</p>
            </div>
          </div>
          <h2 className="mt-12 max-w-md text-3xl font-bold leading-tight">
            Récupérez l&apos;accès à votre compte
          </h2>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-muted/30 p-6 lg:bg-white lg:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-6 flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">TMS Pro</span>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-8 shadow-xl">
            {submitted ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Email envoyé</h1>
                <p className="text-sm text-muted-foreground">{genericMessage}</p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center lg:text-left">
                  <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Entrez votre Code ICE et votre email pour recevoir un lien de réinitialisation
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label htmlFor="ice" className="mb-1.5 block text-sm font-medium">
                      Code ICE
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        {...register("ice")}
                        id="ice"
                        type="text"
                        placeholder="001234567000001"
                        autoComplete="organization"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                    {errors.ice && (
                      <p className="mt-1 text-xs text-red-600">{errors.ice.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        {...register("email")}
                        id="email"
                        type="email"
                        placeholder="admin@tms.com"
                        autoComplete="email"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      "Envoyer le lien"
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la connexion
                  </Link>
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} TMS Pro — Plateforme de gestion de transport
          </p>
        </div>
      </div>
    </div>
  );
}
