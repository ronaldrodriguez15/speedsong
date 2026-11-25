import { ShieldCheck } from "lucide-react";
import { PointOfSaleTabs } from "../components/PointOfSaleTabs";
import { useAuth } from "../contexts/AuthContext";

export function Cierre() {
  const { user } = useAuth();
  if (!user?.is_admin) return <div className="card flex items-center gap-3 p-6"><ShieldCheck className="text-brand-500 dark:text-brand-400" />Solo los administradores pueden consultar los cierres.</div>;
  return <PointOfSaleTabs />;
}