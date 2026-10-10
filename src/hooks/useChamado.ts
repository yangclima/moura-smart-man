"use client";

import { chamadoDeLinha } from "@/lib/mapear";
import { supabase } from "@/lib/supabase";
import type { Chamado } from "@/lib/tipos";
import { useTempoReal } from "./useTempoReal";

/** Um chamado em tempo real. */
export function useChamado(id: string | null) {
  const r = useTempoReal<Chamado | null>(
    id ? `chamado/${id}` : null,
    async () => {
      const { data, error } = await supabase.from("chamados").select("*").eq("id", id!).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? chamadoDeLinha(data) : null;
    },
    [{ tabela: "chamados", filtro: `id=eq.${id}` }],
    null,
  );
  return { dado: r.dados, carregando: r.carregando, erro: r.erro };
}
