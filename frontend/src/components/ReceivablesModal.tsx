import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, ReceiptText, X } from "lucide-react";
import { api, apiError } from "../services/api";

export interface CreditSelection { point: string; pointName: string; customer: string; name: string; snapshot: string; }
interface Credit { id: string; reference: string; sale_date: string; age_days: number; amount: number; comment: string; }
interface CreditPage { data: Credit[]; amount: number; total: number; current_page: number; last_page: number; as_of: string; }
export const formatCOP = (amount: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(amount);
const formatDate = (date: string) => date.split("-").reverse().join("/");

export function ReceivablesModal({ selection, onClose }: { selection: CreditSelection; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const cache = useRef(new Map<number, CreditPage>());
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CreditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const downloadRequest = useRef<AbortController | null>(null);
  useEffect(() => () => downloadRequest.current?.abort(), []);
  async function download() {
    if (downloadRequest.current && !downloadRequest.current.signal.aborted) return;
    const controller = new AbortController(); downloadRequest.current = controller;
    setDownloading(true); setDownloadError("");
    try {
      const { downloadReceivablesPdf } = await import("../services/receivablesPdf");
      if (!controller.signal.aborted) await downloadReceivablesPdf(selection.point, selection.customer, selection.snapshot, controller.signal);
    } catch (error) { if (!controller.signal.aborted) setDownloadError(apiError(error)); }
    finally { if (!controller.signal.aborted) { setDownloading(false); downloadRequest.current = null; } }
  }
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal(); closeButton.current?.focus(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const cached = cache.current.get(page);
    setResult(cached ?? null);
    if (cached) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    api.get<CreditPage>(`/points-of-sale/${selection.point}/receivables/${selection.customer}/credits`, {
      params: { snapshot: selection.snapshot, page }, signal: controller.signal, feedback: false,
    }).then(({ data }) => { if (!controller.signal.aborted) { cache.current.set(page, data); setResult(data); } })
      .catch(error => { if (!controller.signal.aborted) setError(apiError(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, selection.point, selection.customer, selection.snapshot, attempt]);
  return <dialog ref={dialog} aria-labelledby="credit-detail-title" aria-describedby="credit-detail-description" onCancel={onClose}
    onClose={() => { if (!dialog.current?.open) onClose(); }}
    onClick={event => { if (event.target !== dialog.current) return; const rect = dialog.current!.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-3xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:bg-slate-900 dark:text-slate-100">
    <div className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
        <div className="min-w-0"><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400"><ReceiptText size={16} />{selection.pointName}</p><h2 id="credit-detail-title" className="break-words text-xl font-bold">{selection.name}</h2><p id="credit-detail-description" className="mt-2 text-sm text-slate-500 dark:text-slate-400">Créditos pendientes con más de 60 días desde la venta.</p></div>
        <button ref={closeButton} type="button" className="icon-button shrink-0" aria-label="Cerrar detalle de créditos" onClick={onClose}><X size={21} /></button>
      </header>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800"><p className="text-xs text-slate-500 dark:text-slate-400">Reporte completo del cliente</p><button type="button" className="btn-primary py-2" disabled={downloading || loading || !!error} onClick={() => void download()}>{downloading ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}{downloading ? "Generando PDF..." : "Descargar PDF"}</button>{downloadError && <p role="alert" className="w-full text-sm text-rose-600 dark:text-rose-400">{downloadError}</p>}</div>
      <div className="min-h-0 overflow-y-auto">
        {loading ? <p role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle size={20} className="animate-spin" />Cargando créditos...</p>
          : error ? <div role="alert" className="p-6"><p className="text-sm text-rose-600 dark:text-rose-400">{error}</p><button className="btn-quiet mt-4" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>
          : result && <>
            <div className="m-5 rounded-2xl bg-brand-50 p-5 dark:bg-brand-900/40"><p className="text-sm text-brand-600 dark:text-brand-300">Saldo pendiente por cobrar</p><p className="mt-2 break-all text-3xl font-bold text-brand-700 dark:text-brand-200">{formatCOP(result.amount)}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{result.total} créditos · Corte al {formatDate(result.as_of)}</p></div>
            <div className="space-y-3 px-5 pb-5 md:hidden">{result.data.map(credit => <article key={credit.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{credit.reference}</p><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">{credit.age_days} días</span></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Venta del {formatDate(credit.sale_date)}</p><p className="mt-3 text-lg font-semibold">{formatCOP(credit.amount)}</p>{credit.comment && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-500 dark:text-slate-400">{credit.comment}</p>}</article>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr>{['Venta', 'Fecha', 'Antigüedad', 'Saldo pendiente'].map(label => <th key={label} className="px-5 py-3 last:text-right">{label}</th>)}</tr></thead><tbody>{result.data.map(credit => <tr key={credit.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-5 py-4"><p className="font-semibold">{credit.reference}</p>{credit.comment && <p className="mt-1 max-w-xs whitespace-pre-wrap break-words text-xs text-slate-500 dark:text-slate-400">{credit.comment}</p>}</td><td className="whitespace-nowrap px-5 py-4">{formatDate(credit.sale_date)}</td><td className="whitespace-nowrap px-5 py-4 text-amber-700 dark:text-amber-300">{credit.age_days} días</td><td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-brand-700 dark:text-brand-300">{formatCOP(credit.amount)}</td></tr>)}</tbody></table></div>
          </>}
      </div>
      {result && !error && !loading && <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><p>Página {page} de {result.last_page}</p><div className="flex gap-1"><button className="btn-quiet" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Anterior</button><button className="btn-quiet" disabled={page >= result.last_page} onClick={() => setPage(value => value + 1)}>Siguiente<ChevronRight size={16} /></button></div></footer>}
    </div>
  </dialog>;
}
