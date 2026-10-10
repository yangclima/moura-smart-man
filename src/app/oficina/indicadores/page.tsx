"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { Cabecalho } from "@/components/Cabecalho";
import { Carregando } from "@/components/Carregando";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTempoReal } from "@/hooks/useTempoReal";
import { useConfig } from "@/hooks/useConfig";
import { gerarCsv, metaPorClasse, porMaquina, resumoTempos } from "@/lib/indicadores";
import { chamadoDeLinha } from "@/lib/mapear";
import { supabase } from "@/lib/supabase";
import { formatarMinutos } from "@/lib/tempo";
import type { Chamado } from "@/lib/tipos";

const PERIODOS = { hoje: "Hoje", "7": "7 dias", "30": "30 dias" } as const;
type Periodo = keyof typeof PERIODOS;

function inicioDoPeriodo(p: Periodo): number {
  if (p === "hoje") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (Number(p) - 1) * 86_400_000;
}

const VAZIO: Chamado[] = [];

async function carregarEncerrados(desde: number): Promise<Chamado[]> {
  const { data, error } = await supabase
    .from("chamados")
    .select("*")
    .eq("status", "encerrado")
    .gte("abertura", new Date(desde).toISOString())
    .order("abertura");
  if (error) throw new Error(error.message);
  return data.map(chamadoDeLinha);
}

const ROTULOS = {
  reacaoMin: "Reação (T1−T0)",
  esperaMin: "Espera (T2−T0)",
  reparoMin: "Reparo sem pausas (T4−T2)",
  indisponibilidadeMin: "Indisponibilidade (T5−T0)",
} as const;

export default function Indicadores() {
  const [periodo, setPeriodo] = useState<Periodo>("7");
  const config = useConfig();
  const desde = inicioDoPeriodo(periodo);
  const { dados: encerrados, carregando, erro } = useTempoReal(
    `indicadores/${desde}`,
    () => carregarEncerrados(desde),
    [{ tabela: "chamados" }],
    VAZIO,
  );
  const tempos = resumoTempos(encerrados);
  const metas = metaPorClasse(encerrados, config);
  const maquinas = porMaquina(encerrados);

  function exportar() {
    const blob = new Blob(["﻿" + gerarCsv(encerrados)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chamados-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <Cabecalho titulo="Indicadores" links={[{ href: "/oficina", rotulo: "TV" }]} />
      <main className="mx-auto grid w-full max-w-6xl gap-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-moura-azul">Indicadores dos chamados encerrados</h1>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-32 sm:ml-auto">
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
            <p className="text-muted-foreground">{encerrados.length} chamado(s) encerrado(s) no período.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(ROTULOS) as (keyof typeof ROTULOS)[]).map((k) => (
                <Card key={k} className="border-t-4 border-t-moura-amarelo">
                  <CardHeader>
                    <CardTitle className="font-sans text-sm font-medium text-muted-foreground">{ROTULOS[k]}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-heading text-4xl font-bold text-moura-azul tabular-nums">{formatarMinutos(tempos[k].mediana)}</div>
                    <div className="text-sm text-muted-foreground">mediana · P90 {formatarMinutos(tempos[k].p90)}</div>
                  </CardContent>
                </Card>
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
      </main>
    </>
  );
}
