// ============================================================
// Parametres Layout - Section header + internal navigation
// NOTE: the sub-navigation visibility is UX only. Server actions
// remain the authoritative authorization boundary for settings.
// ============================================================
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings-nav";

export default function ParametresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Gérez votre profil, les paramètres de votre entreprise et les utilisateurs."
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <SettingsNav className="md:border-r md:pr-4" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}