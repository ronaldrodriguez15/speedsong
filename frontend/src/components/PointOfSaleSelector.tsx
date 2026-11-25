import { useRef, type KeyboardEvent } from "react";
import { Store } from "lucide-react";

export const pointsOfSale = [
  { id: "bodega", name: "Bodega" }, { id: "villa", name: "Villa" }, { id: "local", name: "Local" },
  { id: "bmanga", name: "Bucaramanga" }, { id: "cucuta", name: "Cúcuta" },
] as const;

export function PointOfSaleSelector({ selected, onChange, idPrefix = "receivables" }: { selected: string; onChange: (point: string) => void; idPrefix?: string }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % 5 : event.key === "ArrowLeft" ? (index + 4) % 5 : event.key === "Home" ? 0 : event.key === "End" ? 4 : null;
    if (next === null) return;
    event.preventDefault();
    onChange(pointsOfSale[next].id);
    buttons.current[next]?.focus();
  }
  return <div role="tablist" aria-label="Puntos de venta" className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
    {pointsOfSale.map((point, index) => <button type="button" role="tab" key={point.id} ref={element => { buttons.current[index] = element; }}
      id={`${idPrefix}-tab-${point.id}`} aria-controls={`${idPrefix}-panel`} aria-selected={point.id === selected} tabIndex={point.id === selected ? 0 : -1}
      onClick={() => onChange(point.id)} onKeyDown={event => navigate(event, index)}
      className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${point.id === selected ? "bg-brand-500 text-white shadow-sm" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"}`}><Store size={16} />{point.name}</button>)}
  </div>;
}
