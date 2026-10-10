"use client";

import { DownloadIcon } from "lucide-react";
import { Carregando } from "@/components/Carregando";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { baixarCsv, dataLocal } from "@/lib/csv";
import { gerarCsv, metaPorClasse, porMaquina, type ResumoTempo } from "@/lib/indicadores";
import { formatarMinutos, type TemposChamado } from "@/lib/tempo";
import type { Chamado, ConfigPriorizacao } from "@/lib/tipos";
import { CartaoTempo } from "./CartaoTempo";

export const PERIODOS = { hoje: "Hoje", "7": "7 dias", "30": "30 dias" } as const;
export type Periodo = keyof typeof PERIODOS;

const ROTULOS = {
  reacaoMin: "Reação (T1−T0)",
  esperaMin: "Espera (T2−T0)",
  reparoMin: "Reparo sem pausas (T4−T2)",
  indisponibilidadeMin: "Indisponibilidade (T5−T0)",
} as const;

interface AbaOperacaoProps {
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
  encerrados: Chamado[];
  tempos: Record<keyof TemposChamado, ResumoTempo>;
  config: ConfigPriorizacao;
  carregando: boolean;
  erro: string | null;
}

export function AbaOperacao({ periodo, onPeriodo, encerrados, tempos, config, carregando, erro }: AbaOperacaoProps) {
  const metas = metaPorClasse(encerrados, config);
  const maquinas = porMaquina(encerrados);

  function exportar() {
    baixarCsv(gerarCsv(encerrados), `chamados-${periodo}-${dataLocal()}.csv`);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">
          {carregando ? "Chamados encerrados no período." : `${encerrados.length} chamado(s) encerrado(s) no período.`}
        </p>
        <Select value={periodo} onValueChange={(v) => onPeriodo(v as Periodo)}>
          <SelectTrigger className="w-32 sm:ml-auto" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIODOS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportar} disabled={encerrados.length === 0}>
          <DownloadIcon /> Exportar CSV
        </Button>
      </div>
      {erro && <p className="text-destructive">{erro}</p>}
      {carregando ? (
        <Carregando />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(ROTULOS) as (keyof typeof ROTULOS)[]).map((k) => (
              <CartaoTempo key={k} rotulo={ROTULOS[k]} mediana={tempos[k].mediana} p90={tempos[k].p90} />
            ))}
          </div>

          <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs">
            <h2 className="text-lg font-semibold">Meta de início cumprida, por classe</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead className="text-right">Chamados</TableHead>
                  <TableHead className="text-right">% no prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metas.map((m) => (
                  <TableRow key={m.classe}>
                    <TableCell className="font-semibold">{m.classe}</TableCell>
                    <TableCell>{config.metaInicioMin[m.classe] === null ? "sem meta" : `${config.metaInicioMin[m.classe]} min`}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round((100 * m.cumpriu) / m.total)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-xs">
            <h2 className="text-lg font-semibold">Por máquina</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead className="text-right">Chamados</TableHead>
                  <TableHead className="text-right">Tempo parado</TableHead>
                  <TableHead>Erro mais frequente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maquinas.map((m) => (
                  <TableRow key={m.maquina}>
                    <TableCell className="font-semibold">{m.maquina}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.chamados}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatarMinutos(m.paradoMin)}</TableCell>
                    <TableCell>{m.erroMaisFrequente}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </div>
  );
}
