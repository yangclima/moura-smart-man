"use client";

import { ChevronLeftIcon, ChevronRightIcon, QrCodeIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Maquina } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const POR_PAGINA = 50;

interface TabelaMaquinasQRProps {
  maquinas: Maquina[];
  selecionadas: ReadonlySet<string>;
  onAlternar: (id: string, marcado: boolean) => void;
  /** Marca ou desmarca de uma vez todas as máquinas listadas (todas as páginas). */
  onAlternarTodas: (ids: string[], marcado: boolean) => void;
  onAbrir: (m: Maquina) => void;
}

export function TabelaMaquinasQR({ maquinas, selecionadas, onAlternar, onAlternarTodas, onAbrir }: TabelaMaquinasQRProps) {
  const [pagina, setPagina] = useState({ maquinas, n: 0 });
  // Lista nova (busca ou filtro) volta para a primeira página.
  const atual = pagina.maquinas === maquinas ? pagina.n : 0;
  const totalPaginas = Math.max(1, Math.ceil(maquinas.length / POR_PAGINA));
  const visiveis = maquinas.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);
  const todasMarcadas = maquinas.length > 0 && maquinas.every((m) => selecionadas.has(m.id));

  return (
    <div className="grid gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={todasMarcadas}
                onCheckedChange={(v) => onAlternarTodas(maquinas.map((m) => m.id), v === true)}
                aria-label={todasMarcadas ? "Desmarcar todas as listadas" : `Selecionar as ${maquinas.length} listadas`}
              />
            </TableHead>
            <TableHead>Máquina</TableHead>
            <TableHead className="hidden sm:table-cell">TAG</TableHead>
            <TableHead className="hidden md:table-cell">Linha</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Etiqueta</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiveis.map((m) => {
            const marcada = selecionadas.has(m.id);
            return (
              <TableRow key={m.id} data-state={marcada ? "selected" : undefined} className={cn(marcada && "bg-accent/60")}>
                <TableCell>
                  <Checkbox checked={marcada} onCheckedChange={(v) => onAlternar(m.id, v === true)} aria-label={`Selecionar ${m.nome}`} />
                </TableCell>
                <TableCell>
                  <button type="button" onClick={() => onAbrir(m)} className="grid text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="font-medium">{m.nome}</span>
                    <span className="font-mono text-xs text-muted-foreground sm:hidden">{m.tag}</span>
                  </button>
                </TableCell>
                <TableCell className="hidden font-mono text-xs sm:table-cell">{m.tag}</TableCell>
                <TableCell className="hidden md:table-cell">{m.linha || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onAbrir(m)}>
                    <QrCodeIcon /> Ver QR
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {atual * POR_PAGINA + 1}–{Math.min((atual + 1) * POR_PAGINA, maquinas.length)} de {maquinas.length}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPagina({ maquinas, n: atual - 1 })}
            disabled={atual === 0}
            aria-label="Página anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setPagina({ maquinas, n: atual + 1 })}
            disabled={atual >= totalPaginas - 1}
            aria-label="Próxima página"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
