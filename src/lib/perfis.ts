import { supabase } from "./supabase";
import type { Papel } from "./tipos";

export const TAMANHO_PIN = 6;

export const DESTINO_POR_PAPEL: Record<Papel, string> = {
  engenharia: "/engenharia",
  lider: "/manutencao",
  mantenedor: "/manutencao",
  operador: "/c",
  oficina: "/oficina",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  engenharia: "Engenharia",
  lider: "Líder",
  mantenedor: "Mantenedor",
  operador: "Operador",
  oficina: "TV da oficina",
};

/** Troca o PIN por uma sessão (rota /api/entrar) e a instala no cliente Supabase. */
export async function entrarComPin(pin: string): Promise<void> {
  const resposta = await fetch("/api/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string; access_token?: string; refresh_token?: string };
  if (!resposta.ok || !corpo.access_token || !corpo.refresh_token) {
    throw new Error(corpo.erro ?? "Não foi possível entrar");
  }
  const { error } = await supabase.auth.setSession({ access_token: corpo.access_token, refresh_token: corpo.refresh_token });
  if (error) throw new Error(error.message);
}

/** Chamada autenticada às rotas de gestão (/api/equipe). */
export async function chamarApiEquipe<T>(metodo: "GET" | "POST" | "PATCH", corpo?: object): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const resposta = await fetch("/api/equipe", {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = (await resposta.json().catch(() => ({}))) as T & { erro?: string };
  if (!resposta.ok) throw new Error(json.erro ?? "Erro no servidor");
  return json;
}
