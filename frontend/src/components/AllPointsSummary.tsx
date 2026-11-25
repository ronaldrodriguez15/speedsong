import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../lib/utils';
import { pointsOfSale } from './PointOfSaleSelector';

type Summary = {
  total: number; sale_count: number; updated_at: string;
  payments: Record<string, number>; payment_difference: number;
  summary: { amount: number; customer_count: number; sale_count: number };
};
type Row = { id: string; name: string; data: Summary };
const periods = [{ id: 'today', label: 'Hoy' }, { id: 'yesterday', label: 'Ayer' }, { id: 'last7', label: 'Últimos 7 días' }, { id: 'last30', label: 'Últimos 30 días' }];
const methods = [{ id: 'cash', label: 'Efectivo' }, { id: 'transfer', label: 'Transferencia' }, { id: 'nequi', label: 'Nequi' }, { id: 'credit', label: 'Línea de crédito' }, { id: 'other', label: 'Otros medios' }];

export function AllPointsSummary({ metric, onSelect, period = 'today', onPeriodChange }: {
  metric: 'sales' | 'receivables'; onSelect: (point: string) => void;
  period?: string; onPeriodChange?: (period: string) => void;
}) {
  const [result, setResult] = useState<{ key: string; rows: Row[]; missing: string[] }>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [day, setDay] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
  const key = `${metric}:${period}:${day}:${attempt}`;
  useEffect(() => {
    const timer = window.setInterval(() => setDay(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void Promise.allSettled(pointsOfSale.map(async point => {
      const response = await api.get(`/points-of-sale/${point.id}/${metric}`, {
        params: metric === 'sales' ? { period } : undefined,
        signal: controller.signal, feedback: false, timeout: 90000,
      });
      return { ...point, data: metric === 'sales' ? response.data.data : response.data } as Row;
    })).then(results => {
      if (controller.signal.aborted) return;
      setResult({ key, rows: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
        missing: pointsOfSale.filter((_, i) => results[i].status === 'rejected').map(point => point.name) });
      setLoading(false);
    });
    return () => controller.abort();
  }, [key, metric, period]);
  const visible = result?.key === key ? result : undefined;
  const busy = loading || !visible;
  const rows = visible?.rows ?? [];
  const sales = metric === 'sales';
  const sum = (get: (data: Summary) => number) => rows.reduce((total, row) => total + get(row.data), 0);
  const cards = [
    { label: sales ? 'Ventas netas' : 'Saldo pendiente · Más de 60 días', value: formatCurrency(sum(data => sales ? data.total : data.summary.amount)) },
    { label: sales ? 'Operaciones' : 'Ventas pendientes', value: sum(data => sales ? data.sale_count : data.summary.sale_count).toLocaleString('es-CO') },
    ...(!sales ? [{ label: 'Clientes por sede', value: sum(data => data.summary.customer_count).toLocaleString('es-CO') }] : []),
  ];
  return <div className="space-y-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Todos los puntos</h3><button type="button" disabled={busy} className="btn-quiet" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>Actualizar</button></div>
    {sales && <div role="group" aria-label="Período de ventas" className="flex flex-wrap gap-2">{periods.map(item => <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => onPeriodChange?.(item.id)} className={period === item.id ? 'btn-primary' : 'btn-quiet'}>{item.label}</button>)}</div>}
    {busy ? <p role="status" className="py-10 text-sm text-slate-500">Consultando todos los puntos de venta…</p> : <>
      <p className="text-sm text-slate-500 dark:text-slate-400">{rows.length} de {pointsOfSale.length} sedes incluidas.{!sales && ' Cartera actual mayor a 60 días. Un cliente puede aparecer en varias sedes.'}</p>
      {!!visible?.missing.length && <p className="text-sm text-amber-700 dark:text-amber-300">{rows.length ? 'El total incluye únicamente las sedes consultadas.' : 'No se obtuvieron datos. Intenta actualizar.'} Sin datos: {visible.missing.join(', ')}.</p>}
      {!!rows.length && <>
        <div className="grid gap-3 sm:grid-cols-3">{cards.map(card => <div key={card.label} className="rounded-2xl bg-brand-50 p-5 dark:bg-brand-900/40"><p className="text-sm text-slate-500 dark:text-slate-400">{card.label}</p><p className="mt-2 break-words text-2xl font-bold">{card.value}</p></div>)}</div>
        {sales && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{methods.map(method => <div key={method.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-700"><p className="text-sm text-slate-500 dark:text-slate-400">{method.label}</p><p className="mt-2 break-words font-semibold">{formatCurrency(sum(data => data.payments[method.id] ?? 0))}</p></div>)}</div>}
        {sales && rows.some(row => row.data.payment_difference !== 0) && <p className="text-sm text-amber-700 dark:text-amber-300">Hay diferencias entre ventas y pagos en: {rows.filter(row => row.data.payment_difference !== 0).map(row => row.name).join(', ')}. Revisa el detalle de cada sede.</p>}
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="p-4">Punto de venta</th><th className="p-4">{sales ? 'Operaciones' : 'Clientes'}</th><th className="p-4">{sales ? 'Ventas netas' : 'Saldo pendiente'}</th><th className="p-4">Consulta</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-4 font-semibold">{row.name}</td><td className="p-4">{sales ? row.data.sale_count : row.data.summary.customer_count}</td><td className="whitespace-nowrap p-4">{formatCurrency(sales ? row.data.total : row.data.summary.amount)}</td><td className="p-4"><button type="button" onClick={() => onSelect(row.id)} className="btn-quiet" aria-label={`Ver detalle de ${row.name}`}>{sales ? 'Ver ventas' : 'Ver clientes'}</button></td></tr>)}</tbody></table></div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Consulta más antigua: {new Date(Math.min(...rows.map(row => Date.parse(row.data.updated_at)))).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · Colombia</p>
      </>}
    </>}
  </div>;
}
