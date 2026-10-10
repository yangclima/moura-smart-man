"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, useXAxisScale, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { ResumoTempo } from "@/lib/indicadores";
import { distribuicaoEspera, LIMITE_EIXO_ESPERA_MIN, type DistribuicaoEspera, type FiltroLista } from "@/lib/indicadores-historico";
import type { EventoHistorico } from "@/lib/historico";
import { formatarMinutos } from "@/lib/tempo";
import { BotaoNumero } from "../BotaoNumero";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { COR, configMaquinas, corMaquina } from "./cores";
import { formatarEixoMin } from "./eixo";

const ALTURA_FAIXA = 48;
const ALTURA_EIXOS = 64;
const ESPESSURA_CAIXA = 18;
const TICKS = [-120, -60, 0, 60, 120];

type Completa = DistribuicaoEspera & { p10: number; p25: number; mediana: number; p75: number; p90: number };
type Linha = Completa & { rotulo: string; faixa: [number, number] };

const recortar = (v: number) => Math.max(-LIMITE_EIXO_ESPERA_MIN, Math.min(LIMITE_EIXO_ESPERA_MIN, v));

/** Linha fina P10–P90, caixa P25–P75 e traço na mediana; desenhada sobre a escala real do eixo. */
function Intervalo({ y, height, payload }: { y?: number; height?: number; payload?: Linha }) {
  const escala = useXAxisScale();
  if (!escala || y === undefined || height === undefined || !payload) return null;
  const px = (v: number) => escala(recortar(v)) ?? 0;
  const meio = y + height / 2;
  const cor = corMaquina(payload.maquina);
  return (
    <g className="cursor-pointer">
      {/* Área de clique do tamanho da faixa inteira. */}
      <rect x={px(payload.p10)} y={y} width={Math.max(px(payload.p90) - px(payload.p10), 8)} height={height} fill="transparent" />
      <line x1={px(payload.p10)} x2={px(payload.p90)} y1={meio} y2={meio} stroke={cor} strokeWidth={2} />
      <rect
        x={px(payload.p25)}
        y={meio - ESPESSURA_CAIXA / 2}
        width={Math.max(px(payload.p75) - px(payload.p25), 2)}
        height={ESPESSURA_CAIXA}
        rx={3}
        fill={cor}
        fillOpacity={0.85}
      />
      <line
        x1={px(payload.mediana)}
        x2={px(payload.mediana)}
        y1={meio - ESPESSURA_CAIXA / 2 - 4}
        y2={meio + ESPESSURA_CAIXA / 2 + 4}
        stroke={COR.destaque}
        strokeWidth={3}
      />
    </g>
  );
}

/** Anotação colada à esquerda da linha do zero. */
function RotuloZero({ viewBox }: { viewBox?: { x?: number; y?: number } }) {
  if (viewBox?.x === undefined || viewBox.y === undefined) return null;
  return (
    <text x={viewBox.x - 6} y={viewBox.y - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">
      ← à esquerda do zero: SAP apontado antes da parada
    </text>
  );
}

function titulo(linhas: Completa[]): string {
  const negativas = linhas.filter((l) => l.mediana < 0).sort((a, b) => a.mediana - b.mediana);
  if (negativas.length > 0) {
    const m = negativas[0];
    return `Na máquina ${m.maquina}, a espera mediana é negativa (${formatarMinutos(m.mediana)}): o horário do SAP não é confiável`;
  }
  const medianas = linhas.map((l) => l.mediana);
  return `No histórico, a espera é só estimada: mediana entre ${formatarMinutos(Math.min(...medianas))} e ${formatarMinutos(Math.max(...medianas))} por máquina`;
}

interface Props {
  eventos: EventoHistorico[];
  /** Reação medida na aba Operação, para o contraste. */
  reacaoOperacao: ResumoTempo;
  carregandoOperacao: boolean;
  onAbrir: (f: FiltroLista) => void;
}

export function GraficoEspera({ eventos, reacaoOperacao, carregandoOperacao, onAbrir }: Props) {
  const dist = distribuicaoEspera(eventos);
  const completas = dist.filter((d): d is Completa => d.n > 0);
  const semDados = dist.filter((d) => d.n === 0).map((d) => d.maquina);
  const linhas: Linha[] = completas.map((d) => ({
    ...d,
    rotulo: `Máquina ${d.maquina}`,
    faixa: [recortar(d.p10), recortar(d.p90)],
  }));
  const n = completas.reduce((s, d) => s + d.n, 0);
  const fora = completas.reduce((s, d) => s + d.abaixo + d.acima, 0);
  const abrir = (maquina: string) => onAbrir({ maquina, classe: "MES + SAP" });

  return (
    <BlocoGrafico
      titulo={completas.length === 0 ? "Espera até a atuação por máquina" : titulo(completas)}
      descricao="Espera até a atuação (T2−T0) no histórico: do início da parada no MES ao início apontado no SAP."
      n={`n = ${n} pares MES + SAP de confiança alta ou média`}
      vazio={completas.length === 0}
      dados={{
        colunas: ["Máquina", "n", "P10", "P25", "Mediana", "P75", "P90", "Fora de ±2 h"],
        linhas: completas.map((d) => ({
          chave: d.maquina,
          celulas: [
            <BotaoNumero key="m" rotulo={`Ver na lista: máquina ${d.maquina}, MES + SAP`} onClick={() => abrir(d.maquina)}>
              {`Máquina ${d.maquina}`}
            </BotaoNumero>,
            d.n,
            formatarMinutos(d.p10),
            formatarMinutos(d.p25),
            formatarMinutos(d.mediana),
            formatarMinutos(d.p75),
            formatarMinutos(d.p90),
            d.abaixo + d.acima,
          ],
        })),
      }}
      nota={
        <div className="grid gap-1">
          <p>
            Caixa: P25 a P75 · traço: mediana · linha fina: P10 a P90. Clique numa máquina para ver os eventos.
            {semDados.length > 0 && <> Sem pares confiáveis: máquina {semDados.join(", ")}.</>}
          </p>
          {fora > 0 && (
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Eixo recortado em ±2 h: {fora} evento(s) ficam fora e aparecem encostados na borda.
            </p>
          )}
          <p>
            Com acionamento digital, a reação (T1−T0) é medida, não estimada: mediana de{" "}
            <strong className="text-foreground tabular-nums">
              {carregandoOperacao ? "…" : formatarMinutos(reacaoOperacao.mediana)}
            </strong>{" "}
            na aba Operação.
          </p>
        </div>
      }
    >
      <ChartContainer
        config={configMaquinas(completas.map((d) => d.maquina))}
        className="aspect-auto w-full"
        style={{ height: linhas.length * ALTURA_FAIXA + ALTURA_EIXOS }}
      >
        <BarChart data={linhas} layout="vertical" margin={{ left: 4, right: 16, top: 22 }} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <YAxis type="category" dataKey="rotulo" width={84} tickLine={false} axisLine={false} />
          <XAxis
            type="number"
            domain={[-LIMITE_EIXO_ESPERA_MIN, LIMITE_EIXO_ESPERA_MIN]}
            ticks={TICKS}
            allowDataOverflow
            tickFormatter={formatarEixoMin}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine x={0} stroke={COR.referencia} strokeWidth={1.5} label={RotuloZero} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.3 }}
            content={({ active, payload }) => {
              const l = active ? (payload?.[0]?.payload as Linha | undefined) : undefined;
              if (!l) return null;
              const cor = corMaquina(l.maquina);
              return (
                <CaixaTooltip
                  titulo={`${l.rotulo} · n = ${l.n}`}
                  linhas={[
                    { rotulo: "P10", valor: formatarMinutos(l.p10) },
                    { rotulo: "P25", valor: formatarMinutos(l.p25), cor },
                    { rotulo: "Mediana", valor: formatarMinutos(l.mediana), cor: COR.destaque },
                    { rotulo: "P75", valor: formatarMinutos(l.p75), cor },
                    { rotulo: "P90", valor: formatarMinutos(l.p90) },
                  ]}
                  rodape={l.abaixo + l.acima > 0 ? `${l.abaixo + l.acima} fora de ±2 h` : undefined}
                />
              );
            }}
          />
          <Bar
            dataKey="faixa"
            // Como elemento (e não função) para o hook de escala rodar dentro de um componente.
            shape={(p: { y?: number; height?: number; payload?: Linha }) => <Intervalo y={p.y} height={p.height} payload={p.payload} />}
            onClick={(_, i) => abrir(linhas[i].maquina)} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </BlocoGrafico>
  );
}
