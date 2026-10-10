"use client";

import { useEffect, useState } from "react";
import { chamadoDeLinha } from "@/lib/mapear";
import { supabase } from "@/lib/supabase";
import { STATUS_ABERTOS, type Chamado } from "@/lib/tipos";

export interface EstadoChamadosAbertos {
  chamados: Chamado[];
  carregando: boolean;
  /** Sem conexão com o Realtime: os dados exibidos podem estar velhos. */
  offline: boolean;
  atualizadoEm: number | null;
  /** IDs que chegaram depois da primeira carga (para destacar na TV). */
  novos: Set<string>;
}

const DESTAQUE_MS = 5000;
const ATRASO_RECARGA_MS = 150;
let contadorCanais = 0;

async function carregar(): Promise<Chamado[]> {
  const { data, error } = await supabase.from("chamados").select("*").in("status", STATUS_ABERTOS);
  if (error) throw new Error(error.message);
  return data.map(chamadoDeLinha);
}

export function useChamadosAbertos(ativo = true): EstadoChamadosAbertos {
  const [estado, setEstado] = useState<EstadoChamadosAbertos>({
    chamados: [],
    carregando: true,
    offline: false,
    atualizadoEm: null,
    novos: new Set(),
  });

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    let recarga: ReturnType<typeof setTimeout> | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const buscar = () =>
      carregar()
        .then((chamados) => vivo && setEstado((s) => ({ ...s, chamados, carregando: false, offline: false, atualizadoEm: Date.now() })))
        .catch(() => vivo && setEstado((s) => ({ ...s, carregando: false, offline: true })));

    const destacar = (id: string) => {
      setEstado((s) => ({ ...s, novos: new Set([...s.novos, id]) }));
      timers.push(
        setTimeout(() => setEstado((s) => ({ ...s, novos: new Set([...s.novos].filter((x) => x !== id)) })), DESTAQUE_MS),
      );
    };

    const canal = supabase
      .channel(`chamados-abertos-${++contadorCanais}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, (mudanca) => {
        if (mudanca.eventType === "INSERT") destacar(String((mudanca.new as { id: string }).id));
        clearTimeout(recarga);
        recarga = setTimeout(buscar, ATRASO_RECARGA_MS);
      })
      .subscribe((status) => {
        if (!vivo) return;
        if (status === "SUBSCRIBED") void buscar(); // (re)conectou: sincroniza o que perdeu
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setEstado((s) => ({ ...s, offline: true }));
        }
      });

    const semRede = () => setEstado((s) => ({ ...s, offline: true }));
    window.addEventListener("offline", semRede);
    window.addEventListener("online", buscar);
    void buscar();

    return () => {
      vivo = false;
      clearTimeout(recarga);
      timers.forEach(clearTimeout);
      window.removeEventListener("offline", semRede);
      window.removeEventListener("online", buscar);
      void supabase.removeChannel(canal);
    };
  }, [ativo]);

  return estado;
}
