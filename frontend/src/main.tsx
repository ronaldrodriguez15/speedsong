import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import { MotionConfig } from "framer-motion";
import { ToastContainer } from "react-toastify";
import { NotificationProvider } from "./contexts/NotificationContext";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import { ThemeProvider } from "./contexts/ThemeContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider><BrowserRouter>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.22 }}>
        <ToastContainer position="bottom-right" limit={4} newestOnTop closeOnClick pauseOnFocusLoss aria-label="Avisos del sistema" />
        <AuthProvider>
          <NotificationProvider><App /></NotificationProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter></ThemeProvider>
  </React.StrictMode>
);
