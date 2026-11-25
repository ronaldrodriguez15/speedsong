import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Wallet, TrendingUp, X, LogOut, PanelLeftClose } from "lucide-react";
import { Logo } from "../ui/Logo";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { ClipboardCheck } from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  userName: string;
}

const navigation = [
  { label: "Panel", path: "/", icon: LayoutDashboard },
  { label: "Usuarios", path: "/usuarios", icon: Users },
  { label: "Cartera", path: "/cartera", icon: Wallet },
  { label: "Cierre", path: "/cierre", icon: ClipboardCheck },
  { label: "Más vendidos", path: "/mas-vendidos", icon: TrendingUp }
];

export function Sidebar({ open, onClose, onLogout, userName }: SidebarProps) {
  const { user, isLoggingOut } = useAuth();
  return (
    <>
      {open && <button aria-label="Cerrar menú" onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-blue-200/80 dark:border-slate-700 bg-[#eaf1fb] dark:bg-slate-900 shadow-[5px_0_24px_-16px_rgba(24,63,109,0.35)] transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-white/15 bg-brand-500 px-6 text-white">
          <Logo light />
          <button onClick={onClose} aria-label="Cerrar menú" className="rounded-lg p-2 text-white hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white lg:hidden">
            <X size={19} />
          </button>
        </div>

        <div className="px-4 pt-8">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">Menú principal</p>
          <nav className="space-y-1">
            {navigation.filter(item => !["/usuarios", "/cierre"].includes(item.path) || user?.is_admin).map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={onClose}
                className={({ isActive }) => cn(
                  "group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  isActive
                    ? "bg-white dark:bg-brand-900 text-brand-700 dark:text-brand-200 shadow-sm ring-1 ring-brand-100 dark:ring-brand-800"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800 hover:text-brand-700 dark:hover:text-white"
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={19} strokeWidth={isActive ? 2.3 : 1.8} />
                    <span>{label}</span>
                    {isActive && <motion.span layoutId="sidebar-active" transition={{ type: "spring", stiffness: 400, damping: 32 }} className="absolute -left-1 h-6 w-1 rounded-full bg-brand-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-white/70 dark:bg-slate-800/80 ring-1 ring-blue-100 dark:ring-slate-700 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-300">
                <PanelLeftClose size={16} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{userName}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-400">Cuenta activa</p>
              </div>
            </div>
            <button disabled={isLoggingOut} onClick={onLogout} className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 transition hover:bg-white dark:hover:bg-slate-900 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40">
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
          <p className="mt-4 text-center text-[10px] text-slate-300 dark:text-slate-500">SpeedSong · Panel administrativo</p>
        </div>
      </aside>
    </>
  );
}
