import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ApiNotice } from "../services/api";
import { useAuth } from "./AuthContext";
interface Notifications {
  items: ApiNotice[]; unread: number; markAll: () => void; clear: () => void; markRead: (id: string) => void;
}
const Context = createContext<Notifications | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ApiNotice[]>([]);
  useEffect(() => {
    setItems([]);
    if (!user) return;
    const receive = (event: Event) => setItems(old => [(event as CustomEvent<ApiNotice>).detail, ...old].slice(0, 40));
    window.addEventListener("api:notice", receive);
    return () => window.removeEventListener("api:notice", receive);
  }, [user?.id]);
  return <Context.Provider value={{
    items, unread: items.filter(item => !item.read).length,
    markAll: () => setItems(old => old.map(item => ({...item, read: true}))),
    clear: () => setItems([]),
    markRead: id => setItems(old => old.map(item => item.id === id ? {...item, read: true} : item)),
  }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("NotificationProvider requerido");
  return context;
}