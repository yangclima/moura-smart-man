"use client";

import { useId, useState, type ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** A mesma informação do gráfico, em tabela: acessibilidade e conferência. */
export interface DadosTabela {
  colunas: string[];
  linhas: { chave: string; celulas: ReactNode[] }[];
}

interface BlocoGraficoProps {
  /** Afirma a conclusão principal, e não só o nome do gráfico. */
  titulo: string;
  descricao?: ReactNode;
  /** O "n" usado, sempre visível. */
  n: ReactNode;
  vazio: boolean;
  dados: DadosTabela;
  /** Seletores no canto do título (agrupamento, métrica). */
  acoes?: ReactNode;
  /** Observação sob o gráfico (avisos, como ler). */
  nota?: ReactNode;
  /** Sem cartão próprio, quando o gráfico fica dentro de outro bloco. */
  embutido?: boolean;
  children: ReactNode;
}

/** Moldura comum dos gráficos: título-conclusão, n, estado vazio e "ver dados". */
export function BlocoGrafico({ titulo, descricao, n, vazio, dados, acoes, nota, embutido, children }: BlocoGraficoProps) {
  const [verDados, setVerDados] = useState(false);
  const idTabela = useId();
  const Titulo = embutido ? "h3" : "h2";

  return (
    <figure
      className={cn(
        "m-0 grid min-w-0 content-start gap-3",
        !embutido && "rounded-2xl border bg-card p-4 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <figcaption className="grid min-w-0 flex-1 gap-0.5">
          <Titulo className={embutido ? "text-base font-semibold" : "text-lg font-semibold"}>{titulo}</Titulo>
          {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        </figcaption>
        {acoes}
      </div>

      {vazio ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <>
          {children}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{n}</span>
            <button
              type="button"
              aria-expanded={verDados}
              aria-controls={idTabela}
              onClick={() => setVerDados((v) => !v)}
              className="rounded-sm font-medium text-moura-azul-claro underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-ring"
            >
              {verDados ? "ocultar dados" : "ver dados"}
            </button>
          </div>
          {nota && <div className="text-xs text-muted-foreground">{nota}</div>}
          {verDados && (
            <div id={idTabela}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {dados.colunas.map((c, i) => (
                      <TableHead key={c} className={i === 0 ? undefined : "text-right"}>
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.linhas.map((l) => (
                    <TableRow key={l.chave}>
                      {l.celulas.map((c, i) => (
                        <TableCell key={i} className={i === 0 ? "font-semibold" : "text-right tabular-nums"}>
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </figure>
  );
}
