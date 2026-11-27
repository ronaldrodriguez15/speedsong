import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, apiError } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { AuthUser } from "../types/auth";
import { pointsOfSale } from "../components/PointOfSaleSelector";
import { motion } from "framer-motion";
import { UserPlus, Pencil, Trash2, Save, X, Search, LoaderCircle, ShieldCheck, UserRound, ChevronLeft, ChevronRight, RefreshCw, Mail, UsersRound } from "lucide-react";
interface UserPage { data: AuthUser[]; current_page: number; last_page: number; total: number; }
const emptyForm = { name: "", email: "", password: "", password_confirmation: "", is_admin: false, point_ids: [] as string[] };
export function Usuarios() {
  const { user, refreshUser } = useAuth();
  const [result, setResult] = useState<UserPage | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    nameInput.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  function closeModal() {
    if (busy) return;
    setOpen(false); setError("");
  }
  useEffect(() => {
    if (!user?.is_admin) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      api.get<UserPage>("/users", { params: { search, page }, signal: controller.signal, feedback: false })
        .then(({data}) => {
          if (page > data.last_page) setPage(data.last_page);
          else setResult(data);
        })
        .catch(e => { if (!controller.signal.aborted) setError(apiError(e)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search.trim() ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page, version, user?.is_admin]);
  if (!user?.is_admin) return <p className="rounded-xl bg-white dark:bg-slate-900 p-6">Solo los administradores pueden gestionar usuarios.</p>;
  function startEdit(item: AuthUser | null) {
    setEditing(item); setForm(item ? { ...emptyForm, name: item.name, email: item.email, is_admin: item.is_admin, point_ids: item.point_ids ?? [] } : emptyForm);
    setError(""); setNotice(""); setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.is_admin && !form.point_ids.length) { setError("Selecciona al menos un punto de venta."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (editing) await api.put("/users/" + editing.id, form);
      else await api.post("/users", form);
      if (editing?.id === user?.id) await refreshUser();
      setOpen(false); setVersion(v => v + 1); setNotice(editing ? "Usuario actualizado." : "Usuario creado.");
    } catch(e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function remove(item: AuthUser) {
    if (!window.confirm("¿Eliminar a " + item.name + "? Esta acción es permanente.")) return;
    setBusy(true); setError(""); setNotice("");
    try { await api.delete("/users/" + item.id); setVersion(v => v + 1); setNotice("Usuario eliminado."); }
    catch(e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-slate-500 dark:text-slate-400">Administra las cuentas y sus permisos de acceso.</p>
      <motion.button whileTap={{ scale: .97 }} className="btn-primary" disabled={busy} onClick={() => startEdit(null)}><UserPlus size={18} />Nuevo usuario</motion.button>
    </div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950 p-4 text-emerald-700 dark:text-emerald-400">{notice}</p>}
    {error && !open && <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950 p-4 text-rose-700 dark:text-rose-300">{error} <button className="ml-3 underline" onClick={() => setVersion(v => v + 1)}>Reintentar</button></div>}
    {open && <dialog ref={dialog} aria-labelledby="user-modal-title" aria-describedby="user-modal-description"
      onCancel={event => { event.preventDefault(); closeModal(); }}
      onClick={event => {
        if (event.target !== dialog.current) return;
        const rect = dialog.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:bg-slate-900 dark:text-slate-100">
      <form onSubmit={save} aria-busy={busy} className="flex max-h-[90dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
        <div><h2 id="user-modal-title" className="flex items-center gap-2 text-xl font-semibold"><UserRound size={21} className="text-brand-500 dark:text-brand-400" />{editing ? "Editar usuario" : "Crear usuario"}</h2>
          <p id="user-modal-description" className="mt-2 text-sm text-slate-500 dark:text-slate-400">Configura los datos de la cuenta y sus permisos de acceso.</p></div>
        <button type="button" aria-label="Cerrar formulario" className="icon-button shrink-0" disabled={busy} onClick={closeModal}><X size={21} /></button>
      </header>
      <div className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-6">
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</div>}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label>Nombre<input ref={nameInput} className="field mt-1" required maxLength={255} value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></label>
        <label>Correo electrónico<input className="field mt-1" type="email" required maxLength={255} value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></label>
        <label>Contraseña {editing && "(vacía para conservar)"}<input className="field mt-1" type="password" autoComplete="new-password" required={!editing} minLength={8} maxLength={255} value={form.password} onChange={e => setForm({...form, password:e.target.value})} /></label>
        <label>Confirmar contraseña<input className="field mt-1" type="password" autoComplete="new-password" required={Boolean(form.password)} value={form.password_confirmation} onChange={e => setForm({...form, password_confirmation:e.target.value})} /></label>
        <div className="space-y-3 sm:col-span-2">
          <p className="font-semibold">Rol y puntos de venta</p>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${form.is_admin ? "border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "border-slate-200 dark:border-slate-700"}`}>
            <input className="h-5 w-5 accent-brand-500" type="checkbox" checked={form.is_admin} disabled={editing?.id === user?.id} onChange={e => setForm({...form, is_admin: e.target.checked, point_ids: e.target.checked ? [] : form.point_ids})} />
            <ShieldCheck size={22} className="text-brand-500 dark:text-brand-400" /><span><span className="block font-semibold">Administrador</span><span className="text-sm text-slate-500 dark:text-slate-400">Acceso a todos los puntos de venta y gestión de usuarios.</span></span>
          </label>
          <p className="text-sm text-slate-500 dark:text-slate-400">{form.is_admin ? "Los permisos por sede están desactivados: el administrador tiene acceso completo." : "Selecciona uno o varios puntos de venta para este usuario."}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{pointsOfSale.map(point => <label key={point.id} className={`flex items-center gap-3 rounded-xl border p-4 transition ${form.is_admin ? "cursor-not-allowed border-slate-200 opacity-40 dark:border-slate-700" : form.point_ids.includes(point.id) ? "cursor-pointer border-brand-500 bg-brand-50 dark:bg-brand-900/40" : "cursor-pointer border-slate-200 hover:border-brand-400 dark:border-slate-700"}`}>
            <input type="checkbox" className="h-5 w-5 accent-brand-500" disabled={form.is_admin} checked={!form.is_admin && form.point_ids.includes(point.id)} onChange={e => setForm({...form, point_ids: e.target.checked ? [...form.point_ids, point.id] : form.point_ids.filter(id => id !== point.id)})} /><span className="font-medium">{point.name}</span>
          </label>)}</div>
        </div>
      </fieldset>
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-100 p-5 dark:border-slate-800 sm:px-6">
        <button className="btn-quiet" type="button" disabled={busy} onClick={closeModal}>Cancelar</button>
        <button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}{busy ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}</button>
      </footer>
      </form>
    </dialog>}
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="block w-full max-w-md text-sm font-medium">Buscar usuario<span className="relative mt-2 block"><Search size={18} className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-400" /><input className="field pl-10" type="search" maxLength={255} placeholder="Nombre o correo..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} /></span></label><button className="btn-quiet" disabled={loading || busy} onClick={() => setVersion(v => v + 1)}><RefreshCw size={17} className={loading ? "animate-spin" : ""} />Actualizar</button></div>
      {loading && !result ? <p role="status" className="flex items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400"><LoaderCircle size={22} className="animate-spin text-brand-500 dark:text-brand-400" />Cargando usuarios...</p> : <div className="overflow-x-auto">
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr className="border-b text-slate-500 dark:text-slate-400">{["Nombre", "Correo", "Rol", "Acciones"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{result?.data.map((item, index) => <motion.tr initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .025 }} key={item.id} className="border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-brand-50/30 dark:hover:bg-brand-900/30">
            <td className="p-3 font-medium"><span className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-300">{item.name.charAt(0).toUpperCase()}</span>{item.name}</span></td><td className="p-3"><span className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Mail size={15} className="shrink-0 text-slate-300 dark:text-slate-500" />{item.email}</span></td><td className="p-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.is_admin ? "bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>{item.is_admin ? <ShieldCheck size={14} /> : <UserRound size={14} />}{item.is_admin ? "Administrador" : pointsOfSale.filter(point => item.point_ids?.includes(point.id)).map(point => point.name).join(", ") || "Sin sedes asignadas"}</span></td>
            <td className="whitespace-nowrap p-3"><button disabled={busy} className="btn-quiet text-brand-600 dark:text-brand-300" onClick={() => startEdit(item)}><Pencil size={15} />Editar</button><button disabled={busy || item.id === user?.id} className="btn-quiet text-rose-600 dark:text-rose-400" onClick={() => remove(item)}><Trash2 size={15} />Eliminar</button></td>
          </motion.tr>)}</tbody>
        </table>
        {result?.data.length === 0 && <div className="py-10 text-center text-slate-500 dark:text-slate-400"><UsersRound size={34} className="mx-auto mb-3 text-slate-300 dark:text-slate-500" /><p>No se encontraron usuarios.</p></div>}
      </div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span aria-live="polite">{loading ? "Actualizando… · " : ""}{result?.total ?? 0} usuarios · Página {page} de {result?.last_page ?? 1}</span>
        <div className="flex gap-2"><button disabled={loading || page <= 1} className="btn-quiet" onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} />Anterior</button><button disabled={loading || page >= (result?.last_page ?? 1)} className="btn-quiet" onClick={() => setPage(p => p + 1)}>Siguiente<ChevronRight size={16} /></button></div>
      </div>
    </div>
  </section>;
}
