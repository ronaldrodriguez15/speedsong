import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, CheckCheck, ChevronDown, Menu, Search, LogOut, ShieldCheck, UserRound, Users, LayoutDashboard, Wallet, TrendingUp, CheckCircle2, CircleAlert, Trash2, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { ThemeToggle } from "../ui/ThemeToggle";
import { ClipboardCheck } from "lucide-react";
const links = [
  { name: "Cierre", path: "/cierre", icon: ClipboardCheck },
  { name: "Panel principal", path: "/", icon: LayoutDashboard },
  { name: "Usuarios", path: "/usuarios", icon: Users },
  { name: "Cartera", path: "/cartera", icon: Wallet },
  { name: "Más vendidos", path: "/mas-vendidos", icon: TrendingUp },
];
const reveal = { initial: { opacity: 0, y: -8, scale: .98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -5, scale: .98 }, transition: { duration: .18 } };
export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout, isLoggingOut } = useAuth();
  const { items, unread, markAll, clear, markRead } = useNotifications();
  const [panel, setPanel] = useState<"notifications" | "profile" | "search" | null>(null);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const profile = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const initials = user?.name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  useEffect(() => { setPanel(null); setQuery(""); }, [location.pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setPanel(null); };
    const keys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setPanel("search"); search.current?.focus();
      }
      if (event.key === "Escape") {
        if (panel === "notifications") bell.current?.focus();
        if (panel === "profile") profile.current?.focus();
        setPanel(null);
      }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keys); };
  }, [panel]);
  return <header ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setPanel(null); }} className="sticky top-0 z-30 grid min-h-[82px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto] border-b border-white/15 bg-brand-500 text-white px-4 shadow-[0_4px_30px_-20px_#64748b] backdrop-blur-xl sm:px-7 lg:px-9">
    <div className="contents">
      <div className="flex items-center gap-2 lg:hidden">
      <button onClick={onMenuClick} aria-label="Abrir menú" className="navbar-icon lg:hidden"><Menu size={21}/></button>
      </div>
      <div className="relative order-3 col-span-2 w-full md:order-none md:col-span-1 md:max-w-sm">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/80 px-3 py-2.5 focus-within:border-brand-300 dark:focus-within:border-brand-600 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-4 focus-within:ring-brand-50 dark:focus-within:ring-brand-900">
          <Search size={18} className="shrink-0 text-brand-500 dark:text-brand-400"/>
          <input ref={search} aria-label="Buscar módulo" aria-expanded={panel === "search"} aria-controls="module-search" value={query} onFocus={() => setPanel("search")} onChange={e => { setQuery(e.target.value); setPanel("search"); }} placeholder="Buscar módulo..." className="min-w-0 w-full bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"/>
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-xs text-slate-400 dark:text-slate-400 md:block">Ctrl K</kbd>
        </div>
        <AnimatePresence>{panel === "search" && <motion.div {...reveal} id="module-search" className="dropdown-panel text-slate-800 dark:text-slate-100 left-0 right-0 mt-2 p-2">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">Ir a un módulo</p>
          {links.filter(link => (!["/usuarios", "/cierre"].includes(link.path) || user?.is_admin) && link.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(({name, path, icon: Icon}) => <Link key={path} to={path} onClick={() => setPanel(null)} className="menu-item"><Icon size={18}/>{name}</Link>)}
          {!links.some(link => (!["/usuarios", "/cierre"].includes(link.path) || user?.is_admin) && link.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p className="p-3 text-sm text-slate-500 dark:text-slate-400">No hay módulos que coincidan.</p>}
        </motion.div>}</AnimatePresence>
      </div>
    </div>
    <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-4">
      <ThemeToggle onBlue />
      <div>
        <motion.button ref={bell} whileTap={{scale:.92}} aria-label={`Notificaciones: ${unread} sin leer`} aria-expanded={panel === "notifications"} aria-controls="notifications-panel" onClick={() => setPanel(panel === "notifications" ? null : "notifications")} className="navbar-icon relative">
          <Bell size={21}/>{unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white dark:border-slate-800 bg-brand-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        </motion.button>
        <AnimatePresence>{panel === "notifications" && <motion.section {...reveal} id="notifications-panel" aria-label="Notificaciones" className="dropdown-panel text-slate-800 dark:text-slate-100 right-3 top-full w-[min(390px,calc(100vw-24px))] sm:right-7">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5"><div><h2 className="font-bold">Notificaciones <span className="ml-1 text-brand-500 dark:text-brand-400">{unread}</span></h2><p className="mt-1 text-xs text-slate-400 dark:text-slate-400">Actividad de esta sesión</p></div><button className="icon-button" onClick={() => {setPanel(null); bell.current?.focus();}} aria-label="Cerrar notificaciones"><X size={17}/></button></div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? <div className="px-6 py-10 text-center"><BellOff className="mx-auto mb-3 text-slate-300 dark:text-slate-500" size={32}/><p className="font-medium">Todo al día</p><p className="mt-1 text-sm text-slate-400 dark:text-slate-400">Aquí aparecerán los resultados de tus acciones.</p></div> : items.map(item => <button key={item.id} onClick={() => markRead(item.id)} className={`flex w-full gap-3 border-b border-slate-50 dark:border-slate-800 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${item.read ? "" : "bg-brand-50/50 dark:bg-brand-900/50"}`}>
              {item.type === "success" ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-500"/> : <CircleAlert size={19} className="mt-0.5 shrink-0 text-rose-500"/>}
              <span className="min-w-0 flex-1"><span className="block text-sm">{item.message}</span><span className="mt-1 block text-xs text-slate-400 dark:text-slate-400">{new Date(item.time).toLocaleTimeString("es-CO", {hour:"2-digit",minute:"2-digit"})} · {item.read ? "Leída" : "Sin leer"}</span></span>
            </button>)}
          </div>
          {items.length > 0 && <div className="flex justify-between gap-2 p-3"><button disabled={!unread} onClick={markAll} className="btn-quiet text-xs"><CheckCheck size={16}/>Marcar leídas</button><button onClick={clear} className="btn-quiet text-xs"><Trash2 size={16}/>Limpiar</button></div>}
        </motion.section>}</AnimatePresence>
      </div>
      <div className="h-8 w-px bg-white/25"/>
      <div>
        <button ref={profile} onClick={() => setPanel(panel === "profile" ? null : "profile")} aria-expanded={panel === "profile"} aria-controls="profile-panel" className="flex items-center gap-2 rounded-2xl p-1.5 text-left text-white transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-sm font-bold text-white ring-1 ring-white/30">{initials || "U"}</span>
          <span className="hidden sm:block"><span className="block max-w-36 truncate text-sm font-semibold">{user?.name}</span><span className="block text-xs text-white/80">{user?.is_admin ? "Administrador" : "Usuario"}</span></span>
          <ChevronDown size={16} className={`text-white/80 transition-transform ${panel === "profile" ? "rotate-180" : ""}`}/>
        </button>
        <AnimatePresence>{panel === "profile" && <motion.section {...reveal} id="profile-panel" aria-label="Mi cuenta" className="dropdown-panel text-slate-800 dark:text-slate-100 right-3 top-full w-[min(300px,calc(100vw-24px))] p-2 sm:right-7">
          <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-500 dark:text-brand-400"><UserRound size={15}/>Mi cuenta</div><p className="break-words font-semibold">{user?.name}</p><p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{user?.email}</p><span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-900 px-2 py-1 text-xs text-brand-600 dark:text-brand-300"><ShieldCheck size={14}/>{user?.is_admin ? "Administrador" : "Usuario"}</span></div>
          {user?.is_admin && <Link to="/usuarios" onClick={() => setPanel(null)} className="menu-item mt-2"><Users size={18}/>Administrar usuarios</Link>}
          <Link to="/" onClick={() => setPanel(null)} className="menu-item"><LayoutDashboard size={18}/>Ir al panel</Link>
          <button disabled={isLoggingOut} onClick={() => void logout()} className="menu-item w-full text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950"><LogOut size={18}/>{isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</button>
        </motion.section>}</AnimatePresence>
      </div>
    </div>
  </header>;
}
