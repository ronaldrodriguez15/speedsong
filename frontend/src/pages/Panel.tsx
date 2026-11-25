import { Activity, ArrowUpRight, ShoppingBag, Users, Wallet, TrendingUp } from "lucide-react";
import { formatCurrency } from "../lib/utils";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const metrics = [
  { label: "Usuarios registrados", value: "—", note: "Pendiente de conectar API", icon: Users },
  { label: "Cartera total", value: "—", note: "Pendiente de conectar API", icon: Wallet },
  { label: "Ventas del periodo", value: "—", note: "Pendiente de conectar API", icon: ShoppingBag },
  { label: "Productos vendidos", value: "—", note: "Pendiente de conectar API", icon: TrendingUp }
];

export function Panel() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Resumen general</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Una vista rápida del estado de tu negocio.</p>
        </div>
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" /> Datos por conectar
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, note, icon: Icon }, index) => (
          <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} whileHover={{ y: -4 }} key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-300"><Icon size={21} /></div>
              <span className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2 text-slate-400 dark:text-slate-400"><ArrowUpRight size={16} /></span>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">{value}</p>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-400">{note}</p>
          </motion.article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><h3 className="font-semibold text-slate-800 dark:text-slate-100">Actividad del negocio</h3><p className="mt-1 text-xs text-slate-400 dark:text-slate-400">Aquí se mostrarán tus indicadores.</p></div>
            <div className="rounded-xl bg-brand-50 dark:bg-brand-900 p-2.5 text-brand-600 dark:text-brand-300"><Activity size={19} /></div>
          </div>
          <div className="mt-8 flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-brand-500 dark:text-brand-400 shadow-sm"><TrendingUp size={20} /></div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Gráfica pendiente de datos</p>
            <p className="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-400">Conecta el endpoint de estadísticas para visualizar el comportamiento del negocio.</p>
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Accesos rápidos</h3>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">Navega a los módulos principales.</p>
          <div className="mt-5 space-y-3">
            {[
              { name: "Usuarios", desc: "Administrar usuarios", href: "/usuarios", icon: Users },
              { name: "Cartera", desc: "Consultar cartera", href: "/cartera", icon: Wallet },
              { name: "Cierre", desc: "Cerrar la caja del día", href: "/cierre", icon: ClipboardCheck },
              { name: "Más vendidos", desc: "Ver productos destacados", href: "/mas-vendidos", icon: ShoppingBag }
            ].filter(item => !["/usuarios", "/cierre"].includes(item.href) || user?.is_admin).map(({ name, desc, href, icon: Icon }) => (
              <Link to={href} key={name} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3 transition hover:border-brand-100 dark:hover:border-brand-800 hover:bg-brand-50/50 dark:hover:bg-brand-900/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-300"><Icon size={18} /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{name}</p><p className="mt-0.5 text-xs text-slate-400 dark:text-slate-400">{desc}</p></div>
                <ArrowUpRight size={16} className="text-slate-400 dark:text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-400">{formatCurrency(0)} · Formato de moneda configurado para Colombia; los valores reales llegarán desde la API.</p>
    </div>
  );
}
