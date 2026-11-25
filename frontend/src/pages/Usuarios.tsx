import { useEffect, useState, type FormEvent } from "react";
import { api, apiError } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { AuthUser } from "../types/auth";
import { AnimatePresence, motion } from "framer-motion";
import { UserPlus, Pencil, Trash2, Save, X, Search, LoaderCircle, ShieldCheck, UserRound, ChevronLeft, ChevronRight, RefreshCw, Mail, UsersRound } from "lucide-react";
interface UserPage { data: AuthUser[]; current_page: number; last_page: number; total: number; }
const emptyForm = { name: "", email: "", password: "", password_confirmation: "", is_admin: false };
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
  useEffect(() => {
    if (!user?.is_admin) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      api.get<UserPage>("/users", { params: { search, page }, signal: controller.signal })
        .then(({data}) => {
          if (page > data.last_page) setPage(data.last_page);
          else setResult(data);
        })
        .catch(e => { if (!controller.signal.aborted) setError(apiError(e)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page, version, user?.is_admin]);
  if (!user?.is_admin) return <p className="rounded-xl bg-white dark:bg-slate-900 p-6">Solo los administradores pueden gestionar usuarios.</p>;
  function startEdit(item: AuthUser | null) {
    setEditing(item); setForm(item ? { ...emptyForm, name: item.name, email: item.email, is_admin: item.is_admin } : emptyForm);
    setError(""); setNotice(""); setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
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
    {error && <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950 p-4 text-rose-700 dark:text-rose-300">{error} {!open && <button className="ml-3 underline" onClick={() => setVersion(v => v + 1)}>Reintentar</button>}</div>}
    <AnimatePresence>{open && <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={save} className="overflow-hidden rounded-2xl border border-brand-100 dark:border-brand-800 bg-white dark:bg-slate-900 shadow-soft">
      <div className="space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><UserRound size={21} className="text-brand-500 dark:text-brand-400" />{editing ? "Editar usuario" : "Crear usuario"}</h2>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label>Nombre<input className="field mt-1" required maxLength={255} value={form.name} onChange={e => setForm({...form, name:e.target.value})} /></label>
        <label>Correo electrónico<input className="field mt-1" type="email" required maxLength={255} value={form.email} onChange={e => setForm({...form, email:e.target.value})} /></label>
        <label>Contraseña {editing && "(vacía para conservar)"}<input className="field mt-1" type="password" autoComplete="new-password" required={!editing} minLength={8} maxLength={255} value={form.password} onChange={e => setForm({...form, password:e.target.value})} /></label>
        <label>Confirmar contraseña<input className="field mt-1" type="password" autoComplete="new-password" required={Boolean(form.password)} value={form.password_confirmation} onChange={e => setForm({...form, password_confirmation:e.target.value})} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_admin} disabled={editing?.id === user?.id} onChange={e => setForm({...form, is_admin:e.target.checked})} /> Administrador</label>
      </fieldset>
      <div className="flex gap-3"><button className="btn-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}{busy ? "Guardando..." : "Guardar"}</button><button className="btn-quiet" type="button" disabled={busy} onClick={() => {setOpen(false); setError("");}}><X size={17} />Cancelar</button></div>
      </div>
    </motion.form>}</AnimatePresence>
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="block w-full max-w-md text-sm font-medium">Buscar usuario<span className="relative mt-2 block"><Search size={18} className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-400" /><input className="field pl-10" type="search" maxLength={255} placeholder="Nombre o correo..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}} /></span></label><button className="btn-quiet" disabled={loading || busy} onClick={() => setVersion(v => v + 1)}><RefreshCw size={17} className={loading ? "animate-spin" : ""} />Actualizar</button></div>
      {loading ? <p role="status" className="flex items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400"><LoaderCircle size={22} className="animate-spin text-brand-500 dark:text-brand-400" />Cargando usuarios...</p> : <div className="overflow-x-auto">
        <table className="mt-5 w-full text-left text-sm">
          <thead><tr className="border-b text-slate-500 dark:text-slate-400">{["Nombre", "Correo", "Rol", "Acciones"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{result?.data.map((item, index) => <motion.tr initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .025 }} key={item.id} className="border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-brand-50/30 dark:hover:bg-brand-900/30">
            <td className="p-3 font-medium"><span className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-300">{item.name.charAt(0).toUpperCase()}</span>{item.name}</span></td><td className="p-3"><span className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Mail size={15} className="shrink-0 text-slate-300 dark:text-slate-500" />{item.email}</span></td><td className="p-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.is_admin ? "bg-brand-50 dark:bg-brand-900 text-brand-600 dark:text-brand-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>{item.is_admin ? <ShieldCheck size={14} /> : <UserRound size={14} />}{item.is_admin ? "Administrador" : "Usuario"}</span></td>
            <td className="whitespace-nowrap p-3"><button disabled={busy} className="btn-quiet text-brand-600 dark:text-brand-300" onClick={() => startEdit(item)}><Pencil size={15} />Editar</button><button disabled={busy || item.id === user?.id} className="btn-quiet text-rose-600 dark:text-rose-400" onClick={() => remove(item)}><Trash2 size={15} />Eliminar</button></td>
          </motion.tr>)}</tbody>
        </table>
        {result?.data.length === 0 && <div className="py-10 text-center text-slate-500 dark:text-slate-400"><UsersRound size={34} className="mx-auto mb-3 text-slate-300 dark:text-slate-500" /><p>No se encontraron usuarios.</p></div>}
      </div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>{result?.total ?? 0} usuarios · Página {page} de {result?.last_page ?? 1}</span>
        <div className="flex gap-2"><button disabled={loading || page <= 1} className="btn-quiet" onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} />Anterior</button><button disabled={loading || page >= (result?.last_page ?? 1)} className="btn-quiet" onClick={() => setPage(p => p + 1)}>Siguiente<ChevronRight size={16} /></button></div>
      </div>
    </div>
  </section>;
}
