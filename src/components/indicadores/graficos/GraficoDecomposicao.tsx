"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import {
  decomposicaoTempo,
  ROTULOS_TRECHO,
  TRECHOS,
  type AgrupamentoDecomposicao,
  type Decomposicao,
  type Trecho,
} from "@/lib/indicadores";
import { formatarMinutos } from "@/lib/tempo";
import type { Chamado, ConfigPriorizacao } from "@/lib/tipos";
import { BlocoGrafico } from "./BlocoGrafico";
import { CaixaTooltip } from "./CaixaTooltip";
import { COR_TRECHO } from "./cores";
import { formatarEixoMin } from "./eixo";
import { SeletorGrafico } from "./SeletorGrafico";

const AGRUPAMENTOS: Record<AgrupamentoDecomposicao, string> = { maquina: "Por máquina", classe: "Por classe" };

const NOME_TRECHO: Record<Trecho, string> = {
  reacao: "a reação",
  deslocamento: "o deslocamento",
  reparo: "o reparo líquido",
  pausas: "as pausas",
  liberacao: "a liberação",
};

const CONFIG: ChartConfig = Object.fromEntries(TRECHOS.map((t) => [t, { label: ROTULOS_TRECHO[t], color: COR_TRECHO[t] }]));

const ALTURA_BARRA = 44;
const ALTURA_EIXOS = 72;

/** Trecho com a maior fatia do tempo parado, somando todos os chamados. */
function titulo(d: Decomposicao): string {
  const total = d.grupos.reduce((s, g) => s + g.indisponibilidadeMedia * g.n, 0);
  if (total <= 0) return "Para onde vai o tempo do chamado";
  const porTrecho = TRECHOS.map((t) => ({ t, min: d.grupos.reduce((s, g) => s + g.media[t] * g.n, 0) }));
  const maior = porTrecho.sort((a, b) => b.min - a.min)[0];
  const nome = NOME_TRECHO[maior.t];
  return `${nome[0].toUpperCase()}${nome.slice(1)} é o maior trecho: ${Math.round((100 * maior.min) / total)}% do tempo parado`;
}

interface Props {
  encerrados: Chamado[];
  config: ConfigPriorizacao;
}

/** Barras empilhadas com a média de cada trecho T0 → T5; a barra inteira é a indisponibilidade média. */
export function GraficoDecomposicao({ encerrados, config }: Props) {
  const [agrupamento, setAgrupamento] = useState<AgrupamentoDecomposicao>("maquina");
  const d = decomposicaoTempo(encerrados, agrupamento, config);
  const linhas = d.grupos.map((g) => ({ grupo: g.grupo, ...g.media }));

  return (
    <BlocoGrafico
      titulo={titulo(d)}
      descricao="Média de cada trecho, do aviso (T0) à liberação (T5). A barra inteira é a indisponibilidade média."
      acoes={<SeletorGrafico rotulo="Agrupar" valor={agrupamento} opcoes={AGRUPAMENTOS} onChange={setAgrupamento} />}
      n={`n = ${d.n} de ${d.total} chamados (só os com todos os marcos T0, T1, T2, T4 e T5)`}
      vazio={d.n === 0}
      dados={{
        colunas: [agrupamento === "maquina" ? "Máquina" : "Classe", "n", ...TRECHOS.map((t) => ROTULOS_TRECHO[t]), "Total"],
        linhas: d.grupos.map((g) => ({
          chave: g.grupo,
          celulas: [g.grupo, g.n, ...TRECHOS.map((t) => formatarMinutos(g.media[t])), formatarMinutos(g.indisponibilidadeMedia)],
        })),
      }}
      nota="Na tabela, médias. A mediana de cada trecho aparece no tooltip."
    >
      <ChartContainer
        config={CONFIG}
        className="aspect-auto w-full"
        style={{ height: d.grupos.length * ALTURA_BARRA + ALTURA_EIXOS }}
      >
        <BarChart data={linhas} layout="vertical" margin={{ left: 4, right: 16 }} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <YAxis type="category" dataKey="grupo" width={96} tickLine={false} axisLine={false} />
          <XAxis type="number" tickFormatter={formatarEixoMin} tickLine={false} axisLine={false} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.4 }}
            content={({ active, payload }) => {
              const g = active ? d.grupos.find((x) => x.grupo === payload?.[0]?.payload?.grupo) : undefined;
              if (!g) return null;
              return (
                <CaixaTooltip
                  titulo={`${g.grupo} · n = ${g.n}`}
                  linhas={TRECHOS.map((t) => ({
                    rotulo: ROTULOS_TRECHO[t],
                    cor: COR_TRECHO[t],
                    valor: formatarMinutos(g.media[t]),
                    detalhe: `mediana ${formatarMinutos(g.mediana[t])}`,
                  }))}
                  rodape={`Indisponibilidade média: ${formatarMinutos(g.indisponibilidadeMedia)}`}
                />
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          {TRECHOS.map((t, i) => (
            <Bar
              key={t}
              dataKey={t}
              stackId="tempo"
              fill={`var(--color-${t})`}
              radius={i === TRECHOS.length - 1 ? [0, 4, 4, 0] : 0}
              barSize={26}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </BlocoGrafico>
  );
}
