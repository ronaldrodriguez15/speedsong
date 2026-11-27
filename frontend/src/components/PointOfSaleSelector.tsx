import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRef, type KeyboardEvent } from "react";
import { Store } from "lucide-react";

export const pointsOfSale = [
  { id: "bodega", name: "Bodega" }, { id: "villa", name: "Villa" }, { id: "local", name: "Local" },
  { id: "bmanga", name: "Bucaramanga" }, { id: "cucuta", name: "Cúcuta" },
] as const;

export function useAllowedPoints() {
  const { user } = useAuth();
  return useMemo(() => pointsOfSale.filter(point => user?.is_admin || user?.point_ids?.includes(point.id)), [user?.is_admin, user?.point_ids]);
}

export function PointOfSaleSelector({ selected, onChange, idPrefix = "receivables", includeAll = false }: { selected: string; onChange: (point: string) => void; idPrefix?: string; includeAll?: boolean }) {
  const pointsOfSale = useAllowedPoints();
  const points = includeAll ? [{ id: "all", name: "Todos los puntos" }, ...pointsOfSale] : pointsOfSale;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % points.length : event.key === "ArrowLeft" ? (index + points.length - 1) % points.length : event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    onChange(points[next].id);
    buttons.current[next]?.focus();
  }
  return <div role="tablist" aria-label="Puntos de venta" className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
    {points.map((point, index) => <button type="button" role="tab" key={point.id} ref={element => { buttons.current[index] = element; }}
      id={`${idPrefix}-tab-${point.id}`} aria-controls={`${idPrefix}-panel`} aria-selected={point.id === selected} tabIndex={point.id === selected ? 0 : -1}
      onClick={() => onChange(point.id)} onKeyDown={event => navigate(event, index)}
      className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${point.id === selected ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}><Store size={16} />{point.name}</button>)}
  </div>;
}
