import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Boxes, Download, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReferenceSearch } from '../components/ReferenceSearch';
import { api } from '../services/api';
import type { InventoryResult } from '../services/inventoryExcel';
import { useAllowedPoints } from '../components/PointOfSaleSelector';

const quantity = (n: number | null) => n === null ? 'Sin dato' : n.toLocaleString('es-CO', { maximumFractionDigits: 6 });
export function Inventario() {
  const pointsOfSale = useAllowedPoints();
  const [mode, setMode] = useState<'all' | 'search'>('all');
  function changeMode(value: 'all' | 'search') {
    request.current?.abort(); setMode(value); setData(null); setError(''); setLoading(false); setPage(1);
  }
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
  async function consult(event?: FormEvent, nextPage = 1, referenceSearch?: string) {
    event?.preventDefault();
    request.current?.abort();
    const query = !event && data && referenceSearch === undefined ? { search: data.search, field: 'product_id' } : { search: referenceSearch ?? '', field: 'product_id' };
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
  const pages = data?.last_page;
  return <div className="space-y-5 text-slate-800 dark:text-slate-100">
    <div aria-label="Punto de venta" className="flex gap-2 overflow-x-auto pb-2">{tabs.map(tab => <button key={tab.id} type="button" aria-pressed={point === tab.id} onClick={() => selectPoint(tab.id)} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${point === tab.id ? 'bg-brand-500 text-white shadow-sm' : 'border border-blue-100 bg-white text-slate-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{tab.name}</button>)}</div>
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <h2 className="text-lg font-semibold">{point === 'all' ? 'Inventario de todas las sedes' : `Inventario de ${tabs.find(tab => tab.id === point)?.name}`}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Explora todo el catálogo o encuentra varios productos en una sola búsqueda.</p>
      <div role="group" aria-label="Tipo de consulta" className="mt-5 grid gap-2 rounded-2xl bg-slate-50 p-1.5 dark:bg-slate-800/60 sm:grid-cols-2">
        {[{ id: 'all' as const, label: 'Inventario general', icon: Boxes }, { id: 'search' as const, label: 'Buscar referencias', icon: Search }].map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => changeMode(id)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${mode === id ? 'bg-white text-brand-700 shadow-sm dark:bg-brand-900/60 dark:text-brand-200' : 'text-slate-500 hover:text-brand-600 dark:text-slate-400'}`}><Icon size={18}/>{label}</button>)}
      </div>
      <div className="mt-5">{mode === 'all' ? <form onSubmit={consult}><div className="flex flex-col gap-4 rounded-2xl bg-brand-50 p-5 dark:bg-brand-900/30 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-brand-700 dark:text-brand-200">Todos tus productos, en un solo lugar</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consulta el catálogo completo y sus existencias. No necesitas escribir una referencia.</p></div><button disabled={loading} className="btn-primary shrink-0 justify-center">{loading ? <Loader2 size={18} className="animate-spin"/> : <Boxes size={18}/>}Ver inventario general</button></div></form> : <ReferenceSearch loading={loading} onSearch={value => void consult(undefined, 1, value)} />}</div>

    </section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {loading && <div role="status" className="flex justify-center gap-3 py-16 text-sm text-slate-500"><Loader2 className="animate-spin" size={20}/>{point === 'all' ? 'Consultando las cinco sedes…' : 'Consultando los productos de la sede…'}</div>}
    {!loading && !data && !error && <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400"><Boxes size={42} className="mx-auto mb-4 text-brand-300"/><p>{mode === 'all' ? 'Pulsa «Ver inventario general» para explorar los productos de las sedes seleccionadas.' : 'Agrega las referencias que necesitas y consulta sus existencias juntas.'}</p></div>}
    {data && <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">{data.total ?? data.rows.length} {data.total === null ? 'productos en esta página' : data.points.length === 1 ? 'registros en catálogo' : 'productos'} · {data.points.length === 1 ? data.points[0].name : '5 sedes'}</h2><p className="mt-1 text-xs text-slate-500">{data.search ? `Búsqueda: ${data.search}` : 'Todo el inventario'} · {new Date(data.updated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p></div><button onClick={download} disabled={exporting || !data.rows.length} className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-brand-600 disabled:opacity-50 dark:bg-blue-950 dark:text-blue-300">{exporting ? <Loader2 size={17} className="animate-spin"/> : <Download size={17}/>}Descargar Excel</button></div>
      {!data.rows.length ? <p className="p-12 text-center text-sm text-slate-500">No se encontraron productos para esta búsqueda.</p> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800"><tr><th className="p-4 text-left">Producto</th><th className="p-4 text-left">Referencia</th>{data.points.map(p => <th key={p.id} className="p-4 text-right">{p.name}</th>)}<th className="p-4 text-right text-brand-600">Total</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="max-w-xs p-4"><p className="font-medium">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.category || 'Sin categoría'}</p></td><td className="p-4 text-sm">{row.reference || 'Sin referencia'}</td>{data.points.map(p => <td key={p.id} className="p-4 text-right tabular-nums">{quantity(row.quantities[p.id])}</td>)}<td className="bg-blue-50/50 p-4 text-right font-bold tabular-nums text-brand-600 dark:bg-blue-950/30 dark:text-blue-300">{quantity(row.total)}</td></tr>)}</tbody></table></div>
        <div className="space-y-3 px-4 md:hidden">{data.rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="break-words text-sm font-semibold">{row.name}</h3><p className="mt-1 text-xs text-slate-500">{row.reference || 'Sin referencia · sin unificar'}</p><p className="mt-2 text-xs text-slate-500">{row.category || 'Sin categoría'}</p><dl className="mt-4 grid grid-cols-2 gap-3">{data.points.map(p => <div key={p.id}><dt className="text-xs text-slate-500">{p.name}</dt><dd className="mt-1 text-sm font-medium">{quantity(row.quantities[p.id])}</dd></div>)}<div className="rounded-lg bg-blue-50 p-2 text-brand-600 dark:bg-blue-950 dark:text-blue-300"><dt className="text-xs">Total</dt><dd className="font-bold">{quantity(row.total)}</dd></div></dl></article>)}</div>
        <div className="flex items-center justify-between gap-2 p-5 text-xs text-slate-500"><span>Página {page}{pages ? ` de ${pages}` : ''}</span><div className="flex gap-2"><button aria-label="Página anterior" disabled={loading || page === 1} onClick={() => consult(undefined, page-1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft size={17}/></button><button aria-label="Página siguiente" disabled={loading || !data.has_more} onClick={() => consult(undefined, page+1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight size={17}/></button></div></div>
      </>}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800">{data.points.length === 1 ? 'El total corresponde al catálogo de la sede; los servicios y eliminados no se muestran.' : `Unificado por ${data.field === 'product_id' ? 'referencia' : 'código de barras'}. Los productos sin ese código se muestran por separado.`} Excel incluye todos los resultados. Datos conservados hasta 5 minutos.</p>
    </section>}
  </div>;
}
