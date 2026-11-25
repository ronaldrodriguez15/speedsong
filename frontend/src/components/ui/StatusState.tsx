import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

interface StatusStateProps {
  type: "loading" | "error" | "empty";
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function StatusState({ type, title, description, onRetry }: StatusStateProps) {
  const defaults = {
    loading: ["Cargando información", "Estamos preparando los datos del módulo."],
    error: ["No pudimos cargar la información", "Intenta nuevamente en unos momentos."],
    empty: ["Todavía no hay información", "Cuando existan registros, aparecerán aquí."]
  } as const;
  const content = defaults[type];
  const Icon = type === "loading" ? LoaderCircle : type === "error" ? AlertCircle : Inbox;

  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${type === "error" ? "bg-rose-50 dark:bg-rose-950 text-rose-500" : "bg-brand-50 dark:bg-brand-900 text-brand-500 dark:text-brand-400"}`}>
        <Icon size={25} className={type === "loading" ? "animate-spin" : ""} />
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title ?? content[0]}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description ?? content[1]}</p>
      {type === "error" && onRetry && (
        <button onClick={onRetry} className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900">
          Reintentar
        </button>
      )}
    </div>
  );
}