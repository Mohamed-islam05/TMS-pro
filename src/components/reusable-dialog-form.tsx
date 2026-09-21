"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useForm, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodSchema } from "zod";
import { Loader2 } from "lucide-react";

import { cn, numberFromInput } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface FormFieldConfig {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "password" | "date" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  description?: string;
}

interface ReusableDialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  schema: ZodSchema<any>;
  fields: FormFieldConfig[];
  onSubmit: (data: any) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }>;
  initialData?: Record<string, any>;
  submitLabel?: string;
  cancelLabel?: string;
  maxWidth?: string;
  onFieldChange?: (name: string, value: any) => void;
  submissionKey?: string;
}

export function ReusableDialogForm({
  open,
  onOpenChange,
  title,
  description,
  schema,
  fields,
  onSubmit,
  initialData,
  submitLabel = "Enregistrer",
  cancelLabel = "Annuler",
  maxWidth = "sm:max-w-[500px]",
  onFieldChange,
  submissionKey,
}: ReusableDialogFormProps) {
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo(
    () => {
      const vals: Record<string, any> = {};
      for (const f of fields) {
        const fromInit = initialData && f.name in initialData ? initialData[f.name] : undefined;
        if (fromInit !== undefined && fromInit !== null) {
          vals[f.name] = fromInit;
        } else {
          vals[f.name] = undefined;
        }
      }
      return vals;
    },
    // serialise to primitives to avoid unnecessary re-computation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(fields.map(f => [f.name, f.type])), JSON.stringify(initialData)]
  );

  const form = useForm<FieldValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(initialData || {});
    }
  }, [open, initialData, form]);

  const handleSubmit = form.handleSubmit(async (data: FieldValues) => {
    startTransition(async () => {
      try {
        const result = await onSubmit(
          submissionKey ? { ...data, submissionKey } : data
        );
        if (result.success) {
          toast.success(result.message || "Opération réussie");
          onOpenChange(false);
          form.reset();
        } else {
          toast.error(result.error || "Une erreur est survenue");
        }
      } catch (error) {
        console.error("Form submission error:", error);
        toast.error("Une erreur inattendue est survenue");
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-h-[90vh] overflow-y-auto", maxWidth)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((fieldConfig) => (
                <FormField
                  key={fieldConfig.name}
                  control={form.control}
                  name={fieldConfig.name}
                  render={({ field }) => (
                    <FormItem className={fieldConfig.type === "textarea" ? "col-span-full" : ""}>
                      <FormLabel>
                        {fieldConfig.label}
                        {fieldConfig.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </FormLabel>
                      {fieldConfig.type === "select" && fieldConfig.options ? (
                        <Select
                          onValueChange={(v) => {
                            field.onChange(v);
                            onFieldChange?.(fieldConfig.name, v);
                          }}
                          value={field.value || ""}
                          disabled={fieldConfig.disabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={fieldConfig.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldConfig.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : fieldConfig.type === "textarea" ? (
                        <FormControl>
                          <Input
                            placeholder={fieldConfig.placeholder}
                            {...field}
                            value={field.value ?? ""}
                            disabled={fieldConfig.disabled}
                          />
                        </FormControl>
                      ) : (
                        <FormControl>
                          <Input
                            type={fieldConfig.type || "text"}
                            placeholder={fieldConfig.placeholder}
                            {...field}
                            value={field.value ?? ""}
                            onChange={
                              fieldConfig.type === "number"
                                ? (e) => field.onChange(numberFromInput(e.target.value))
                                : field.onChange
                            }
                            disabled={fieldConfig.disabled}
                          />
                        </FormControl>
                      )}
                      {fieldConfig.description && (
                        <p className="text-xs text-muted-foreground">{fieldConfig.description}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
