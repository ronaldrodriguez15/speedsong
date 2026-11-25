import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../contexts/AuthContext";
import { apiError } from "../services/api";
import { motion } from "framer-motion";
import { LogIn, LoaderCircle } from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";

export function Login() {
  const { login, isAuthenticated, isLoggingIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await login({ email, password });
    } catch (loginError: unknown) {
      setError(apiError(loginError));
    }
  }

  return (
    <div className="grid min-h-screen bg-white dark:bg-slate-900 lg:grid-cols-[1.05fr_.95fr]">
      <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-sky-400 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full border-[1px] border-white/15" />
        <div className="absolute -bottom-40 -left-24 h-[500px] w-[500px] rounded-full border-[1px] border-white/15" />
        <div className="relative"><Logo light large /></div>
        <div className="relative max-w-xl">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Zap size={28} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Todo tu negocio,<br />en un solo lugar.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-blue-50/90">Administra usuarios, consulta tu cartera y conoce el rendimiento de tus productos desde una plataforma centralizada.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-white/90">
            <ShieldCheck size={19} /> Plataforma de gestión SpeedSong
          </div>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} SpeedSong. Todos los derechos reservados.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px]">
          <div className="mb-10 flex justify-center lg:justify-start"><Logo large /></div>
          <div className="mb-9">
            <p className="text-sm font-semibold text-brand-600 dark:text-brand-300">Bienvenido de nuevo</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Iniciar sesión</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Ingresa tus credenciales para acceder al panel de SpeedSong.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Correo electrónico</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
                <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" className="field pl-11" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Contraseña</label>
              <div className="relative">
                <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" className="field pl-11 pr-12" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <div role="alert" className="rounded-xl border border-rose-100 dark:border-rose-900 bg-rose-50 dark:bg-rose-950 px-4 py-3 text-sm leading-5 text-rose-600 dark:text-rose-400">{error}</div>}

            <button type="submit" disabled={isLoggingIn || isLoading} className="btn-primary w-full py-3.5">
              {isLoggingIn ? <LoaderCircle size={18} className="animate-spin" /> : <LogIn size={18} />}
              {isLoggingIn ? "Validando..." : "Ingresar a SpeedSong"}
            </button>
          </form>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-400">
            <ShieldCheck size={15} /> Acceso seguro a tu plataforma
          </div>
          <p className="mt-12 text-center text-xs text-slate-300 dark:text-slate-500">© {new Date().getFullYear()} SpeedSong</p>
        </motion.div>
      </section>
    </div>
  );
}
