import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    define: { "import.meta.env.URL_API_KEY": JSON.stringify(env.URL_API_KEY || "http://localhost:8000/api") },
    server: { port: 5173, strictPort: true },
  };
});