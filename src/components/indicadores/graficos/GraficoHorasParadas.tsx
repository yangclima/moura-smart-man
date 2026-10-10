"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTempoReal } from "@/hooks/useTempoReal";
import { carregarEncerrados } from "@/lib/chamados";
import { dataRecife, meiaNoiteRecife, MS_POR_DIA } from "@/lib/fuso";
import { serieHorasParadas, type PontoHorasParadas } from "@/lib/indicadores";
import { formatarMinutos } from "@/lib/tempo";
import type { Chamado } from "@/lib/tipos";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { corMaquina } from "./cores";
import { SeletorGrafico } from "./SeletorGrafico";

const TODAS = "todas";
/** Intervalo próprio do gráfico, independente do filtro da página. */
const INTERVALOS = { "7": "7 dias", "30": "30 dias", "90": "90 dias", "180": "180 dias" } as const;
type Intervalo = keyof typeof INTERVALOS;
/** Acima disso os pontos da linha ficam escondidos (aparecem só no hover). */
const MAX_PONTOS_VISIVEIS = 31;
const MIN_POR_H = 60;
const VAZIO: Chamado[] = [];

const formatarHoras = (h: number) => formatarMinutos(h * MIN_POR_H);
/** Chave segura para CSS: o nome da máquina tem espaço ("Máquina A"). */
const chave = (i: number) => `m${i}`;

function meiaNoiteDeHoje(): number {
  const d = dataRecife(Date.now());
  return meiaNoiteRecife(d.ano, d.mes, d.dia);
}

function titulo(pontos: PontoHorasParadas[], maquinas: string[], selecionada: string | null): string {
  const total = (m: string) => pontos.reduce((s, p) => s + p.horas[m], 0);
  if (selecionada) {
    const h = total(selecionada);
    if (h === 0) return `${selecionada}: nenhuma hora parada no intervalo`;
    const pico = [...pontos].sort((a, b) => b.horas[selecionada] - a.horas[selecionada])[0];
    return `${selecionada}: ${formatarHoras(h)} parada no intervalo, com pico em ${pico.rotulo}`;
  }
  const geral = maquinas.reduce((s, m) => s + total(m), 0);
  const maior = [...maquinas].sort((a, b) => total(b) - total(a))[0];
  if (!maior || geral === 0) return "Horas paradas por dia";
  return `${maior} concentra ${Math.round((100 * total(maior)) / geral)}% das horas paradas do intervalo`;
}

/** Horas paradas por dia de abertura, uma linha por máquina, com filtro de máquina e intervalo próprio. */
export function GraficoHorasParadas() {
  const [filtro, setFiltro] = useState<string>(TODAS);
  const [intervalo, setIntervalo] = useState<Intervalo>("30");
  const [hoje] = useState(meiaNoiteDeHoje);
  const desde = hoje - (Number(intervalo) - 1) * MS_POR_DIA;
  const ate = hoje + MS_POR_DIA - 1;
  // Busca própria: o intervalo pode ir além do período carregado pela página.
  const { dados: parados, carregando, erro } = useTempoReal(
    `horas-paradas/${desde}`,
    () => carregarEncerrados(desde, true),
    [{ tabela: "chamados" }],
    VAZIO,
  );

  const serie = serieHorasParadas(parados, desde, ate);
  // Se a máquina escolhida sumiu do intervalo, volta para todas.
  const selecionada = filtro !== TODAS && serie.maquinas.includes(filtro) ? filtro : null;
  const visiveis = selecionada ? [selecionada] : serie.maquinas;
  const indice = new Map(serie.maquinas.map((m, i) => [m, i]));
  const config: ChartConfig = Object.fromEntries(
    visiveis.map((m) => [chave(indice.get(m)!), { label: m, color: corMaquina(m) }]),
  );
  const linhas = serie.pontos.map((p) => ({
    rotulo: p.rotulo,
    dia: p.dia,
    ...Object.fromEntries(visiveis.map((m) => [chave(indice.get(m)!), p.horas[m]])),
  }));
  const n = serie.pontos.reduce((s, p) => s + visiveis.reduce((t, m) => t + p.n[m], 0), 0);
  const totalH = serie.pontos.reduce((s, p) => s + visiveis.reduce((t, m) => t + p.horas[m], 0), 0);
  const comPontos = linhas.length <= MAX_PONTOS_VISIVEIS;

  const acoes = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selecionada ?? TODAS} onValueChange={setFiltro}>
        <SelectTrigger className="w-44" aria-label="Máquina">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS}>Todas as máquinas</SelectItem>
          {serie.maquinas.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SeletorGrafico rotulo="Intervalo" valor={intervalo} opcoes={INTERVALOS} onChange={setIntervalo} />
    </div>
  );

  return (
    <BlocoGrafico
      titulo={carregando ? "Horas paradas por dia" : titulo(serie.pontos, serie.maquinas, selecionada)}
      descricao={`Soma da indisponibilidade (T5−T0) dos chamados com máquina parada, por dia de abertura, nos últimos ${INTERVALOS[intervalo]}.`}
      acoes={acoes}
      n={`n = ${n} chamados com máquina parada · total ${formatarHoras(totalH)}`}
      vazio={!carregando && !erro && n === 0}
      dados={{
        colunas: ["Dia", ...visiveis, ...(visiveis.length > 1 ? ["Total"] : [])],
        linhas: serie.pontos.map((p) => ({
          chave: p.dia,
          celulas: [
            p.rotulo,
            ...visiveis.map((m) => formatarHoras(p.horas[m])),
            ...(visiveis.length > 1 ? [formatarHoras(visiveis.reduce((s, m) => s + p.horas[m], 0))] : []),
          ],
        })),
      }}
    >
      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : carregando ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <LineChart data={linhas} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis
              width={56}
              tickFormatter={(v: number) => (v === 0 ? "0" : `${Number(v.toFixed(1))} h`)}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                const dia = active ? (payload?.[0]?.payload as { dia?: string } | undefined)?.dia : undefined;
                const p = serie.pontos.find((x) => x.dia === dia);
                if (!p) return null;
                const total = visiveis.reduce((s, m) => s + p.horas[m], 0);
                return (
                  <CaixaTooltip
                    titulo={p.rotulo}
                    linhas={visiveis.map((m) => ({
                      rotulo: m,
                      cor: corMaquina(m),
                      valor: formatarHoras(p.horas[m]),
                      detalhe: `n = ${p.n[m]}`,
                    }))}
                    rodape={visiveis.length > 1 ? `Total: ${formatarHoras(total)}` : undefined}
                  />
                );
              }}
            />
            {visiveis.length > 1 && <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />}
            {visiveis.map((m) => {
              const k = chave(indice.get(m)!);
              return (
                <Line
                  key={k}
                  dataKey={k}
                  type="linear"
                  stroke={`var(--color-${k})`}
                  strokeWidth={2}
                  dot={comPontos ? { r: 3, fill: `var(--color-${k})` } : false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ChartContainer>
      )}
    </BlocoGrafico>
  );
}
