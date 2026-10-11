import type {
  Chamado,
  Classe,
  Condicao,
  ConfigPriorizacao,
  Criterios,
  Maquina,
  Subdivisao,
} from "./tipos";

const MS_POR_MIN = 60_000;
const LIMIAR_ATENCAO = 0.8;

export type SituacaoMeta = "ok" | "atencao" | "estourado";

/** Campos do chamado de que a priorização precisa. */
export type ChamadoPriorizavel = Pick<
  Chamado,
  "riscoPessoas" | "override" | "prioridade" | "marcos"
>;

export function criterios(
  maquina: Pick<Maquina, "impactoValor">,
  subdivisao: Pick<Subdivisao, "critHist">,
  chamado: { condicao: Condicao; impactoQualidade: boolean },
  nReincidencia: number,
  config: ConfigPriorizacao,
): Criterios {
  return {
    c1: config.condicao[chamado.condicao],
    c2: maquina.impactoValor,
    c3: chamado.impactoQualidade ? 1 : 0,
    c4: subdivisao.critHist,
    c5: Math.min(Math.max(nReincidencia, 0), 2) / 2,
  };
}

export function scoreBase(c: Criterios, pesos: Criterios): number {
  const soma =
    pesos.c1 * c.c1 + pesos.c2 * c.c2 + pesos.c3 * c.c3 + pesos.c4 * c.c4 + pesos.c5 * c.c5;
  return Math.round(1000 * soma) / 10;
}

export function scoreEfetivo(
  base: number,
  esperaMin: number,
  aging: ConfigPriorizacao["aging"],
): number {
  const bonus = Math.min(aging.ptsPorMin * Math.max(esperaMin, 0), aging.maxPts);
  return Math.round(10 * (base + bonus)) / 10;
}

export function classe(
  scoreEf: number,
  riscoPessoas: boolean,
  limiares: ConfigPriorizacao["limiares"],
): Classe {
  if (riscoPessoas) return "P0";
  if (scoreEf >= limiares.P1) return "P1";
  if (scoreEf >= limiares.P2) return "P2";
  return "P3";
}

export function esperaMin(chamado: Pick<Chamado, "marcos">, agora: number): number {
  return Math.max(0, (agora - chamado.marcos.abertura) / MS_POR_MIN);
}

export interface PrioridadeAtual {
  scoreEfetivo: number;
  classeCalculada: Classe;
  /** Classe que vale: override do líder, se houver, senão a calculada. */
  classe: Classe;
}

export function prioridadeAtual(
  chamado: ChamadoPriorizavel,
  agora: number,
  config: ConfigPriorizacao,
): PrioridadeAtual {
  const ef = scoreEfetivo(chamado.prioridade.scoreBase, esperaMin(chamado, agora), config.aging);
  const calculada = classe(ef, chamado.riscoPessoas, config.limiares);
  return {
    scoreEfetivo: ef,
    classeCalculada: calculada,
    classe: chamado.override?.classe ?? calculada,
  };
}

const RANK_CLASSE: Record<Classe, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/**
 * Ordem da fila: P0 primeiro; depois a classe (o override do líder define a
 * classe e, no empate, fica à frente); depois score efetivo decrescente;
 * por fim a abertura mais antiga.
 */
export function ordenarFila<T extends ChamadoPriorizavel>(
  chamados: T[],
  agora: number,
  config: ConfigPriorizacao,
): T[] {
  const chave = chamados.map((c) => ({ c, p: prioridadeAtual(c, agora, config) }));
  return [...chave]
    .sort((a, b) => {
      const risco = Number(b.c.riscoPessoas) - Number(a.c.riscoPessoas);
      const classeA = RANK_CLASSE[a.p.classe];
      const classeB = RANK_CLASSE[b.p.classe];
      if (classeA !== classeB) return classeA - classeB;
      if (classeA === 0 && risco !== 0) return risco;
      const override = Number(Boolean(b.c.override)) - Number(Boolean(a.c.override));
      if (override !== 0) return override;
      if (a.p.scoreEfetivo !== b.p.scoreEfetivo) return b.p.scoreEfetivo - a.p.scoreEfetivo;
      return a.c.marcos.abertura - b.c.marcos.abertura;
    })
    .map(({ c }) => c);
}

/**
 * Compara a espera até o início do atendimento com a meta da classe.
 * Meta 0 significa "imediato": qualquer espera acima de 1 min estoura.
 */
export function estourouMeta(
  chamado: ChamadoPriorizavel,
  agora: number,
  config: ConfigPriorizacao,
): SituacaoMeta {
  const meta = config.metaInicioMin[prioridadeAtual(chamado, agora, config).classe];
  if (meta === null || meta === undefined) return "ok";
  const fim = chamado.marcos.inicio ?? agora;
  const espera = Math.max(0, (fim - chamado.marcos.abertura) / MS_POR_MIN);
  if (meta === 0) return espera > 1 ? "estourado" : "atencao";
  if (espera > meta) return "estourado";
  if (espera >= LIMIAR_ATENCAO * meta) return "atencao";
  return "ok";
}

const ROTULO_CRITERIO: Record<keyof Criterios, string> = {
  c1: "condição",
  c2: "impacto da máquina",
  c3: "qualidade",
  c4: "histórico",
  c5: "reincidência",
};

export interface ParcelaScore {
  criterio: keyof Criterios;
  rotulo: string;
  pontos: number;
}

/** Decompõe o score base em pontos por critério, para mostrar ao usuário. */
export function explicarScore(c: Criterios, pesos: Criterios): ParcelaScore[] {
  return (Object.keys(ROTULO_CRITERIO) as (keyof Criterios)[])
    .map((k) => ({
      criterio: k,
      rotulo: ROTULO_CRITERIO[k],
      pontos: Math.round(1000 * pesos[k] * c[k]) / 10,
    }))
    .filter((p) => p.pontos > 0);
}
