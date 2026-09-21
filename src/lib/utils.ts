// ============================================================
// Utility Functions - TMS Pro
// ============================================================
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function numberFromInput(value: string): number | undefined {
  if (value === "") return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(amount);
}

export function formatPhone(phone: string): string {
  return phone.replace(/(\d{2})(?=\d)/g, "$1 ");
}

export function safeLogError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    try {
      const obj = error as Record<string, unknown>;
      if ("message" in obj && typeof obj.message === "string") return obj.message;
    } catch {}
  }
  return String(error);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(date: Date | string, daysThreshold: number = 15): boolean {
  const days = daysUntil(date);
  return days >= 0 && days <= daysThreshold;
}

export type DocumentStatus = "VALIDE" | "BIENTOT_EXPIRE" | "EXPIRE" | "ABSENT";

export function documentStatus(
  date: Date | string | null | undefined,
  daysThreshold: number = 15
): DocumentStatus {
  if (!date) return "ABSENT";
  const days = daysUntil(date);
  if (days < 0) return "EXPIRE";
  if (days <= daysThreshold) return "BIENTOT_EXPIRE";
  return "VALIDE";
}
