import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(URL_SUPABASE && CHAVE_PUBLICA);

// Valores de reserva só para o build não quebrar sem .env; o app avisa na tela.
export const supabase = createClient(URL_SUPABASE || "http://127.0.0.1:54321", CHAVE_PUBLICA || "nao-configurado", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const BUCKET_FOTOS = "fotos";

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
