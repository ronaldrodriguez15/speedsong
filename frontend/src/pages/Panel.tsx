import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  RefreshCw,
  Boxes,
  Wallet,
  TrendingUp,
  ClipboardCheck,
} from "lucide-react";
import { formatCurrency } from "../lib/utils";
import {
  PointOfSaleSelector,
  useAllowedPoints,
} from "../components/PointOfSaleSelector";
import { loadPanelMetric, type PanelMetric, type PanelState } from "../services/panelLoader";
import { useAuth } from "../contexts/AuthContext";

const periods = [
  { id: "today", label: "Hoy", description: "de hoy" },
  { id: "yesterday", label: "Ayer", description: "de ayer" },
  {
    id: "last7",
    label: "Últimos 7 días",
    description: "de los últimos 7 días",
  },
  {
    id: "last30",
    label: "Últimos 30 días",
    description: "de los últimos 30 días",
  },
] as const;
type State = PanelState;
export function Panel() {
  const { user } = useAuth();
  const pointsOfSale = useAllowedPoints();
  const canViewSales = pointsOfSale.length > 0;
  const [point, setPoint] = useState("all");
  const [period, setPeriod] = useState<(typeof periods)[number]["id"]>("today");
  const periodDescription = periods.find(
    (item) => item.id === period,
  )!.description;
  const [refresh, setRefresh] = useState(0);
  const [sales, setSales] = useState<State>({ loading: true });
  const [credit, setCredit] = useState<State>({ loading: true });
  const [top, setTop] = useState<State>({ loading: true });
  const cache = useRef(new Map<string, State>());
  useEffect(() => {
    const controller = new AbortController();
    const sources = point === "all" ? pointsOfSale : pointsOfSale.filter(source => source.id === point);
    const load = async (metric: PanelMetric, setter: (state: State) => void) => {
      const key = JSON.stringify([user?.id, sources.map(source => source.id), period, metric]);
      const previous = cache.current.get(key);
      setter({ ...previous, loading: true, error: undefined, note: "Consultando puntos de venta…" });
      const result = await loadPanelMetric(metric, sources, period, point === "all", controller.signal,
        note => { if (!controller.signal.aborted) setter({ ...previous, loading: true, note }); });
      if (controller.signal.aborted) return;
      if (result.data) cache.current.set(key, result);
      setter(result.error && previous?.data ? { ...result, data: previous.data, note: "Se conserva la última consulta correcta; no se pudo actualizar." } : result);
    };
    void load("sales", setSales);
    void load("receivables", setCredit);
    void load("top-products", setTop);
    return () => controller.abort();
  }, [point, period, refresh, pointsOfSale, user?.id]);
  const cards = [
    ...(canViewSales
      ? [
          {
            label: `Ventas netas ${periodDescription}`,
            value: sales.data ? formatCurrency(sales.data.total) : "—",
            state: sales,
            href: user?.is_admin ? "/cierre" : "/",
            icon: ClipboardCheck,
          },
          {
            label: `Operaciones ${periodDescription}`,
            value: sales.data?.sale_count ?? "—",
            state: sales,
            href: user?.is_admin ? "/cierre" : "/",
            icon: TrendingUp,
          },
        ]
      : []),
    {
      label: "Cartera pendiente",
      value: credit.data ? formatCurrency(credit.data.summary.amount) : "—",
      state: credit,
      href: "/cartera",
      icon: Wallet,
    },
    {
      label:
        point === "all"
          ? "Clientes por sede con créditos"
          : "Clientes con créditos",
      value: credit.data?.summary.customer_count ?? "—",
      state: credit,
      href: "/cartera",
      icon: Wallet,
    },
  ];
  return (
    <div className="space-y-5 text-slate-800 dark:text-slate-100">
      <div
        role="group"
        aria-label="Período del panel"
        className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50 sm:flex sm:flex-wrap"
      >
        {periods.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={period === item.id}
            onClick={() => setPeriod(item.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${period === item.id ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <PointOfSaleSelector
        selected={point}
        onChange={setPoint}
        idPrefix="panel"
        includeAll
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {point === "all"
              ? "Consolidado de todos los puntos de venta"
              : pointsOfSale.find((source) => source.id === point)?.name}
          </h2>
          {point === "all" && (
            <p className="mt-1 text-sm text-slate-500">
              Consolidado de {pointsOfSale.length} sedes. La cartera suma las
              sedes con datos. Los clientes se cuentan por sede y pueden
              repetirse entre puntos.
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={
            credit.loading || top.loading || (!!canViewSales && sales.loading)
          }
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>
      <div
        id="panel-panel"
        role="tabpanel"
        aria-labelledby={"panel-tab-" + point}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.label} to={card.href} className="card p-5">
              <card.icon size={22} className="text-brand-500" />
              <p className="mt-4 text-xs text-slate-500">{card.label}</p>
              <p className="mt-2 break-words text-2xl font-bold">
                {card.state.loading && !card.state.data ? "Cargando…" : card.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {(card.state.error ? (card.state.data ? "Datos anteriores. " : "") + card.state.error : undefined) ||
                  card.state.note ||
                  (card.state.data?.updated_at
                    ? "Actualizado: " +
                      new Date(card.state.data.updated_at).toLocaleTimeString(
                        "es-CO",
                        { timeZone: "America/Bogota" },
                      )
                    : "")}
              </p>
            </Link>
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="card p-5">
            <h3 className="font-semibold">
              Productos destacados {periodDescription}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {point === "all"
                ? "Las cinco combinaciones de producto y sede con más unidades netas. Cada sede se muestra por separado."
                : "Por unidades netas vendidas, descontando devoluciones."}
            </p>
            {top.loading ? (
              <p role="status" className="py-8 text-sm text-slate-500">
                {top.note || "Consultando ventas…"}
              </p>
            ) : top.error ? (
              <p role="alert" className="py-5 text-sm text-amber-600">
                {top.error}
              </p>
            ) : !top.data?.products.length ? (
              <p className="py-8 text-sm text-slate-500">
                No hay productos vendidos en este período.
              </p>
            ) : (
              <ol className="mt-5 space-y-4">
                {top.data.products
                  .slice(0, 5)
                  .map((product: any, i: number) => (
                    <li key={product.id} className="flex items-start gap-3">
                      <span className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-brand-500 dark:bg-blue-950">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.sku || "Sin referencia"}
                          {product.point_name && ` · ${product.point_name}`}
                        </p>
                      </div>
                      <span className="text-sm font-bold">
                        {product.units.toLocaleString("es-CO")} uds.
                      </span>
                    </li>
                  ))}
              </ol>
            )}
            <Link
              className="mt-5 inline-flex items-center gap-2 text-sm text-brand-500"
              to="/mas-vendidos"
            >
              Ver top 10 y otros periodos <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="card p-5">
            <h3 className="font-semibold">
              {canViewSales
                ? `Medios de pago ${periodDescription}`
                : "Gestiona tu negocio"}
            </h3>
            {canViewSales && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["cash", "Efectivo"],
                  ["transfer", "Transferencia"],
                  ["nequi", "Nequi"],
                  ["credit", "Línea de crédito"],
                ].map(([key, label]) => (
                  <div
                    key={key}
                    className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-2 break-words font-bold">
                      {sales.loading
                        ? "…"
                        : sales.data
                          ? formatCurrency(sales.data.payments[key])
                          : "No disponible"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 space-y-3">
              {[
                {
                  href: "/inventario",
                  title: "Consultar existencias por sede",
                  icon: Boxes,
                },
                {
                  href: "/cartera",
                  title: "Revisar créditos y descargar reportes",
                  icon: Wallet,
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 text-sm dark:border-slate-700"
                >
                  <item.icon size={20} className="text-brand-500" />
                  <span className="flex-1">{item.title}</span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
