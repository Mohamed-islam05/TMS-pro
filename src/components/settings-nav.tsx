// ============================================================
// SettingsNav - Secondary navigation for /dashboard/parametres
// NOTE: visibility filtering is UX ONLY. Server actions remain
// the authoritative authorization boundary.
// ============================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissionCheck } from "@/lib/client-permissions";
import { cn } from "@/lib/utils";
import { UserCircle, Building2, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingsNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const settingsNavItems: SettingsNavItem[] = [
  { title: "Mon profil", href: "/dashboard/parametres/profil", icon: UserCircle },
  { title: "Entreprise", href: "/dashboard/parametres/entreprise", icon: Building2, adminOnly: true },
  { title: "Utilisateurs", href: "/dashboard/parametres/utilisateurs", icon: Shield, adminOnly: true },
];

export function SettingsNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isAdmin } = usePermissionCheck();

  const visibleItems = settingsNavItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto py-1 scroll-smooth md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:py-0",
        className
      )}
    >
      {visibleItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </div>
  );
}