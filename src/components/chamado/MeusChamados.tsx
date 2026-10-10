"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTempoReal } from "@/hooks/useTempoReal";
import { lerMeusChamados } from "@/lib/local";
import { chamadoDeLinha } from "@/lib/mapear";
import { supabase } from "@/lib/supabase";
import { formatarDataHora } from "@/lib/tempo";
import { STATUS_ROTULO, type Chamado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const assinarNada = () => () => {};
const lerChave = () => lerMeusChamados().join(",");
const VAZIO: Chamado[] = [];

/** Últimos chamados abertos neste aparelho (IDs guardados no localStorage). */
export function MeusChamados({ atual }: { atual?: string }) {
  const chave = useSyncExternalStore(assinarNada, lerChave, () => "");
  const ids = chave ? chave.split(",") : [];
  const { dados } = useTempoReal(
    ids.length ? `meus/${chave}` : null,
    async () => {
      const { data, error } = await supabase.from("chamados").select("*").in("id", ids);
      if (error) throw new Error(error.message);
      return data.map(chamadoDeLinha);
    },
    [{ tabela: "chamados" }],
    VAZIO,
  );
  const lista = ids.map((id) => dados.find((c) => c.id === id)).filter((c): c is Chamado => Boolean(c));

  if (lista.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase">Chamados deste aparelho</h2>
      <ul className="grid gap-2">
        {lista.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chamado/${c.id}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3 text-sm shadow-xs transition-colors hover:border-moura-azul/40",
                c.id === atual && "border-moura-azul/40 bg-accent",
              )}
            >
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium">
                  {c.maquinaNome} · {c.subdivisaoNome}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {c.numero} · {formatarDataHora(c.marcos.abertura)}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-moura-azul">
                {STATUS_ROTULO[c.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
