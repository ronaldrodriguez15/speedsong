import axios from "axios";
import { toast, type Id } from "react-toastify";
declare module "axios" {
  interface AxiosRequestConfig {
    feedback?: false | { pending?: string; success?: string; ignoreUnauthorized?: boolean; history?: boolean };
    toastId?: Id;
    rateLimitRetries?: number;
  }
}
export interface ApiNotice { id: string; message: string; type: "success" | "error"; time: number; read: boolean; }
const baseURL = import.meta.env.URL_API_KEY.replace(/\/+$/, "");
export const api = axios.create({
  baseURL, withCredentials: true, withXSRFToken: true,
  headers: { Accept: "application/json" }, timeout: 20000,
});
function messages(method = "get", url = "") {
  if (url === "/login") return ["Iniciando sesión...", "¡Bienvenido a SpeedSong!"];
  if (url === "/logout") return ["Cerrando sesión...", "Sesión cerrada correctamente."];
  if (url === "/user") return ["Consultando perfil...", "Perfil actualizado."];
  if (method === "post") return ["Creando registro...", "Usuario creado correctamente."];
  if (method === "put" || method === "patch") return ["Guardando cambios...", "Cambios guardados correctamente."];
  if (method === "delete") return ["Eliminando registro...", "Usuario eliminado correctamente."];
  return ["Consultando información...", "Información actualizada."];
}
function publish(message: string, type: ApiNotice["type"]) {
  window.dispatchEvent(new CustomEvent<ApiNotice>("api:notice", { detail: {
    id: crypto.randomUUID(), message, type, time: Date.now(), read: false,
  }}));
}
api.interceptors.request.use(config => {
  if (config.feedback !== false && !config.signal?.aborted) {
    config.toastId = toast.loading(config.feedback?.pending || messages(config.method, config.url)[0]);
  }
  return config;
});
api.interceptors.response.use(response => {
  const { config } = response;
  if (config.feedback !== false) {
    const message = config.feedback?.success || messages(config.method, config.url)[1];
    if (config.toastId !== undefined) toast.update(config.toastId, {
      render: message, type: "success", isLoading: false, autoClose: 2400, closeButton: true,
    });
    if (config.feedback?.history !== false) publish(message, "success");
  }
  return response;
}, async error => {
  const config = error.config;
  // Retry only read-only POS queries, respecting the server's cooldown.
  if (error.response?.status === 429 && config?.method === 'get'
    && config.url?.startsWith('/points-of-sale/') && (config.rateLimitRetries ?? 0) < 2
    && !config.signal?.aborted) {
    const retryAfter = error.response.headers?.['retry-after'];
    const seconds = Number(retryAfter);
    const delay = retryAfter == null ? 60000 : Number.isFinite(seconds)
      ? Math.max(1000, seconds * 1000) : Math.max(1000, Date.parse(retryAfter) - Date.now());
    if (Number.isFinite(delay) && delay <= 120000) {
      if (config.toastId !== undefined) toast.dismiss(config.toastId);
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          config.signal?.removeEventListener('abort', abort);
          reject(new axios.CanceledError());
        };
        const timer = setTimeout(() => {
          config.signal?.removeEventListener('abort', abort);
          resolve();
        }, delay + 250);
        config.signal?.addEventListener('abort', abort, { once: true });
        if (config.signal?.aborted) abort();
      });
      return api.request({ ...config, rateLimitRetries: (config.rateLimitRetries ?? 0) + 1 });
    }
  }
  const canceled = axios.isCancel(error);
  const expectedGuest = error.response?.status === 401 && config?.feedback?.ignoreUnauthorized;
  if (canceled || expectedGuest) {
    if (config?.toastId !== undefined) toast.dismiss(config.toastId);
  } else if (config?.feedback !== false) {
    const message = apiError(error);
    if (config?.toastId !== undefined) toast.update(config.toastId, {
      render: message, type: "error", isLoading: false, autoClose: 6000, closeButton: true,
    });
    else toast.error(message);
    publish(message, "error");
  }
  if (!canceled && error.response?.status === 401) window.dispatchEvent(new Event("auth:expired"));
  return Promise.reject(error);
});
export async function csrf() {
  await api.get(baseURL.replace(/\/api$/, "") + "/sanctum/csrf-cookie", {
    feedback: { pending: "Preparando acceso seguro...", success: "Conexión segura preparada.", history: false },
  });
}
export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const errors = error.response?.data?.errors;
    if (errors) return Object.values(errors).flat().join(" ");
    if (error.response?.status === 419) return "La sesión venció. Recarga la página e ingresa de nuevo.";
    if (error.response?.status === 401) return "Tu sesión terminó. Vuelve a iniciar sesión.";
    if (error.response?.status === 429) return "Demasiados intentos. Espera un minuto y vuelve a intentar.";
    return error.response?.data?.message || "No se pudo conectar con el servidor.";
  }
  return error instanceof Error ? error.message : "No fue posible completar la operación.";
}
