import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { Login } from "./pages/Login";
import { Panel } from "./pages/Panel";
import { Usuarios } from "./pages/Usuarios";
import { Cartera } from "./pages/Cartera";
import { MasVendidos } from "./pages/MasVendidos";
import { Cierre } from "./pages/Cierre";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/cierre" element={<MainLayout><Cierre /></MainLayout>} />
        <Route path="/" element={<MainLayout><Panel /></MainLayout>} />
        <Route path="/usuarios" element={<MainLayout><Usuarios /></MainLayout>} />
        <Route path="/cartera" element={<MainLayout><Cartera /></MainLayout>} />
        <Route path="/mas-vendidos" element={<MainLayout><MasVendidos /></MainLayout>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
