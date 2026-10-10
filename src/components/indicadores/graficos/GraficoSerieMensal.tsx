"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/components/ui/chart";
import type { EventoHistorico } from "@/lib/historico";
import { serieMensal, type FiltroLista, type MetricaSerie, type PeriodoSerie, type SerieMensal } from "@/lib/indicadores-historico";
import { formatarMinutos } from "@/lib/tempo";
import { BotaoNumero } from "../BotaoNumero";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { COR, configMaquinas, corMaquina } from "./cores";
import { SeletorGrafico } from "./SeletorGrafico";

const METRICAS: Record<MetricaSerie, string> = { horas: "Horas paradas", quebras: "Quebras" };
const MIN_POR_H = 60;
/** Períodos completos comparados em cada janela da tendência. */
const JANELA_TENDENCIA = 3;
/** Alta relativa a partir da qual o título aponta deterioração. */
const ALTA_RELEVANTE = 0.2;
/** Sufixo das séries tracejadas (trechos que tocam um período incompleto). */
const PARCIAL = "__parcial";

const formatarValor = (v: number, m: MetricaSerie) => (m === "horas" ? formatarMinutos(v * MIN_POR_H) : `${v}`);

type Linha = Record<string, number | string | null> & { idx: number; rotulo: string };

/**
 * Cada máquina vira duas séries: a contínua só nos períodos completos e a tracejada nos
 * incompletos e no vizinho, para o trecho até a ponta parcial não parecer queda.
 */
function linhasDoGrafico(s: SerieMensal): Linha[] {
  const inc = s.periodos.map((p) => p.incompleto);
  return s.periodos.map((p, i) => {
    const tocaIncompleto = inc[i] || inc[i - 1] === true || inc[i + 1] === true;
    const valores = Object.fromEntries(
      s.maquinas.flatMap((m) => [
        [m, inc[i] ? null : p.valores[m]],
        [`${m}${PARCIAL}`, tocaIncompleto ? p.valores[m] : null],
      ]),
    );
    return { idx: i, rotulo: p.rotulo, ...valores };
  });
}

/** Máquina com a maior alta entre as duas últimas janelas de períodos completos. */
function titulo(s: SerieMensal, metrica: MetricaSerie): string {
  const unidade = s.granularidade === "mes" ? "meses" : "semanas";
  const completos = s.periodos.filter((p) => !p.incompleto);
  if (completos.length < 2 * JANELA_TENDENCIA) {
    return `${METRICAS[metrica]} por ${s.granularidade === "mes" ? "mês" : "semana"} e máquina`;
  }
  const media = (ps: PeriodoSerie[], m: string) => ps.reduce((t, p) => t + p.valores[m], 0) / ps.length;
  const recentes = completos.slice(-JANELA_TENDENCIA);
  const anteriores = completos.slice(-2 * JANELA_TENDENCIA, -JANELA_TENDENCIA);
  const altas = s.maquinas
    .map((m) => ({ m, antes: media(anteriores, m), depois: media(recentes, m) }))
    .filter((a) => a.antes > 0)
    .map((a) => ({ ...a, alta: (a.depois - a.antes) / a.antes }))
    .sort((a, b) => b.alta - a.alta);
  const maior = altas[0];
  if (!maior || maior.alta < ALTA_RELEVANTE) {
    return `Nenhuma máquina com alta clara de ${METRICAS[metrica].toLowerCase()} nos últimos ${JANELA_TENDENCIA} ${unidade}`;
  }
  return `Máquina ${maior.m}: ${METRICAS[metrica].toLowerCase()} subiram ${Math.round(100 * maior.alta)}% nos últimos ${JANELA_TENDENCIA} ${unidade}`;
}

interface PontoProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number | null;
}

interface PontoSerieProps extends PontoProps {
  maquina: string;
  /** Série tracejada: desenha só os pontos dos períodos incompletos. */
  parcial: boolean;
  periodos: PeriodoSerie[];
  onAbrir: (maquina: string, p: PeriodoSerie) => void;
}

/** Ponto clicável; vazado nos períodos incompletos. Só a série certa desenha cada ponto. */
function PontoSerie({ cx, cy, index, value, maquina, parcial, periodos, onAbrir }: PontoSerieProps) {
  const p = index === undefined ? undefined : periodos[index];
  if (cx === undefined || cy === undefined || value === null || value === undefined || !p || p.incompleto !== parcial) {
    return <g />;
  }
  const cor = corMaquina(maquina);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      strokeWidth={2}
      stroke={cor}
      fill={p.incompleto ? COR.fundo : cor}
      className="cursor-pointer"
      onClick={() => onAbrir(maquina, p)}
    />
  );
}

interface Props {
  eventos: EventoHistorico[];
  onAbrir: (f: FiltroLista) => void;
}

/** Linhas por máquina ao longo do tempo: a ponte para os sinais de deterioração (Subproduto 5). */
export function GraficoSerieMensal({ eventos, onAbrir }: Props) {
  const [metrica, setMetrica] = useState<MetricaSerie>("horas");
  const serie = serieMensal(eventos, metrica);
  const linhas = linhasDoGrafico(serie);
  const nTotal = serie.periodos.reduce((t, p) => t + serie.maquinas.reduce((u, m) => u + p.n[m], 0), 0);
  const porSemana = serie.granularidade === "semana";

  function abrir(maquina: string, p: PeriodoSerie) {
    onAbrir({
      maquina,
      periodo: { inicio: p.inicio, fim: p.fim, rotulo: porSemana ? `semana de ${p.rotulo}` : p.rotulo },
      quebra: metrica === "quebras" ? true : undefined,
    });
  }

  return (
    <BlocoGrafico
      titulo={titulo(serie, metrica)}
      descricao={
        <>
          {metrica === "horas" ? "Soma da indisponibilidade" : "Paradas com registro de quebra"} por{" "}
          {porSemana ? "semana (o histórico cobre menos de 4 meses)" : "mês"}, pelo início da parada no MES. Clique num
          ponto para ver os eventos.
        </>
      }
      acoes={<SeletorGrafico rotulo="Métrica" valor={metrica} opcoes={METRICAS} onChange={setMetrica} />}
      n={`n = ${nTotal} paradas do MES (com ou sem ordem no SAP)`}
      vazio={serie.periodos.length === 0}
      dados={{
        colunas: [porSemana ? "Semana de" : "Mês", ...serie.maquinas.map((m) => `Máquina ${m}`)],
        linhas: serie.periodos.map((p) => ({
          chave: p.chave,
          celulas: [
            p.incompleto ? `${p.rotulo} (incompleto)` : p.rotulo,
            ...serie.maquinas.map((m) =>
              p.n[m] === 0 ? (
                formatarValor(p.valores[m], metrica)
              ) : (
                <BotaoNumero key={m} rotulo={`Ver na lista: máquina ${m}, ${p.rotulo}`} onClick={() => abrir(m, p)}>
                  {formatarValor(p.valores[m], metrica)}
                </BotaoNumero>
              ),
            ),
          ],
        })),
      }}
      nota="Ponto vazado e linha tracejada: período incompleto no começo ou no fim do histórico. Não é queda, é falta de dado."
    >
      <ChartContainer config={configMaquinas(serie.maquinas)} className="aspect-auto h-72 w-full">
        <LineChart data={linhas} margin={{ left: 0, right: 16, top: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={12} />
          <YAxis
            width={64}
            allowDecimals={metrica === "horas"}
            tickFormatter={(v: number) => (metrica === "horas" ? `${Math.round(v)} h` : `${v}`)}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              const l = active ? (payload?.[0]?.payload as Linha | undefined) : undefined;
              const p = l ? serie.periodos[l.idx] : undefined;
              if (!p) return null;
              return (
                <CaixaTooltip
                  titulo={`${porSemana ? "Semana de " : ""}${p.rotulo}${p.incompleto ? " · incompleto" : ""}`}
                  linhas={serie.maquinas.map((m) => ({
                    rotulo: `Máquina ${m}`,
                    cor: corMaquina(m),
                    valor: formatarValor(p.valores[m], metrica),
                    detalhe: `n = ${p.n[m]}`,
                  }))}
                />
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          {serie.maquinas.flatMap((m) => [
            <Line
              key={m}
              dataKey={m}
              type="linear"
              stroke={`var(--color-${m})`}
              strokeWidth={2}
              connectNulls={false}
              dot={(p: PontoProps) => (
                <PontoSerie key={`${m}-false-${p.index}`} {...p} maquina={m} parcial={false} periodos={serie.periodos} onAbrir={abrir} />
              )}
              activeDot={false}
              isAnimationActive={false}
            />,
            <Line
              key={`${m}${PARCIAL}`}
              dataKey={`${m}${PARCIAL}`}
              type="linear"
              stroke={`var(--color-${m})`}
              strokeWidth={2}
              strokeDasharray="5 4"
              connectNulls={false}
              dot={(p: PontoProps) => (
                <PontoSerie key={`${m}-true-${p.index}`} {...p} maquina={m} parcial={true} periodos={serie.periodos} onAbrir={abrir} />
              )}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />,
          ])}
        </LineChart>
      </ChartContainer>
    </BlocoGrafico>
  );
}
