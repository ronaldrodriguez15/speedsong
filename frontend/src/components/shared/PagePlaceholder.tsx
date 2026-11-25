import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { StatusState } from "../ui/StatusState";

interface PagePlaceholderProps {
  description: string;
  searchPlaceholder: string;
}

export function PagePlaceholder({ description, searchPlaceholder }: PagePlaceholderProps) {
  const [status, setStatus] = useState<"empty" | "loading" | "error">("empty");
  const [query, setQuery] = useState("");

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Gestión de registros</h2>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} className="field min-w-0 py-2.5 pl-9 sm:w-56" />
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
            <SlidersHorizontal size={16} /> Filtros
          </button>
        </div>
      </div>
      <StatusState
        type={status}
        onRetry={() => {
          setStatus("loading");
          window.setTimeout(() => setStatus("empty"), 500);
        }}
        title={status === "empty" && query ? "No encontramos coincidencias" : undefined}
        description={status === "empty" && query ? "Prueba con otro término de búsqueda." : undefined}
      />
      <div className="flex justify-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3">
        <button onClick={() => setStatus("empty")} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Vista vacía</button>
        <button onClick={() => setStatus("loading")} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Vista carga</button>
        <button onClick={() => setStatus("error")} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Vista error</button>
      </div>
    </section>
  );
}