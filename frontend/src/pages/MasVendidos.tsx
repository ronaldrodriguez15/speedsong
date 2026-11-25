import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CircleAlert, LoaderCircle, Package, RefreshCw, Trophy, TrendingUp } from "lucide-react";
import { PointOfSaleSelector, pointsOfSale } from "../components/PointOfSaleSelector";
import { api, apiError } from "../services/api";

interface Product { id: string; name: string; sku: string; category: string; rank: number; units: number; share: number; }
interface Ranking { point: string; products: Product[]; product_count: number; sale_count: number; top_units: number; start_date: string; end_date: string; updated_at: string; }
const periods = [{ id: "today", label: "Hoy" }, { id: "yesterday", label: "Ayer" }, { id: "last7", label: "Últimos 7 días" }, { id: "last30", label: "Últimos 30 días" }] as const;
type Period = typeof periods[number]["id"];
const units = (value: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 6 }).format(value);
const date = (value: string) => value.split("-").reverse().join("/");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function MasVendidos() {
  const [point, setPoint] = useState("bodega");
  const [period, setPeriod] = useState<Period>("last30");
  const [day, setDay] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data: Ranking } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const cache = useRef(new Map<string, Ranking>());
  const force = useRef(false);
  const key = `${point}:${period}:${day}`;
  const [requestKey, setRequestKey] = useState(key);
  const name = pointsOfSale.find(item => item.id === point)!.name;
  useEffect(() => { const timer = window.setInterval(() => setDay(today()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const cached = cache.current.get(key);
    const refresh = force.current; force.current = false;
    setRequestKey(key); setError(""); setResult(cached ? { key, data: cached } : null);
    if (cached && !refresh && Date.now() - Date.parse(cached.updated_at) < 60000) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    api.get<{ data: Ranking }>(`/points-of-sale/${point}/top-products`, { params: { period }, signal: controller.signal, feedback: false, timeout: 90000 })
      .then(({ data }) => { if (!controller.signal.aborted) { if (cache.current.size >= 20 && !cache.current.has(key)) cache.current.delete(cache.current.keys().next().value!); cache.current.set(key, data.data); setResult({ key, data: data.data }); } })
      .catch(error => { if (!controller.signal.aborted) setError(apiError(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [point, period, key, attempt]);
  const visible = result?.key === key ? result.data : cache.current.get(key);
  const busy = requestKey === key ? loading : !visible;
  const visibleError = requestKey === key ? error : "";
  const winner = visible?.products[0];
  function refresh() { force.current = true; setAttempt(value => value + 1); }

  return <section className="card overflow-hidden">
    <div className="p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp size={22} className="text-brand-500 dark:text-brand-400" />Los favoritos de tus clientes</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Descubre el producto líder y los 10 más vendidos de cada sede.</p></div>
    <PointOfSaleSelector selected={point} onChange={setPoint} idPrefix="top-products" />
    <div role="tabpanel" id="top-products-panel" aria-labelledby={`top-products-tab-${point}`} tabIndex={0} className="space-y-5 p-5 focus-visible:outline-brand-500 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Ranking por unidades netas</p><h3 className="mt-1 text-xl font-semibold">{name}</h3></div><button type="button" className="btn-quiet" disabled={busy} onClick={refresh}><RefreshCw size={16} className={busy ? "animate-spin" : ""} />Actualizar</button></div>
      <div role="group" aria-label="Período de ventas" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50 sm:flex sm:flex-wrap">{periods.map(item => <button type="button" key={item.id} aria-pressed={item.id === period} onClick={() => setPeriod(item.id)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${item.id === period ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}>{item.label}</button>)}</div>
      {visibleError && visible && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">No se pudo actualizar el ranking. Se muestran los últimos datos disponibles. {visibleError}</p>}
      {busy && !visible ? <div role="status" className="space-y-4"><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle size={18} className="animate-spin" />Analizando productos de {name}...</p><div className="h-48 animate-pulse rounded-2xl bg-brand-50 dark:bg-brand-900/40" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /></div>
        : visibleError && !visible ? <div role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950"><CircleAlert size={26} className="mb-3 text-rose-500" /><h4 className="font-semibold">No pudimos obtener el ranking</h4><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{visibleError}</p><button type="button" className="btn-quiet mt-4" onClick={refresh}>Reintentar</button></div>
        : visible && <>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><p>{date(visible.start_date)}{visible.start_date !== visible.end_date && ` — ${date(visible.end_date)}`} · Colombia</p><p role="status">{busy ? "Actualizando..." : `Actualizado ${new Date(visible.updated_at).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}`}</p></div>
          {winner ? <>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white sm:p-8"><Trophy size={180} strokeWidth={1} aria-hidden="true" className="pointer-events-none absolute -right-8 -top-6 text-white/10" /><div className="relative"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"><Trophy size={15} className="text-amber-200" />PRODUCTO MÁS VENDIDO</span><div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div className="min-w-0 max-w-xl"><h4 className="break-words text-xl font-bold leading-snug sm:text-2xl">{winner.name}</h4><p className="mt-3 break-words text-xs text-blue-100">{winner.sku ? `Referencia: ${winner.sku}` : 'Sin referencia'}{winner.category && ` · ${winner.category}`}</p></div><div className="shrink-0"><p className="text-4xl font-bold tracking-tight">{units(winner.units)}</p><p className="mt-1 text-sm text-blue-100">unidades netas vendidas</p></div></div></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-700"><p className="text-xs text-slate-500 dark:text-slate-400">Productos con ventas netas</p><p className="mt-2 text-2xl font-semibold">{units(visible.product_count)}</p></div><div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-700"><p className="text-xs text-slate-500 dark:text-slate-400">Operaciones analizadas</p><p className="mt-2 text-2xl font-semibold">{units(visible.sale_count)}</p></div></div>
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-5 dark:border-slate-800"><h4 className="flex items-center gap-2 font-semibold"><Package size={19} className="text-brand-500" />Top 10 de productos</h4><span className="text-xs text-slate-500 dark:text-slate-400">{visible.products.length} de {visible.product_count} productos</span></div><ol className="divide-y divide-slate-100 dark:divide-slate-800">{visible.products.map(product => <li key={product.id} className="flex items-start gap-3 p-4 sm:items-center sm:gap-4 sm:p-5"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${product.rank === 1 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{product.rank === 1 ? <Trophy size={18} /> : product.rank}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold leading-6">{product.name}</p>{product.sku && <p className="mt-1 break-words text-xs text-slate-400 dark:text-slate-500">{product.sku}</p>}</div><div className="text-right"><p className="whitespace-nowrap text-lg font-bold text-brand-700 dark:text-brand-300">{units(product.units)}</p><p className="text-[10px] text-slate-400 dark:text-slate-500">unidades</p></div></div><div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true"><div className="h-full rounded-full bg-brand-500" style={{ width: `${product.share}%` }} /></div><span className="w-12 text-right text-[10px] text-slate-500 dark:text-slate-400">{product.share.toLocaleString('es-CO')}%</span></div></div></li>)}</ol><p className="border-t border-slate-100 p-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">Los porcentajes indican la participación de cada producto dentro del top 10.</p></div>
          </> : <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700"><Package size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" /><p className="font-medium">Sin productos vendidos en este período</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Selecciona otro período o punto de venta.</p></div>}
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400"><ArrowUpRight size={16} className="mt-0.5 shrink-0" />Unidades vendidas menos devoluciones. Se excluyen ventas anuladas, suspendidas y abonos a créditos. Las variantes del mismo producto se agrupan.</p>
        </>}
    </div>
  </section>;
}
