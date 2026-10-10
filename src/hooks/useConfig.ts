"use client";

import { configDeLinha } from "@/lib/mapear";
import { supabase } from "@/lib/supabase";
import { CONFIG_PADRAO, type ConfigPriorizacao } from "@/lib/tipos";
import { useTempoReal } from "./useTempoReal";

async function carregar(): Promise<ConfigPriorizacao> {
  const { data, error } = await supabase.from("config").select("*").eq("id", "priorizacao").maybeSingle();
  if (error) throw new Error(error.message);
  return configDeLinha(data);
}

/** config/priorizacao em tempo real; cai no padrão do plano enquanto não carrega. */
export function useConfig(ativo = true): ConfigPriorizacao {
  return useTempoReal(ativo ? "config" : null, carregar, [{ tabela: "config" }], CONFIG_PADRAO).dados;
}
