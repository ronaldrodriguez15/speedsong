import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Eye, LoaderCircle, ReceiptText, RefreshCw, Search, Users, Wallet } from "lucide-react";
import { api, apiError } from "../services/api";
import { PointOfSaleSelector, pointsOfSale } from "../components/PointOfSaleSelector";
import { ReceivablesModal, formatCOP, type CreditSelection } from "../components/ReceivablesModal";

interface Customer { id: string; name: string; sale_count: number; amount: number; }
interface ReceivablesPage {
  data: Customer[]; total: number; current_page: number; last_page: number;
  summary: { customer_count: number; sale_count: number; amount: number };
  snapshot_id: string; updated_at: string; as_of: string;
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function Cartera() {
  const [point, setPoint] = useState("bodega");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [day, setDay] = useState(today);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data: ReceivablesPage } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [detail, setDetail] = useState<CreditSelection | null>(null);
  const cache = useRef(new Map<string, ReceivablesPage>());
  const force = useRef(false);
  const key = JSON.stringify([point, search, page, day]);
  const [requestKey, setRequestKey] = useState(key);
  const name = pointsOfSale.find(item => item.id === point)!.name;

  useEffect(() => { const timer = window.setInterval(() => setDay(today()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(draft.trim()); setPage(1); }, 350); return () => window.clearTimeout(timer); }, [draft]);
  useEffect(() => {
    const controller = new AbortController();
    const cached = cache.current.get(key);
    const refresh = force.current;
    force.current = false;
    setRequestKey(key); setError(""); setUnavailable(false); setResult(cached ? { key, data: cached } : null);
    if (cached && !refresh && Date.now() - Date.parse(cached.updated_at) < 60000) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    api.get<ReceivablesPage>(`/points-of-sale/${point}/receivables`, {
      params: { search: search || undefined, page }, signal: controller.signal, feedback: false, timeout: 90000,
    }).then(({ data }) => {
      if (!controller.signal.aborted) {
        if (cache.current.size >= 30 && !cache.current.has(key)) cache.current.delete(cache.current.keys().next().value!);
        cache.current.set(key, data); setResult({ key, data });
      }
    }).catch(error => { if (!controller.signal.aborted) { setError(apiError(error)); setUnavailable(error.response?.data?.code === "report_unavailable"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [point, page, search, key, attempt]);

  const visible = result?.key === key ? result.data : cache.current.get(key);
  const visibleError = requestKey === key ? error : "";
  const busy = requestKey === key ? loading : !visible;
  function refresh() { force.current = true; setAttempt(value => value + 1); }
  function changePoint(value: string) { setPoint(value); setPage(1); setSearch(""); setDraft(""); }
  function openDetail(customer: Customer) {
    if (!visible) return;
    setDetail({ point, pointName: name, customer: customer.id, name: customer.name, snapshot: visible.snapshot_id });
  }
  const detailButton = (customer: Customer) => <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-brand-900/50 dark:text-brand-300 dark:hover:bg-brand-900" aria-haspopup="dialog" aria-label={`Ver créditos de ${customer.name}`} onClick={() => openDetail(customer)}><Eye size={16} />Detalles</button>;

  return <section className="card overflow-hidden">
    <PointOfSaleSelector selected={point} onChange={changePoint} />
    <div role="tabpanel" id="receivables-panel" aria-labelledby={`receivables-tab-${point}`} tabIndex={0} className="p-5 focus-visible:outline-brand-500 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Créditos mayores a 60 días</p><h3 className="mt-1 text-xl font-semibold">{name}</h3></div><button type="button" className="btn-quiet" disabled={busy} onClick={refresh}><RefreshCw size={16} className={busy ? "animate-spin" : ""} />Actualizar</button></div>
      <div className="mt-5"><label className="relative block w-full sm:max-w-xs"><span className="sr-only">Buscar cliente</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" maxLength={150} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Buscar cliente..." className="field py-2.5 pl-10" /></label></div>
      {visibleError && visible && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">No se actualizaron los datos. Se muestra la última consulta disponible. {visibleError}</p>}
      {busy && !visible ? <div role="status" className="mt-6 space-y-4"><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle size={18} className="animate-spin" />Consultando cartera de {name}...</p><div className="h-28 animate-pulse rounded-2xl bg-brand-50 dark:bg-brand-900/40" /><div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /></div>
        : visibleError && !visible ? <div role="alert" className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950"><CircleAlert size={26} className="mb-3 text-amber-600 dark:text-amber-300" /><h4 className="font-semibold">{unavailable ? "Reporte no disponible en esta sede" : "No pudimos consultar la cartera"}</h4><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">{visibleError}</p><button type="button" className="btn-quiet mt-4" onClick={refresh}>Reintentar</button></div>
        : visible && <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="col-span-2 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-5 text-white sm:col-span-1"><p className="text-xs font-medium text-blue-100">Saldo pendiente · Más de 60 días</p><p className="mt-3 break-all text-2xl font-bold">{formatCOP(visible.summary.amount)}</p></div>{[{ label: 'Clientes con créditos', value: visible.summary.customer_count, icon: Users }, { label: 'Ventas pendientes', value: visible.summary.sale_count, icon: ReceiptText }].map(({ label, value, icon: Icon }) => <div key={label} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-700 sm:flex-nowrap sm:p-5"><span className="rounded-xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300"><Icon size={22} /></span><div><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div></div>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-slate-400" role="status">{busy ? "Actualizando..." : `Actualizado ${new Date(visible.updated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · Colombia`}</p></div>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="px-5 py-4">Cliente</th><th className="px-5 py-4 text-center">Número total de ventas</th><th className="px-5 py-4 text-right">Total de ventas<span className="mt-1 block font-normal">Saldo pendiente por cobrar</span></th><th className="px-5 py-4 text-right">Detalles</th></tr></thead><tbody>{visible.data.map(customer => <tr key={customer.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-5 py-4 font-semibold">{customer.name}</td><td className="px-5 py-4 text-center">{customer.sale_count}</td><td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-brand-700 dark:text-brand-300">{formatCOP(customer.amount)}</td><td className="px-5 py-4 text-right">{detailButton(customer)}</td></tr>)}</tbody></table></div>
          <div className="space-y-3 md:hidden">{visible.data.map(customer => <article key={customer.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-700"><h4 className="break-words font-semibold">{customer.name}</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{customer.sale_count} ventas a crédito pendientes</p><p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Total de ventas · Saldo pendiente</p><p className="mt-1 break-all text-xl font-semibold text-brand-700 dark:text-brand-300">{formatCOP(customer.amount)}</p><div className="mt-4">{detailButton(customer)}</div></article>)}</div>
          {visible.total === 0 && <div className="py-10 text-center"><Wallet size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" /><p className="text-sm text-slate-500 dark:text-slate-400">{search ? "No hay clientes que coincidan con la búsqueda." : "No hay créditos pendientes con más de 60 días en esta sede."}</p></div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><p>{visible.total} clientes · Página {visible.current_page} de {visible.last_page}</p><div className="flex gap-1"><button className="btn-quiet" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Anterior</button><button className="btn-quiet" disabled={busy || page >= visible.last_page} onClick={() => setPage(value => value + 1)}>Siguiente<ChevronRight size={16} /></button></div></div>
        </div>}
    </div>
    {detail && <ReceivablesModal key={`${detail.point}:${detail.customer}:${detail.snapshot}`} selection={detail} onClose={() => setDetail(null)} />}
  </section>;
}
