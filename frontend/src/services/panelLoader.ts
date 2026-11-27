import { api, apiError } from './api';
import { consolidatePanel } from './panelSummary';

export type PanelMetric = 'sales' | 'receivables' | 'top-products';
export type PanelState = { loading: boolean; data?: any; error?: string; note?: string };
type Source = { id: string; name: string };

export async function loadPanelMetric(metric: PanelMetric, sources: readonly Source[], period: string,
  consolidated: boolean, signal: AbortSignal, progress: (note: string) => void): Promise<PanelState> {
  if (!sources.length) return { loading: false, error: 'No hay puntos de venta disponibles para esta consulta.' };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  // This deadline includes retries and prevents a report from waiting indefinitely.
  const deadline = setTimeout(abort, 70000);
  let completed = 0;
  try {
    const results = await Promise.allSettled(sources.map(async source => {
      try {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await api.get(`/points-of-sale/${source.id}/${metric}`, {
              params: metric === 'receivables' ? undefined : { period },
              signal: controller.signal, feedback: false, timeout: 60000,
              // The panel handles its own bounded retries; do not wait minutes on 429.
              rateLimitRetries: 2,
            });
            break;
          } catch (error: any) {
            const status = error.response?.status;
            if (controller.signal.aborted || attempt || (status && ![502, 503, 504].includes(status))) throw error;
          }
        }
        const data = metric === 'receivables' ? response!.data : response!.data.data;
        const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
        const valid = metric === 'sales' ? numeric(data?.total) && numeric(data?.sale_count) && data?.payments
          : metric === 'receivables' ? numeric(data?.summary?.amount) && numeric(data?.summary?.customer_count)
          : Array.isArray(data?.products) && data.products.every((p: any) => p && typeof p.name === 'string' && numeric(p.units));
        if (!valid) throw new Error('El servidor devolvió información incompleta.');
        return { point: source.id, name: source.name, data };
      } finally {
        completed++;
        if (!signal.aborted) progress(`Consultando sedes: ${completed} de ${sources.length} completadas.`);
      }
    }));
    const missing = sources.filter((_, i) => results[i].status === 'rejected');
    const rows = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    if (missing.length) {
      const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
      const reason = controller.signal.aborted ? 'La consulta excedió el tiempo de espera.' : apiError(failure.reason);
      if (metric === 'receivables' && rows.length) return {
        loading: false, data: consolidated ? consolidatePanel(metric, rows) : rows[0].data,
        note: `Cartera parcial: ${rows.length} de ${sources.length} sedes. Faltan ${missing.map(p => p.name).join(', ')}.`,
      };
      return { loading: false, error: `No se pudo cargar ${missing.map(p => p.name).join(', ')}. ${reason} Reintenta la consulta.` };
    }
    return { loading: false, data: consolidated ? consolidatePanel(metric, rows) : rows[0].data,
      note: metric === 'receivables' ? `Cartera actual · ${rows.length} sedes consultadas` : undefined };
  } catch (error) {
    return { loading: false, error: apiError(error) + ' Reintenta la consulta.' };
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener('abort', abort);
  }
}
