/**
 * Todas as cores dos gráficos. Apontam para os tokens de globals.css (que mudam no tema escuro);
 * o hex é a reserva do tema claro. Sem reserva, um token ausente vira preto no SVG.
 */
import type { ChartConfig } from "@/components/ui/chart";
import type { ClasseConciliacao } from "@/lib/historico";
import type { Trecho } from "@/lib/indicadores";

const token = (nome: string, reserva: string) => `var(--${nome}, ${reserva})`;

/** Cores de apoio: linhas de referência, mediana, fundo dos pontos vazados. */
export const COR = {
  azul: token("moura-azul", "#0f2185"),
  azulClaro: token("moura-azul-claro", "#3571b8"),
  referencia: token("muted-foreground", "#5b6178"),
  destaque: token("foreground", "#0a1658"),
  fundo: token("card", "#ffffff"),
} as const;

/** Chave segura para CSS (`--color-<chave>`) de cada classe da conciliação. */
export const CHAVE_CLASSE: Record<ClasseConciliacao, "conciliado" | "producao" | "manutencao"> = {
  "MES + SAP": "conciliado",
  "MES sem SAP": "producao",
  "SAP sem MES": "manutencao",
};

/** As mesmas do notebook. */
export const COR_CLASSE_GRAFICO: Record<ClasseConciliacao, string> = {
  "MES + SAP": token("hist-conciliado", "#2a78d6"),
  "MES sem SAP": token("hist-producao", "#fdb814"),
  "SAP sem MES": token("hist-manutencao", "#0f2185"),
};

const COR_MAQUINA: Record<string, string> = {
  A: token("maq-a", "#0072b2"),
  B: token("maq-b", "#e69f00"),
  C: token("maq-c", "#009e73"),
  D: token("maq-d", "#cc79a7"),
};

/** Cor fixa da máquina em todos os gráficos ("A" ou "Máquina A"). */
export function corMaquina(maquina: string): string {
  const letra = maquina.replace(/^Máquina\s+/i, "").trim().toUpperCase();
  return COR_MAQUINA[letra] ?? token("chart-5", "#7c8296");
}

export const COR_TRECHO: Record<Trecho, string> = {
  reacao: token("trecho-reacao", "#fdb814"),
  deslocamento: token("trecho-deslocamento", "#3571b8"),
  reparo: token("trecho-reparo", "#0f2185"),
  pausas: token("trecho-pausas", "#a3a9b8"),
  liberacao: token("trecho-liberacao", "#2f9e6b"),
};

export function configMaquinas(maquinas: string[]): ChartConfig {
  return Object.fromEntries(maquinas.map((m) => [m, { label: `Máquina ${m}`, color: corMaquina(m) }]));
}
