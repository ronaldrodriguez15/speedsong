import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
type Theme = "light" | "dark";
const Context = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.classList.contains("dark") ? "dark" : "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#020617" : "#f7faff");
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const systemChange = () => {
      try { if (!localStorage.getItem("speedsong_theme")) setTheme(media.matches ? "dark" : "light"); } catch { /* Storage may be disabled. */ }
    };
    const storageChange = (event: StorageEvent) => {
      if (event.key === "speedsong_theme") setTheme(event.newValue === "dark" || (!event.newValue && media.matches) ? "dark" : "light");
    };
    media.addEventListener("change", systemChange);
    window.addEventListener("storage", storageChange);
    return () => { media.removeEventListener("change", systemChange); window.removeEventListener("storage", storageChange); };
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("speedsong_theme", next); } catch { /* The current session still changes theme. */ }
  }
  return <Context.Provider value={{ theme, toggleTheme }}>{children}</Context.Provider>;
}
export function useTheme() {
  const context = useContext(Context);
  if (!context) throw new Error("ThemeProvider requerido.");
  return context;
}
