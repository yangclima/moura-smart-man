"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { CLASSES_CONCILIACAO, type ClasseConciliacao } from "@/lib/historico";
import type { FiltroLista, QualidadeMaquina } from "@/lib/indicadores-historico";
import { BotaoNumero } from "../BotaoNumero";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { CHAVE_CLASSE, COR_CLASSE_GRAFICO } from "./cores";

const CONFIG: ChartConfig = Object.fromEntries(
  CLASSES_CONCILIACAO.map((c) => [CHAVE_CLASSE[c], { label: c, color: COR_CLASSE_GRAFICO[c] }]),
);

/** Rótulo dentro do segmento só quando ele tem ao menos 7% da barra. */
const PCT_MINIMO_ROTULO = 7;
const ALTURA_BARRA = 44;
const ALTURA_EIXOS = 64;

/** Texto sobre a faixa: claro nos azuis, marinho no amarelo (e no azul claro do tema escuro). */
const TEXTO_CLASSE: Record<ClasseConciliacao, string> = {
  "MES + SAP": "fill-white",
  "MES sem SAP": "fill-moura-marinho",
  "SAP sem MES": "fill-white dark:fill-moura-marinho",
};

const pct = (n: number, total: number) => (total === 0 ? 0 : (100 * n) / total);

type Linha = { maquina: string; rotulo: string; total: number } & Record<string, number | string>;

function titulo(porMaquina: QualidadeMaquina[]): string {
  const taxas = porMaquina
    .map((m) => ({ maquina: m.maquina, taxa: pct(m.classes["MES + SAP"], m.total) }))
    .sort((a, b) => a.taxa - b.taxa);
  const pior = taxas[0];
  if (!pior) return "Classes da conciliação por máquina";
  if (taxas.length === 1) return `Na máquina ${pior.maquina}, ${Math.round(pior.taxa)}% dos eventos conciliam MES e SAP`;
  if (pior.taxa < 50) return `Na máquina ${pior.maquina}, a maior parte dos eventos não concilia`;
  return `Todas as máquinas conciliam a maioria dos eventos; a menor taxa é ${Math.round(pior.taxa)}% (máquina ${pior.maquina})`;
}

interface Props {
  porMaquina: QualidadeMaquina[];
  onAbrir: (f: FiltroLista) => void;
}

/** Barras 100% por máquina: quanto de cada máquina os dois sistemas explicam juntos. */
export function GraficoClasses({ porMaquina, onAbrir }: Props) {
  const linhas: Linha[] = porMaquina.map((m) => ({
    maquina: m.maquina,
    rotulo: `Máquina ${m.maquina}`,
    total: m.total,
    ...Object.fromEntries(
      CLASSES_CONCILIACAO.flatMap((c) => [
        [CHAVE_CLASSE[c], pct(m.classes[c], m.total)],
        [`n_${CHAVE_CLASSE[c]}`, m.classes[c]],
      ]),
    ),
  }));
  const total = porMaquina.reduce((s, m) => s + m.total, 0);

  return (
    <BlocoGrafico
      embutido
      titulo={titulo(porMaquina)}
      descricao="Classe dos eventos por máquina (100% = eventos da máquina). Clique num segmento para ver os eventos."
      n={`n = ${total} eventos`}
      vazio={total === 0}
      dados={{
        colunas: ["Máquina", ...CLASSES_CONCILIACAO, "Total"],
        linhas: porMaquina.map((m) => ({
          chave: m.maquina,
          celulas: [
            `Máquina ${m.maquina}`,
            ...CLASSES_CONCILIACAO.map((c) =>
              m.classes[c] === 0 ? (
                "0"
              ) : (
                <BotaoNumero key={c} rotulo={`Ver na lista: máquina ${m.maquina}, ${c}`} onClick={() => onAbrir({ maquina: m.maquina, classe: c })}>
                  {`${m.classes[c]} (${Math.round(pct(m.classes[c], m.total))}%)`}
                </BotaoNumero>
              ),
            ),
            m.total,
          ],
        })),
      }}
    >
      <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height: linhas.length * ALTURA_BARRA + ALTURA_EIXOS }}>
        <BarChart data={linhas} layout="vertical" margin={{ left: 4, right: 12 }} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <YAxis type="category" dataKey="rotulo" width={84} tickLine={false} axisLine={false} />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.4 }}
            content={({ active, payload }) => {
              const l = active ? (payload?.[0]?.payload as Linha | undefined) : undefined;
              if (!l) return null;
              return (
                <CaixaTooltip
                  titulo={`${l.rotulo} · n = ${l.total}`}
                  linhas={CLASSES_CONCILIACAO.map((c) => ({
                    rotulo: c,
                    cor: COR_CLASSE_GRAFICO[c],
                    valor: `${l[`n_${CHAVE_CLASSE[c]}`]} (${Math.round(Number(l[CHAVE_CLASSE[c]]))}%)`,
                  }))}
                />
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          {CLASSES_CONCILIACAO.map((c) => {
            const chave = CHAVE_CLASSE[c];
            return (
              <Bar
                key={c}
                dataKey={chave}
                stackId="classes"
                fill={`var(--color-${chave})`}
                barSize={28}
                className="cursor-pointer"
                onClick={(_, i) => onAbrir({ maquina: linhas[i].maquina, classe: c })}
              >
                <LabelList
                  dataKey={`n_${chave}`}
                  content={({ x, y, width, height, value, index }) => {
                    if (index === undefined || Number(linhas[index]?.[chave]) < PCT_MINIMO_ROTULO) return null;
                    return (
                      <text
                        x={Number(x) + Number(width) / 2}
                        y={Number(y) + Number(height) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={`pointer-events-none text-xs font-semibold tabular-nums ${TEXTO_CLASSE[c]}`}
                      >
                        {value}
                      </text>
                    );
                  }}
                />
              </Bar>
            );
          })}
        </BarChart>
      </ChartContainer>
    </BlocoGrafico>
  );
}
