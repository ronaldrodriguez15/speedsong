import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
export function ThemeToggle({ onBlue = false }: { onBlue?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Activar tema claro" : "Activar tema oscuro";
  return <motion.button type="button" whileTap={{ scale: .9 }} className={onBlue ? "navbar-icon" : "icon-button"} onClick={toggleTheme} aria-label={label} title={label} aria-pressed={theme === "dark"}>
    {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
  </motion.button>;
}
