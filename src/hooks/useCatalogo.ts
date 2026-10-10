"use client";

import {
  buscarMaquina,
  buscarSubdivisao,
  listarErros,
  listarMaquinas,
  listarSubdivisoes,
} from "@/lib/catalogo";
import type { ErroCatalogo, Maquina, Subdivisao } from "@/lib/tipos";
import { useTempoReal } from "./useTempoReal";

const VAZIO: never[] = [];

export function useMaquinas(ativo = true) {
  return useTempoReal<Maquina[]>(ativo ? "maquinas" : null, listarMaquinas, [{ tabela: "maquinas" }], VAZIO);
}

export function useMaquina(id: string, ativo = true) {
  const r = useTempoReal<Maquina | null>(
    ativo ? `maquina/${id}` : null,
    () => buscarMaquina(id),
    [{ tabela: "maquinas", filtro: `id=eq.${id}` }],
    null,
  );
  return { dado: r.dados, carregando: r.carregando, erro: r.erro };
}

/** Sem maquinaId: todas as subdivisões. */
export function useSubdivisoes(maquinaId?: string, ativo = true) {
  return useTempoReal<Subdivisao[]>(
    ativo ? `subdivisoes/${maquinaId ?? "*"}` : null,
    () => listarSubdivisoes(maquinaId),
    [{ tabela: "subdivisoes", filtro: maquinaId ? `maquina_id=eq.${maquinaId}` : undefined }],
    VAZIO,
  );
}

export function useSubdivisao(id: string | null) {
  const r = useTempoReal<Subdivisao | null>(
    id ? `subdivisao/${id}` : null,
    () => buscarSubdivisao(id!),
    [{ tabela: "subdivisoes", filtro: `id=eq.${id}` }],
    null,
  );
  return r.dados;
}

/** Sem maquinaId: todo o catálogo. */
export function useErros(maquinaId?: string, ativo = true) {
  return useTempoReal<ErroCatalogo[]>(
    ativo ? `erros/${maquinaId ?? "*"}` : null,
    () => listarErros(maquinaId),
    [{ tabela: "erros", filtro: maquinaId ? `maquina_id=eq.${maquinaId}` : undefined }],
    VAZIO,
  );
}
