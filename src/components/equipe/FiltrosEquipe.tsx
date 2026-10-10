"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { FiltroEquipe, Situacao } from "@/lib/equipe";
import { ROTULO_PAPEL } from "@/lib/perfis";
import type { Papel } from "@/lib/tipos";

const TODOS = "todos";
const SITUACOES: Record<Situacao, string> = { ativos: "Ativos", desativados: "Desativados", todos: "Todos" };

interface FiltrosEquipeProps {
  filtro: FiltroEquipe;
  onFiltro: (f: FiltroEquipe) => void;
  papeis: Papel[];
  contagem: Partial<Record<Papel, number>>;
}

/** Busca por nome, perfil (com contagem) e situação. Clicar no perfil já ativo volta para "Todos". */
export function FiltrosEquipe({ filtro, onFiltro, papeis, contagem }: FiltrosEquipeProps) {
  const total = Object.values(contagem).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filtro.busca}
            onChange={(e) => onFiltro({ ...filtro, busca: e.target.value })}
            placeholder="Buscar pelo nome"
            aria-label="Buscar pelo nome"
            className="h-9 pr-8 pl-8"
          />
          {filtro.busca && (
            <button
              type="button"
              onClick={() => onFiltro({ ...filtro, busca: "" })}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={filtro.situacao}
          onValueChange={(v) => v && onFiltro({ ...filtro, situacao: v as Situacao })}
          aria-label="Situação"
          className="sm:ml-auto"
        >
          {(Object.keys(SITUACOES) as Situacao[]).map((s) => (
            <ToggleGroupItem key={s} value={s} className="px-3">
              {SITUACOES[s]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={filtro.papel ?? TODOS}
        onValueChange={(v) => onFiltro({ ...filtro, papel: !v || v === TODOS ? null : (v as Papel) })}
        aria-label="Perfil"
        className="flex-wrap"
      >
        <ToggleGroupItem value={TODOS} className="px-3">
          Todos <span className="text-muted-foreground tabular-nums">{total}</span>
        </ToggleGroupItem>
        {papeis.map((p) => (
          <ToggleGroupItem key={p} value={p} className="px-3">
            {ROTULO_PAPEL[p]} <span className="text-muted-foreground tabular-nums">{contagem[p] ?? 0}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
