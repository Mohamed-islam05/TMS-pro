// ============================================================
// Sidebar Component
// ============================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { usePermissionCheck } from "@/lib/client-permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Truck,
  Activity,
  Receipt,
  FileText,
  ClipboardList,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  permission?: string;
}

const navGroups: NavGroup[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { title: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.overview" },
    ],
  },
  {
    label: "Opérations",
    items: [
      { title: "Opérations", href: "/dashboard/operations", icon: Activity, permission: "dossiers.view" },
      { title: "Factures", href: "/dashboard/factures", icon: FileText, exact: true, permission: "factures.view" },
      { title: "Relevé de Factures", href: "/dashboard/factures/releve", icon: ClipboardList, permission: "factures.releve" },
      { title: "Charges", href: "/dashboard/charges", icon: Receipt, permission: "charges.view" },
    ],
  },
  {
    label: "Flotte",
    items: [
      { title: "Camions", href: "/dashboard/camions", icon: Truck, permission: "camions.view" },
      { title: "Chauffeurs", href: "/dashboard/chauffeurs", icon: UserCheck, permission: "chauffeurs.view" },
    ],
  },
  {
    label: "Clients",
    items: [{ title: "Clients", href: "/dashboard/clients", icon: Users, permission: "clients.view" }],
  },
  {
    label: "Administration",
    permission: "users.view",
    items: [{ title: "Utilisateurs", href: "/dashboard/utilisateurs", icon: Shield }],
  },
  {
    label: "Compte",
    items: [{ title: "Mon profil", href: "/dashboard/profil", icon: UserCircle }],
  },
];

function isItemActive(item: NavItem, pathname: string) {
  if (item.exact || item.href === "/dashboard") {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

function SidebarNav({
  collapsed,
  can,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  can: (permission: string) => boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups = navGroups
    .filter((group) => !group.permission || can(group.permission))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((group, index) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {collapsed && index > 0 && <div className="mb-2 border-t" />}
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = isItemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                    collapsed ? "justify-center px-0 py-2" : "space-x-3 px-3 py-2",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isAdmin, can } = usePermissionCheck();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("tms-sidebar-collapsed") === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("tms-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <>
      {/* Mobile header */}
      <header className="no-print flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6" />
          <span className="font-bold">TMS Pro</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "no-print hidden h-full shrink-0 flex-col border-r bg-muted/40 transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Déplier le menu"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <Link href="/dashboard" className="flex cursor-pointer items-center gap-2">
                <Truck className="h-6 w-6" />
                <span className="font-bold">TMS Pro</span>
              </Link>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Replier le menu"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <SidebarNav collapsed={collapsed} can={can} pathname={pathname} />
        </nav>

        {session?.user && (
          <div className={cn("shrink-0 border-t px-4 py-3", collapsed && "px-2 text-center")}>
            {collapsed ? (
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {(session.user.nom || session.user.email).charAt(0).toUpperCase()}
              </div>
            ) : (
              <>
                <p className="truncate text-sm font-medium">{session.user.nom || session.user.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isAdmin ? "Administrateur" : "Staff"}
                </p>
              </>
            )}
          </div>
        )}

        <div className="shrink-0 border-t p-2">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Déconnexion"
            className={cn(
              "flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground",
              collapsed ? "justify-center" : "space-x-3"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-background shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <Truck className="h-6 w-6" />
                <span className="font-bold">TMS Pro</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              <SidebarNav
                collapsed={false}
                can={can}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </nav>
            {session?.user && (
              <div className="shrink-0 border-t px-4 py-3">
                <p className="truncate text-sm font-medium">{session.user.nom || session.user.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isAdmin ? "Administrateur" : "Staff"}
                </p>
              </div>
            )}
            <div className="shrink-0 border-t p-2">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full cursor-pointer items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
