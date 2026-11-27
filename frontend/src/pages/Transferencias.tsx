import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Check, ChevronDown, LoaderCircle, Package, RotateCcw, Search, Store, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pointsOfSale } from '../components/PointOfSaleSelector';
import { api, apiError } from '../services/api';
import type { InventoryResult } from '../services/inventoryExcel';

type Product = InventoryResult['rows'][number];
const quantity = (value: number | null) => value === null ? 'Sin dato' : value.toLocaleString('es-CO', { maximumFractionDigits: 6 });
const pointName = (id: string) => pointsOfSale.find(point => point.id === id)?.name;

function ProductPicker({ side, point, otherPoint, selected, onPoint, onSelect }: {
  side: 'salida' | 'entrada'; point: string; otherPoint: string; selected: Product | null;
  onPoint: (point: string) => void; onSelect: (product: Product | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<InventoryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  const outgoing = side === 'salida';
  const Icon = outgoing ? ArrowUpFromLine : ArrowDownToLine;
  async function find(event?: FormEvent, page = 1) {
    event?.preventDefault();
    if (!point || !search.trim()) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(''); onSelect(null);
    try {
      const response = await api.get<{ data: InventoryResult }>('/transfers/products', {
        params: { point, other_point: otherPoint || undefined, search: search.trim(), page },
        signal: controller.signal, feedback: false, timeout: 60000,
      });
      if (!controller.signal.aborted) setResult(response.data.data);
    } catch (error) {
      if (!controller.signal.aborted) { setError(apiError(error)); setResult(null); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <section className="card min-w-0 overflow-hidden">
    <header className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
      <span className={`rounded-2xl p-3 ${outgoing ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}><Icon size={23} /></span>
      <div><h2 className="text-lg font-semibold">Producto de {side}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{outgoing ? 'Busca el producto en la sede de origen.' : 'Busca el producto en la sede de destino.'}</p></div>
    </header>
    <div className="space-y-5 p-5 sm:p-6">
      <label className="block text-sm font-medium" htmlFor={`${side}-point`}>Punto de venta de {outgoing ? 'origen' : 'destino'}
        <span className="relative mt-2 block"><Store size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
          <select id={`${side}-point`} value={point} onChange={event => onPoint(event.target.value)} className="field appearance-none pl-10 pr-10">
            <option value="">Selecciona una sede</option>
            {pointsOfSale.map(item => <option key={item.id} value={item.id} disabled={item.id === otherPoint}>{item.name}{item.id === otherPoint ? ' · seleccionada en el otro lado' : ''}</option>)}
          </select><ChevronDown size={17} className="pointer-events-none absolute right-3 top-3.5 text-slate-400" />
        </span>
      </label>
      <form onSubmit={find} className="space-y-2">
        <label htmlFor={`${side}-reference`} className="text-sm font-medium">Referencia del producto</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input ref={input} id={`${side}-reference`} className="field min-w-0 flex-1" placeholder="Ej. SG 129C" maxLength={100} required disabled={!point} value={search} onChange={event => {
            request.current?.abort(); setLoading(false); setSearch(event.target.value); setResult(null); setError(''); onSelect(null);
          }} />
          <button type="submit" className="btn-primary justify-center" disabled={!point || !search.trim() || loading}>{loading ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={18} />}Buscar</button>
        </div>
      </form>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"><p>{error}</p><button type="button" className="mt-2 font-semibold underline" onClick={() => void find()}>Reintentar búsqueda</button></div>}
      {loading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle size={20} className="animate-spin" />Buscando en {pointName(point)}…</p>
        : selected ? <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-800 dark:bg-brand-900/30">
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300"><Check size={17} />Producto seleccionado</span><button type="button" className="icon-button" aria-label={`Quitar producto de ${side}`} onClick={() => { onSelect(null); input.current?.focus(); }}><X size={17} /></button></div>
          <h3 className="mt-3 break-words font-semibold">{selected.name}</h3><p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">{selected.reference || 'Sin referencia'} · {pointName(point)}</p>
          <div className="mt-4 flex items-center justify-between border-t border-brand-100 pt-3 dark:border-brand-800"><span className="text-sm">Existencias actuales</span><strong className="text-lg tabular-nums">{quantity(selected.total)}</strong></div>
        </div>
        : result ? <div className="space-y-3">
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">{result.rows.length ? 'Selecciona el producto que corresponde.' : 'No se encontraron productos. Revisa la referencia o prueba otra búsqueda.'}</p>
          <div className="max-h-80 space-y-2 overflow-y-auto">{result.rows.map(product => <button type="button" key={product.id} onClick={() => onSelect(product)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:hover:bg-brand-900/30">
            <span className="min-w-0"><span className="block break-words font-medium">{product.name}</span><span className="mt-1 block break-words text-sm text-slate-500 dark:text-slate-400">{product.reference || 'Sin referencia'}{product.category ? ` · ${product.category}` : ''}</span></span>
            <span className="shrink-0 text-right"><span className="block font-semibold tabular-nums">{quantity(product.total)}</span><span className="text-xs text-slate-500 dark:text-slate-400">existencias</span></span>
          </button>)}</div>
          {(result.page > 1 || result.has_more) && <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-slate-500 dark:text-slate-400">Página {result.page}</span><div className="flex gap-2"><button type="button" className="btn-quiet" disabled={result.page === 1} onClick={() => void find(undefined, result.page - 1)}>Anterior</button><button type="button" className="btn-quiet" disabled={!result.has_more} onClick={() => void find(undefined, result.page + 1)}>Siguiente</button></div></div>}
          <p className="text-xs text-slate-500 dark:text-slate-400">Consultado: {new Date(result.updated_at).toLocaleString('es-CO')}</p>
        </div>
        : !error && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700"><Package size={30} className="mx-auto mb-3 text-slate-300 dark:text-slate-500" /><p className="text-sm text-slate-500 dark:text-slate-400">{point ? 'Escribe una referencia para encontrar el producto.' : 'Selecciona primero el punto de venta.'}</p></div>}
    </div>
  </section>;
}

export function Transferencias() {
  const { user } = useAuth();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [outgoing, setOutgoing] = useState<Product | null>(null);
  const [incoming, setIncoming] = useState<Product | null>(null);
  const [version, setVersion] = useState(0);
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Selecciona origen y destino</h2><p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Encuentra la referencia de salida y la referencia de entrada en dos puntos de venta diferentes.</p></div>
      <button type="button" className="btn-quiet" onClick={() => { setOrigin(''); setDestination(''); setOutgoing(null); setIncoming(null); setVersion(v => v + 1); }}><RotateCcw size={17} />Limpiar selección</button></div>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <ProductPicker key={`out-${origin}-${version}`} side="salida" point={origin} otherPoint={destination} selected={outgoing} onSelect={setOutgoing} onPoint={point => { if (point && point === destination) return; setOrigin(point); setOutgoing(null); }} />
      <ProductPicker key={`in-${destination}-${version}`} side="entrada" point={destination} otherPoint={origin} selected={incoming} onSelect={setIncoming} onPoint={point => { if (point && point === origin) return; setDestination(point); setIncoming(null); }} />
    </div>
    {outgoing && incoming && <section aria-label="Resumen de productos seleccionados" className="card p-5 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><ArrowRightLeft size={20} className="text-brand-500" />Productos seleccionados</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{[{ label: 'Salida', point: origin, product: outgoing }, { label: 'Entrada', point: destination, product: incoming }].map(item => <div key={item.label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-sm font-medium text-brand-600 dark:text-brand-300">{item.label} · {pointName(item.point)}</p><p className="mt-2 break-words font-semibold">{item.product.name}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.product.reference || 'Sin referencia'}</p></div>)}</div></section>}
  </div>;
}
