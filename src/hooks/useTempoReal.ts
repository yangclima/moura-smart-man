"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Assinatura {
  /** Tabela do schema public observada via Realtime. */
  tabela: string;
  /** Filtro do Realtime, ex.: "maquina_id=eq.A". */
  filtro?: string;
}

export interface EstadoTempoReal<T> {
  dados: T;
  carregando: boolean;
  erro: string | null;
}

const ATRASO_RECARGA_MS = 150;
let contadorCanais = 0;

/**
 * Busca com `carregar` e refaz a busca a cada mudança nas tabelas assinadas
 * (Supabase Realtime). `chave` identifica a consulta; null desliga.
 */
export function useTempoReal<T>(
  chave: string | null,
  carregar: () => Promise<T>,
  assinaturas: Assinatura[],
  inicial: T,
): EstadoTempoReal<T> {
  const [estado, setEstado] = useState<EstadoTempoReal<T> & { chave: string | null }>({
    dados: inicial,
    carregando: true,
    erro: null,
    chave,
  });
  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  });

  useEffect(() => {
    if (!chave) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const buscar = () =>
      carregarRef
        .current()
        .then((dados) => ativo && setEstado({ chave, dados, carregando: false, erro: null }))
        .catch((e: Error) => ativo && setEstado((s) => ({ ...s, chave, carregando: false, erro: e.message })));

    // Várias mudanças seguidas (ex.: renumerar a ordem) viram uma só recarga.
    const agendar = () => {
      clearTimeout(timer);
      timer = setTimeout(buscar, ATRASO_RECARGA_MS);
    };

    const canal = supabase.channel(`rt-${chave}-${++contadorCanais}`);
    for (const a of assinaturas) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: a.tabela, filter: a.filtro }, agendar);
    }
    canal.subscribe();
    void buscar();

    return () => {
      ativo = false;
      clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
    // `assinaturas` é derivada de `chave` em todos os usos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (estado.chave !== chave) return { dados: inicial, carregando: Boolean(chave), erro: null };
  return estado;
}
