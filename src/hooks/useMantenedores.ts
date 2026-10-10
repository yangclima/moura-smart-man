"use client";

import { perfilDeLinha, type PerfilEquipe } from "@/lib/mapear";
import { supabase } from "@/lib/supabase";
import { useTempoReal } from "./useTempoReal";

async function carregar(): Promise<PerfilEquipe[]> {
  const { data, error } = await supabase.from("perfis").select("*").in("papel", ["mantenedor", "lider"]).order("nome");
  if (error) throw new Error(error.message);
  return data.map(perfilDeLinha);
}

const VAZIO: PerfilEquipe[] = [];

/** Equipe de manutenção (mantenedores e líderes), em ordem alfabética. */
export function useEquipe(ativo = true): PerfilEquipe[] {
  return useTempoReal(ativo ? "equipe" : null, carregar, [{ tabela: "perfis" }], VAZIO).dados;
}
