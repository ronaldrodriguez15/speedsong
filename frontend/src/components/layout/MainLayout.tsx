import { Boxes, ArrowRightLeft } from "lucide-react";
import { Snowman } from '../ui/ChristmasDecor';
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "../../contexts/AuthContext";
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { LayoutDashboard, Users, Wallet, TrendingUp, ChevronRight } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/transferencias": "Transferencias",
  "/inventario": "Inventario",
  "/cierre": "Cierre de caja",
  "/": "Panel principal",
  "/usuarios": "Usuarios",
  "/cartera": "Cartera",
  "/mas-vendidos": "Más vendidos"
};

export function MainLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? "SpeedSong";
  const PageIcon = ({ "/transferencias": ArrowRightLeft, "/inventario": Boxes, "/cierre": ClipboardCheck, "/": LayoutDashboard, "/usuarios": Users, "/cartera": Wallet, "/mas-vendidos": TrendingUp })[location.pathname] ?? LayoutDashboard;

  return (
    <div className="min-h-screen bg-[#f7faff] dark:bg-slate-950">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        userName={user?.name ?? "Usuario"}
      />
      <div className="min-h-screen lg:pl-[260px]">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <motion.main key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[1600px] px-4 py-5 md:py-7 sm:px-7 lg:px-9 lg:py-9">
          <div className="relative mb-5 min-h-20 pr-20 md:mb-7">
            <Snowman className="pointer-events-none absolute right-0 top-0 h-20 w-16 select-none" />
            <p className="hidden items-center gap-2 text-xs font-medium md:flex text-slate-400 dark:text-slate-400">SpeedSong <ChevronRight size={13} /> {title}</p>
            <h1 className="md:mt-3 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100"><span className="rounded-2xl border border-brand-100 dark:border-brand-800 bg-white dark:bg-slate-900 p-2.5 text-brand-500 dark:text-brand-400 shadow-sm"><PageIcon size={24} /></span>{title}</h1>
          </div>
          {children}
        </motion.main>
      </div>
    </div>
  );
}
