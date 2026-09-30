// ============================================================
// /dashboard/parametres - redirects to the default section
// ============================================================
import { redirect } from "next/navigation";

export default function ParametresPage() {
  redirect("/dashboard/parametres/profil");
}