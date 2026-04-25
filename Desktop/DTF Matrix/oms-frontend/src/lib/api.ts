import axios from "axios";

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});
