"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, Rectangle, ReferenceLine, XAxis, YAxis, type BarShapeProps } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { EventoHistorico } from "@/lib/historico";
import {
  itensAteFracao,
  paretoComponentes,
  type FiltroLista,
  type ItemPareto,
  type MetricaPareto,
  type Pareto,
} from "@/lib/indicadores-historico";
import { formatarMinutos } from "@/lib/tempo";
import { BotaoNumero } from "../BotaoNumero";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { COR, corMaquina } from "./cores";
import { SeletorGrafico } from "./SeletorGrafico";

const METRICAS: Record<MetricaPareto, string> = { horas: "Horas paradas", quebras: "Quebras" };
const MIN_POR_H = 60;
/** Fração da regra de Pareto marcada no gráfico e usada no título. */
const FRACAO_PARETO = 0.8;
const LIMITE = 10;
const OUTROS = "Outros";

const CONFIG: ChartConfig = {
  valor: { label: "Valor", color: COR.azul },
  acumulado: { label: "% acumulado", color: COR.destaque },
};

const formatarValor = (v: number, m: MetricaPareto) => (m === "horas" ? formatarMinutos(v * MIN_POR_H) : `${v}`);
const pct = (f: number) => `${Math.round(100 * f)}%`;

interface Linha {
  rotulo: string;
  valor: number;
  acumulado: number;
  n: number;
  cor: string;
  item: ItemPareto | null;
}

function linhasDoGrafico(p: Pareto): Linha[] {
  const itens = p.itens.map((item) => ({ ...item, cor: corMaquina(item.maquina), item }));
  if (!p.outros) return itens;
  return [...itens, { rotulo: OUTROS, valor: p.outros.valor, acumulado: 1, n: p.outros.n, cor: COR.referencia, item: null }];
}

function titulo(p: Pareto, metrica: MetricaPareto, maquina: string | null): string {
  const medida = metrica === "horas" ? "das horas paradas" : "das quebras";
  const k = itensAteFracao(p.itens, FRACAO_PARETO);
  if (k === null) return `Os ${p.itens.length} componentes com mais ${METRICAS[metrica].toLowerCase()}`;
  const onde = maquina ? ` da Máquina ${maquina}` : "";
  return k === 1
    ? `1 componente concentra ${pct(FRACAO_PARETO)} ${medida}${onde}`
    : `${k} componentes concentram ${pct(FRACAO_PARETO)} ${medida}${onde}`;
}

interface Props {
  eventos: EventoHistorico[];
  /** Máquina do filtro da aba; null = todas. */
  maquina: string | null;
  onAbrir: (f: FiltroLista) => void;
}

/** Pareto por componente: onde está o tempo parado (ou as quebras) de cada máquina. */
export function GraficoPareto({ eventos, maquina, onAbrir }: Props) {
  const [metrica, setMetrica] = useState<MetricaPareto>("horas");
  const pareto = paretoComponentes(eventos, metrica, LIMITE);
  const linhas = linhasDoGrafico(pareto);
  const nTotal = linhas.reduce((t, l) => t + l.n, 0);

  function abrir(item: ItemPareto) {
    onAbrir({ maquina: item.maquina, componente: item.componente, quebra: metrica === "quebras" ? true : undefined });
  }

  return (
    <BlocoGrafico
      titulo={titulo(pareto, metrica, maquina)}
      descricao={
        <>
          {metrica === "horas" ? "Soma da indisponibilidade" : "Quebras, sem micro-paradas,"} por componente do MES, do
          maior para o menor, com o percentual acumulado. Clique numa barra para ver os eventos.
          {!maquina && <span className="block font-medium text-foreground">Dica: filtre uma máquina para ver o Pareto dela.</span>}
        </>
      }
      acoes={<SeletorGrafico rotulo="Métrica" valor={metrica} opcoes={METRICAS} onChange={setMetrica} />}
      n={`n = ${nTotal} paradas do MES`}
      vazio={linhas.length === 0 || pareto.total === 0}
      dados={{
        colunas: ["Componente", METRICAS[metrica], "n", "% acumulado"],
        linhas: linhas.map((l) => ({
          chave: l.rotulo,
          celulas: [
            l.rotulo,
            l.item ? (
              <BotaoNumero key="v" rotulo={`Ver na lista: ${l.rotulo}`} onClick={() => abrir(l.item as ItemPareto)}>
                {formatarValor(l.valor, metrica)}
              </BotaoNumero>
            ) : (
              formatarValor(l.valor, metrica)
            ),
            l.n,
            pct(l.acumulado),
          ],
        })),
      }}
      nota={`Linha tracejada: ${pct(FRACAO_PARETO)} do total. Componentes além dos ${LIMITE} primeiros entram em “${OUTROS}”.`}
    >
      <ChartContainer config={CONFIG} className="aspect-auto h-80 w-full">
        <ComposedChart data={linhas} margin={{ left: 0, right: 8, top: 8, bottom: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={56} />
          <YAxis
            yAxisId="valor"
            width={64}
            allowDecimals={metrica === "horas"}
            tickFormatter={(v: number) => (metrica === "horas" ? `${Math.round(v)} h` : `${v}`)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="acumulado"
            orientation="right"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={pct}
            width={44}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              const l = active ? (payload?.[0]?.payload as Linha | undefined) : undefined;
              if (!l) return null;
              return (
                <CaixaTooltip
                  titulo={l.rotulo}
                  linhas={[
                    { rotulo: METRICAS[metrica], cor: l.cor, valor: formatarValor(l.valor, metrica), detalhe: `n = ${l.n}` },
                    { rotulo: "% acumulado", cor: COR.destaque, valor: pct(l.acumulado) },
                  ]}
                  rodape={l.item ? "Clique para ver os eventos" : undefined}
                />
              );
            }}
          />
          <ReferenceLine yAxisId="acumulado" y={FRACAO_PARETO} stroke={COR.referencia} strokeDasharray="5 4" />
          <Bar
            yAxisId="valor"
            dataKey="valor"
            radius={[3, 3, 0, 0]}
            shape={(p: BarShapeProps) => {
              const l = p.payload as Linha;
              return <Rectangle {...p} fill={l.cor} className={l.item ? "cursor-pointer" : undefined} />;
            }}
            onClick={(_, i) => {
              const item = linhas[i]?.item;
              if (item) abrir(item);
            }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="acumulado"
            dataKey="acumulado"
            type="linear"
            stroke="var(--color-acumulado)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </BlocoGrafico>
  );
}
