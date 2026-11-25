import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownLeft, ArrowRightLeft, Banknote, CalendarDays, CircleAlert, CreditCard, LoaderCircle, RefreshCw, Smartphone, Store, TrendingUp } from "lucide-react";
import { api, apiError } from "../services/api";
import { SalesRecordsModal, type SalesDetailSelection } from "./SalesRecordsModal";

const points = [
  { id: "bodega", name: "Bodega" },
  { id: "villa", name: "Villa" },
  { id: "local", name: "Local" },
  { id: "bmanga", name: "Bucaramanga" },
  { id: "cucuta", name: "Cúcuta" },
] as const;

interface SalesSummary {
  snapshot_id: string;
  point: string; date: string; start_date: string; end_date: string; total: number; sale_count: number; updated_at: string;
  payments: { cash: number; transfer: number; nequi: number; credit: number; other: number };
  other_methods: Record<string, number>; payment_difference: number;
}
const periods = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "last7", label: "Últimos 7 días" },
  { id: "last30", label: "Últimos 30 días" },
] as const;
type Period = typeof periods[number]["id"];
const displayDate = (date: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(value);
const methods = [
  { key: "cash", label: "Efectivo", icon: Banknote, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400", bar: "bg-emerald-500" },
  { key: "transfer", label: "Transferencia", icon: ArrowRightLeft, color: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400", bar: "bg-blue-500" },
  { key: "nequi", label: "Nequi", icon: Smartphone, color: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950 dark:text-fuchsia-400", bar: "bg-fuchsia-500" },
  { key: "credit", label: "Línea de crédito", icon: CreditCard, color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400", bar: "bg-amber-500" },
] as const;

export function PointOfSaleTabs() {
  const [detail, setDetail] = useState<SalesDetailSelection | null>(null);
  const [selected, setSelected] = useState(0);
  const [summary, setSummary] = useState<{ key: string; data: SalesSummary } | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [currentDay, setCurrentDay] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const cache = useRef(new Map<string, SalesSummary>());
  const forceRefresh = useRef(false);
  const key = `${points[selected].id}:${period}:${currentDay}`;
  const [requestKey, setRequestKey] = useState(key);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDay(today());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRequestKey(key);
    setError("");
    const cached = cache.current.get(key);
    const force = forceRefresh.current;
    forceRefresh.current = false;
    setSummary(cached ? { key, data: cached } : null);
    if (cached && !force && Date.now() - Date.parse(cached.updated_at) < 60000) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    api.get<{ data: SalesSummary }>(`/points-of-sale/${points[selected].id}/sales`, {
      params: { period }, timeout: 60000,
      signal: controller.signal,
      feedback: false,
    }).then(({ data }) => {
      if (!controller.signal.aborted) {
        if (cache.current.size >= 20 && !cache.current.has(key)) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, data.data);
        setSummary({ key, data: data.data });
      }
    }).catch(error => {
      if (!controller.signal.aborted) setError(apiError(error));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt, selected, period, key]);

  function refresh() {
    forceRefresh.current = true;
    setAttempt(value => value + 1);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % points.length;
    else if (event.key === "ArrowLeft") next = (index + points.length - 1) % points.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = points.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  const visibleSummary = summary?.key === key ? summary.data : cache.current.get(key);
  const visibleError = requestKey === key ? error : "";
  const busy = requestKey === key ? loading : !visibleSummary;

  function openDetail(method: string, label: string) {
    if (!visibleSummary) return;
    setDetail({ point: points[selected].id, name: points[selected].name, snapshot: visibleSummary.snapshot_id,
      method, label, startDate: visibleSummary.start_date, endDate: visibleSummary.end_date });
  }

  return <section className="card overflow-hidden">
    <div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Store size={22} className="text-brand-500 dark:text-brand-400" />Cierre por punto de venta</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Las ventas de cada sede, claras y en un solo lugar.</p>
    </div>
    <div role="tablist" aria-label="Puntos de venta" className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      {points.map((point, index) => <button
        key={point.id}
        ref={element => { tabs.current[index] = element; }}
        type="button"
        role="tab"
        id={`pos-tab-${point.id}`}
        aria-controls={`pos-panel-${point.id}`}
        aria-selected={selected === index}
        tabIndex={selected === index ? 0 : -1}
        onClick={() => setSelected(index)}
        onKeyDown={event => navigate(event, index)}
        className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${selected === index ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}
      ><Store size={16} />{point.name}</button>)}
    </div>
    {points.map((point, index) => <div key={point.id} role="tabpanel" id={`pos-panel-${point.id}`} aria-labelledby={`pos-tab-${point.id}`} hidden={selected !== index} tabIndex={0} className="p-5 focus-visible:outline-brand-500 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Resumen de ventas</p><h3 className="mt-1 text-xl font-semibold">{point.name}</h3></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={refresh} className="btn-quiet" aria-label="Actualizar ventas"><RefreshCw size={16} className={busy ? "animate-spin" : ""} /><span className="hidden sm:inline">Actualizar</span></button>
        </div>
      </div>
      <div role="group" aria-label="Período de ventas" className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50 sm:flex sm:flex-wrap">
        {periods.map(item => <button type="button" key={item.id} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${period === item.id ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}>{item.label}</button>)}
      </div>
      {visibleSummary && <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><CalendarDays size={15} />{displayDate(visibleSummary.start_date)}{visibleSummary.start_date !== visibleSummary.end_date && <> — {displayDate(visibleSummary.end_date)}</>} · Colombia {busy && <span role="status" className="ml-auto">Actualizando...</span>}</p>}
      {visibleError && visibleSummary && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">No se actualizaron los datos. Se muestra la última consulta disponible. {visibleError}</p>}
      {busy && !visibleSummary ? <div role="status" aria-live="polite" className="mt-6 space-y-4"><div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle size={17} className="animate-spin" />Consultando ventas de {point.name}...</div><div className="h-36 animate-pulse rounded-2xl bg-brand-50 dark:bg-brand-900/40" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{methods.map(method => <div key={method.key} className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div></div>
        : visibleError && !visibleSummary ? <div role="alert" className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950"><CircleAlert size={24} className="mb-3 text-rose-500" /><p className="font-semibold">No pudimos obtener las ventas de {point.name}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{visibleError}</p><button type="button" className="btn-quiet mt-4" onClick={refresh}>Reintentar</button></div>
        : visibleSummary && <div className="mt-6 space-y-5" aria-live="polite">
          <button type="button" onClick={() => openDetail("all", "Todas las ventas")} aria-haspopup="dialog" aria-label="Ver registros de todas las ventas" className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-6 text-left text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 sm:p-7">
            <TrendingUp size={130} strokeWidth={1} aria-hidden="true" className="pointer-events-none absolute -right-3 -top-3 text-white/10" />
            <div className="relative flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-blue-100">{period === "today" ? "Total vendido hoy" : period === "yesterday" ? "Total vendido ayer" : "Total vendido del período"}</p><p className="mt-2 break-all text-3xl font-bold tracking-tight sm:text-4xl">{money(visibleSummary.total)}</p><p className="mt-3 text-xs text-blue-100">Pesos colombianos · Ventas netas de devoluciones</p></div><span className="rounded-xl bg-white/15 px-4 py-2 text-sm font-medium">{visibleSummary.sale_count} {visibleSummary.sale_count === 1 ? "operación" : "operaciones"}</span></div>
            <p className="relative mt-3 text-xs text-white/80">Ver registros →</p>
          </button>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {methods.map(({ key, label, icon: Icon, color, bar }) => {
              const amount = visibleSummary.payments[key];
              const percent = visibleSummary.total > 0 ? Math.max(0, Math.min(100, amount / visibleSummary.total * 100)) : 0;
              return <button type="button" key={key} onClick={() => openDetail(key, label)} aria-haspopup="dialog" aria-label={`Ver registros de ${label}`} className="rounded-2xl border border-slate-100 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-brand-500"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={20} /></span><p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p></div><p className="mt-5 break-all text-xl font-semibold tracking-tight">{money(amount)}</p><div aria-hidden="true" className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs text-slate-400 dark:text-slate-500">Ver registros →</p></button>;
            })}
          </div>
          {Object.keys(visibleSummary.other_methods).length > 0 && <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="mb-2 text-sm font-semibold">Otros medios de pago</p>{Object.entries(visibleSummary.other_methods).map(([name, amount]) => <div key={name} className="flex justify-between gap-4 py-1 text-sm"><span>{name || "Sin identificar"}</span><strong>{money(amount)}</strong></div>)}</div>}
          {visibleSummary.payment_difference !== 0 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">El total de ventas y los pagos registrados tienen una diferencia de {money(visibleSummary.payment_difference)}. Revisa los pagos en el punto de venta.</p>}
          {visibleSummary.sale_count === 0 && <p className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">No hay ventas completadas en este período.</p>}
          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400"><p className="max-w-xl">Transferencia incluye consignaciones. No incluye ventas suspendidas, anuladas ni abonos a créditos anteriores.</p><p className="flex items-center gap-1.5"><ArrowDownLeft size={14} />Actualizado {new Date(visibleSummary.updated_at).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })} · Colombia</p></div>
        </div>}
    </div>)}
    {detail && <SalesRecordsModal key={`${detail.point}:${detail.snapshot}:${detail.method}`} selection={detail} onClose={() => setDetail(null)} />}
  </section>;
}
