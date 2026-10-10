"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { MIN_CHAMADOS_DIA, serieDiaria, type PontoDiario } from "@/lib/indicadores";
import { chaveDia } from "@/lib/fuso";
import { formatarMinutos, mediana, temposChamado } from "@/lib/tempo";
import type { Chamado, Instante } from "@/lib/tipos";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { COR } from "./cores";
import { formatarEixoMin } from "./eixo";

const CONFIG: ChartConfig = {
  encerrados: { label: "Chamados encerrados", color: COR.azulClaro },
  esperaMediana: { label: "Espera mediana (T2−T0)", color: COR.azul },
};

const SYNC = "evolucao-operacao";
const LARGURA_EIXO_Y = 56;
/** Variação abaixo disso entre as metades do período é tratada como estável. */
const VARIACAO_RELEVANTE = 0.15;

/** Compara a espera mediana da primeira e da segunda metade do período. */
function titulo(serie: PontoDiario[], encerrados: Chamado[]): string {
  const padrao = "Chamados e espera até o início, por dia";
  if (serie.length < 2) return padrao;
  // Chaves "AAAA-MM-DD" comparam na ordem do calendário.
  const corte = serie[Math.floor(serie.length / 2)].dia;
  const esperaMediana = (segundaMetade: boolean) =>
    mediana(
      encerrados.flatMap((c) => {
        const e = temposChamado(c).esperaMin;
        return e === null || chaveDia(c.marcos.abertura) >= corte !== segundaMetade ? [] : [e];
      }),
    );
  const antes = esperaMediana(false);
  const depois = esperaMediana(true);
  if (antes === null || depois === null || antes <= 0) return padrao;
  const variacao = (depois - antes) / antes;
  if (Math.abs(variacao) < VARIACAO_RELEVANTE) return `Espera até o início estável no período, perto de ${formatarMinutos(depois)}`;
  const verbo = variacao < 0 ? "caiu" : "subiu";
  return `Espera até o início ${verbo} de ${formatarMinutos(antes)} para ${formatarMinutos(depois)} na segunda metade do período`;
}

/** Ponto cheio; vazado quando o dia tem menos de 3 chamados (mediana instável). */
function PontoEspera(props: { cx?: number; cy?: number; payload?: PontoDiario; index?: number }) {
  const { cx, cy, payload, index } = props;
  if (cx === undefined || cy === undefined || !payload || payload.esperaMediana === null) return <g key={index} />;
  const instavel = payload.nEspera < MIN_CHAMADOS_DIA;
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={4}
      strokeWidth={2}
      stroke="var(--color-esperaMediana)"
      fill={instavel ? COR.fundo : "var(--color-esperaMediana)"}
    />
  );
}

function Tooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: PontoDiario }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <CaixaTooltip
      titulo={p.rotulo}
      linhas={[
        { rotulo: "Chamados encerrados", valor: p.encerrados, cor: "var(--color-encerrados)" },
        {
          rotulo: "Espera mediana",
          valor: formatarMinutos(p.esperaMediana),
          cor: "var(--color-esperaMediana)",
          detalhe: `n = ${p.nEspera}${p.nEspera > 0 && p.nEspera < MIN_CHAMADOS_DIA ? " · instável" : ""}`,
        },
      ]}
    />
  );
}

interface Props {
  encerrados: Chamado[];
  desde: Instante;
  ate: Instante;
  /** Meta de início da classe P2, linha de referência. */
  metaP2: number | null;
}

/** Dois gráficos empilhados no mesmo eixo de dias: volume em cima, espera mediana embaixo. */
export function GraficoEvolucao({ encerrados, desde, ate, metaP2 }: Props) {
  const serie = serieDiaria(encerrados, desde, ate);
  const comEspera = serie.reduce((s, p) => s + p.nEspera, 0);

  return (
    <BlocoGrafico
      titulo={titulo(serie, encerrados)}
      descricao="Por dia de abertura do chamado (T0), no fuso de Recife."
      n={`n = ${encerrados.length} chamados encerrados · ${comEspera} com início do atendimento (T2)`}
      vazio={encerrados.length === 0}
      dados={{
        colunas: ["Dia", "Encerrados", "Espera mediana", "n da espera"],
        linhas: serie.map((p) => ({
          chave: p.dia,
          celulas: [p.rotulo, p.encerrados, formatarMinutos(p.esperaMediana), p.nEspera],
        })),
      }}
      nota={
        <>
          Ponto vazado: dia com menos de {MIN_CHAMADOS_DIA} chamados, mediana instável. Dias sem chamado não ligam a linha.
          {metaP2 !== null && <> Tracejado: meta de início da classe P2 ({formatarMinutos(metaP2)}).</>}
        </>
      }
    >
      <div className="grid gap-1">
        <ChartContainer config={CONFIG} className="aspect-auto h-32 w-full">
          <BarChart data={serie} syncId={SYNC} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" hide />
            <YAxis width={LARGURA_EIXO_Y} allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={Tooltip} />
            <Bar dataKey="encerrados" fill="var(--color-encerrados)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <ChartContainer config={CONFIG} className="aspect-auto h-44 w-full">
          <LineChart data={serie} syncId={SYNC} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis
              width={LARGURA_EIXO_Y}
              tickFormatter={formatarEixoMin}
              tickLine={false}
              axisLine={false}
              domain={[0, (max: number) => Math.max(max, metaP2 ?? 0)]}
            />
            <ChartTooltip content={Tooltip} />
            {metaP2 !== null && <ReferenceLine y={metaP2} stroke={COR.referencia} strokeDasharray="5 4" />}
            <Line
              dataKey="esperaMediana"
              type="linear"
              stroke="var(--color-esperaMediana)"
              strokeWidth={2}
              connectNulls={false}
              dot={PontoEspera}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </BlocoGrafico>
  );
}
