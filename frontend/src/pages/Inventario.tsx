import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Boxes, Download, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import type { InventoryResult } from '../services/inventoryExcel';
import { pointsOfSale } from '../components/PointOfSaleSelector';

const quantity = (n: number | null) => n === null ? 'Sin dato' : n.toLocaleString('es-CO', { maximumFractionDigits: 6 });
export function Inventario() {
  const [search, setSearch] = useState('');
  const [field, setField] = useState('product_id');
  const [point, setPoint] = useState('all');
  const tabs = [{ id: 'all', name: 'Todas las sedes' }, ...pointsOfSale];
  function selectPoint(id: string) {
    request.current?.abort(); setPoint(id); setData(null); setError(''); setLoading(false); setPage(1);
  }
  const [data, setData] = useState<InventoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function consult(event?: FormEvent, nextPage = 1) {
    event?.preventDefault(); request.current?.abort();
    const query = !event && data ? { search: data.search, field: data.field } : { search: search.trim(), field };
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(''); setData(null); setPage(nextPage);
    try {
      const response = await api.get('/inventory', { params: { ...query, point, page: nextPage }, signal: controller.signal, timeout: 90000, feedback: false });
      if (!controller.signal.aborted) setData(response.data.data);
    } catch (e: any) { if (!controller.signal.aborted) setError(e.response?.data?.message || 'No se pudo consultar el inventario. Intenta nuevamente.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function download() {
    if (!data) return;
    setExporting(true); setError('');
    try { const response = await api.get('/inventory', { params: { search: data.search, field: data.field, point: data.points.length === 1 ? data.points[0].id : 'all', export: 1 }, timeout: 90000, feedback: false }); await (await import('../services/inventoryExcel')).exportInventory(response.data.data); }
    catch { setError('No fue posible generar el Excel. Intenta nuevamente.'); }
    finally { setExporting(false); }
  }
  const pages = data?.last_page || 1;
  return <div className="space-y-5 text-slate-800 dark:text-slate-100">
    <div aria-label="Punto de venta" className="flex gap-2 overflow-x-auto pb-2">{tabs.map(tab => <button key={tab.id} type="button" aria-pressed={point === tab.id} onClick={() => selectPoint(tab.id)} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${point === tab.id ? 'bg-brand-500 text-white shadow-sm' : 'border border-blue-100 bg-white text-slate-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{tab.name}</button>)}</div>
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <h2 className="text-lg font-semibold">{point === 'all' ? 'Un producto, todas las sedes' : `Inventario de ${tabs.find(tab => tab.id === point)?.name}`}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consulta las existencias por referencia o código de barras. Deja la búsqueda vacía para consultar todo el inventario.</p>
      <form onSubmit={consult} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <select aria-label="Buscar por" value={field} onChange={e => setField(e.target.value)} className="rounded-xl border border-slate-200 bg-transparent px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="product_id">Referencia</option><option value="item_number">Código de barras</option></select>
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input aria-label="Referencia o código del producto" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} placeholder="Ej. SG 129C" className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700"/></div>
        <button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{loading ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}Consultar</button>
      </form>
    </section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {loading && <div role="status" className="flex justify-center gap-3 py-16 text-sm text-slate-500"><Loader2 className="animate-spin" size={20}/>{point === 'all' ? 'Consultando las cinco sedes…' : 'Consultando los productos de la sede…'}</div>}
    {!loading && !data && !error && <div className="py-16 text-center text-slate-400"><Boxes size={42} className="mx-auto mb-4 text-brand-300"/><p>Encuentra un producto y compara sus existencias.</p></div>}
    {data && <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">{data.total} {data.points.length === 1 ? 'registros en catálogo' : 'productos'} · {data.points.length === 1 ? data.points[0].name : '5 sedes'}</h2><p className="mt-1 text-xs text-slate-500">{data.search ? `Búsqueda: ${data.search}` : 'Todo el inventario'} · {new Date(data.updated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p></div><button onClick={download} disabled={exporting || !data.rows.length} className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-brand-600 disabled:opacity-50 dark:bg-blue-950 dark:text-blue-300">{exporting ? <Loader2 size={17} className="animate-spin"/> : <Download size={17}/>}Descargar Excel</button></div>
      {!data.rows.length ? <p className="p-12 text-center text-sm text-slate-500">No se encontraron productos para esta búsqueda.</p> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800"><tr><th className="p-4 text-left">Producto</th><th className="p-4 text-left">Referencia</th>{data.points.map(p => <th key={p.id} className="p-4 text-right">{p.name}</th>)}<th className="p-4 text-right text-brand-600">Total</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="max-w-xs p-4"><p className="font-medium">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.category || 'Sin categoría'}</p><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer text-brand-500">Detalles</summary><p className="mt-2 whitespace-pre-wrap">{row.description || 'Sin descripción'}</p><p>Código de barras: {row.barcode || 'No registrado'}</p></details></td><td className="p-4 text-sm">{row.reference || 'Sin referencia'}</td>{data.points.map(p => <td key={p.id} className="p-4 text-right tabular-nums">{quantity(row.quantities[p.id])}</td>)}<td className="bg-blue-50/50 p-4 text-right font-bold tabular-nums text-brand-600 dark:bg-blue-950/30 dark:text-blue-300">{quantity(row.total)}</td></tr>)}</tbody></table></div>
        <div className="space-y-3 px-4 md:hidden">{data.rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="break-words text-sm font-semibold">{row.name}</h3><p className="mt-1 text-xs text-slate-500">{row.reference || 'Sin referencia · sin unificar'}</p><p className="mt-2 text-xs text-slate-500">{row.category || 'Sin categoría'}</p><details className="mt-2 text-xs"><summary>Detalles del producto</summary><p>{row.description || 'Sin descripción'}</p><p>Código: {row.barcode || 'No registrado'}</p></details><dl className="mt-4 grid grid-cols-2 gap-3">{data.points.map(p => <div key={p.id}><dt className="text-xs text-slate-500">{p.name}</dt><dd className="mt-1 text-sm font-medium">{quantity(row.quantities[p.id])}</dd></div>)}<div className="rounded-lg bg-blue-50 p-2 text-brand-600 dark:bg-blue-950 dark:text-blue-300"><dt className="text-xs">Total</dt><dd className="font-bold">{quantity(row.total)}</dd></div></dl></article>)}</div>
        <div className="flex items-center justify-between gap-2 p-5 text-xs text-slate-500"><span>Página {page} de {pages}</span><div className="flex gap-2"><button aria-label="Página anterior" disabled={page === 1} onClick={() => consult(undefined, page-1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft size={17}/></button><button aria-label="Página siguiente" disabled={page === pages} onClick={() => consult(undefined, page+1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight size={17}/></button></div></div>
      </>}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">{data.points.length === 1 ? 'El total corresponde al catálogo de la sede; los servicios y eliminados no se muestran.' : `Unificado por ${data.field === 'product_id' ? 'referencia' : 'código de barras'}. Los productos sin ese código se muestran por separado.`} Excel incluye todos los resultados. Datos conservados hasta 5 minutos.</p>
    </section>}
  </div>;
}
