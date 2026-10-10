"use client";

import { useEffect, useState } from "react";
import { carregarHistorico, type DadosHistorico } from "@/lib/historico";

interface EstadoHistorico {
  dados: DadosHistorico;
  carregando: boolean;
  erro: string | null;
}

const VAZIO: DadosHistorico = { eventos: [], vinculos: [] };

/** Busca o histórico conciliado uma vez. Os dados são estáticos: sem Realtime. */
export function useHistorico(): EstadoHistorico {
  const [estado, setEstado] = useState<EstadoHistorico>({ dados: VAZIO, carregando: true, erro: null });

  useEffect(() => {
    let ativo = true;
    carregarHistorico()
      .then((dados) => ativo && setEstado({ dados, carregando: false, erro: null }))
      .catch((e: Error) => ativo && setEstado({ dados: VAZIO, carregando: false, erro: e.message }));
    return () => {
      ativo = false;
    };
  }, []);

  return estado;
}
