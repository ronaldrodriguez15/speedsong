import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, ReceiptText, X } from "lucide-react";
import { api, apiError } from "../services/api";

export interface SalesDetailSelection {
  point: string;
  name: string;
  snapshot: string;
  method: string;
  label: string;
  startDate: string;
  endDate: string;
}
interface SaleRecord {
  id: number | string;
  date: string;
  customer: string;
  total: number;
  amount: number;
  payment_names: string[];
}
interface RecordsPage {
  data: SaleRecord[];
  total: number;
  current_page: number;
  last_page: number;
  amount: number;
}
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(value);
const dateLabel = (value: string) => value.split("-").reverse().join("/");

export function SalesRecordsModal({ selection, onClose }: { selection: SalesDetailSelection; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RecordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pageCache = useRef(new Map<number, RecordsPage>());

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    close.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const cached = pageCache.current.get(page);
    setResult(cached ?? null);
    if (cached) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    api.get<RecordsPage>(`/points-of-sale/${selection.point}/sales/records`, {
      params: { snapshot: selection.snapshot, method: selection.method, page },
      signal: controller.signal, feedback: false,
    }).then(({ data }) => {
      if (!controller.signal.aborted) {
        pageCache.current.set(page, data);
        setResult(data);
      }
    }).catch(error => {
      if (!controller.signal.aborted) setError(apiError(error));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [selection.point, selection.snapshot, selection.method, page, attempt]);

  return <dialog ref={dialog} aria-labelledby="sales-detail-title" aria-describedby="sales-detail-description"
    onCancel={onClose} onClose={() => { if (!dialog.current?.open) onClose(); }}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current!.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-3xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:bg-slate-900 dark:text-slate-100">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400"><ReceiptText size={16} />{selection.name}</p>
          <h2 id="sales-detail-title" className="text-xl font-bold">{selection.label}</h2>
          <p id="sales-detail-description" className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dateLabel(selection.startDate)}{selection.endDate !== selection.startDate && ` — ${dateLabel(selection.endDate)}`} · Pesos colombianos</p>
        </div>
        <button ref={close} type="button" onClick={onClose} className="icon-button shrink-0" aria-label="Cerrar detalle"><X size={21} /></button>
      </header>
      <div className="min-h-0 overflow-y-auto">
        {loading ? <p role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle className="animate-spin" size={20} />Cargando registros...</p>
          : error ? <div role="alert" className="p-6"><CircleAlert className="mb-3 text-rose-500" /><p className="text-sm text-rose-600 dark:text-rose-400">{error}</p><button type="button" className="btn-quiet mt-4" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>
          : result && <>
            <div className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-900/40 sm:mx-6"><div><p className="text-xs font-medium text-brand-600 dark:text-brand-300">{selection.method === "all" ? "Total de ventas" : `Total en ${selection.label.toLocaleLowerCase()}`}</p><p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-200">{money(result.amount)}</p></div><span className="text-sm text-slate-500 dark:text-slate-400">{result.total} {result.total === 1 ? "registro" : "registros"}</span></div>
            {selection.method !== "all" && <p className="px-5 pb-4 text-xs leading-5 text-slate-500 dark:text-slate-400 sm:px-6">En pagos mixtos, el importe corresponde únicamente al medio seleccionado. El total de la venta se muestra como referencia.</p>}
            {result.total === 0 ? <div className="p-10 text-center"><ReceiptText size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" /><p className="text-sm text-slate-500 dark:text-slate-400">No hay registros para este medio de pago en el período seleccionado.</p></div>
              : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="px-5 py-3">Venta / Fecha</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Medios de pago</th>{selection.method !== "all" && <th className="whitespace-nowrap px-5 py-3 text-right">Total venta</th>}<th className="px-5 py-3 text-right">{selection.method === "all" ? "Total venta" : "Importe"}</th></tr></thead><tbody>{result.data.map(record => <tr key={record.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="whitespace-nowrap px-5 py-4"><p className="font-semibold">#{record.id}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.date || "Fecha no disponible"}</p></td><td className="min-w-40 px-5 py-4">{record.customer}</td><td className="min-w-40 px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{record.payment_names.join(" · ") || "Sin pagos registrados"}</td>{selection.method !== "all" && <td className="whitespace-nowrap px-5 py-4 text-right text-slate-500 dark:text-slate-400">{money(record.total)}</td>}<td className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${record.amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-brand-700 dark:text-brand-300"}`}>{money(record.amount)}</td></tr>)}</tbody></table></div>}
          </>}
      </div>
      {result && !error && !loading && <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><p>Página {page} de {result.last_page}</p><div className="flex gap-2"><button type="button" className="btn-quiet" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Anterior</button><button type="button" className="btn-quiet" disabled={page >= result.last_page} onClick={() => setPage(value => value + 1)}>Siguiente<ChevronRight size={16} /></button></div></footer>}
    </div>
  </dialog>;
}
