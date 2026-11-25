import { api, csrf } from "./api";
import type { AuthUser, LoginCredentials } from "../types/auth";
export async function loginRequest(credentials: LoginCredentials): Promise<AuthUser> {
  await csrf();
  return (await api.post<{user: AuthUser}>("/login", credentials)).data.user;
}