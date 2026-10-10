/**
 * Calendário no fuso da fábrica (America/Recife). Recife está em UTC−3 fixo, sem horário de verão,
 * então o deslocamento é constante e as contas não dependem do fuso do navegador.
 */
import type { Instante } from "./tipos";

const DESLOCAMENTO_MS = 3 * 3_600_000;
const MS_POR_DIA = 86_400_000;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Data no calendário de Recife, com o mês começando em 0 (como em Date). */
export interface DataRecife {
  ano: number;
  mes: number;
  dia: number;
  /** 0 = domingo. */
  diaSemana: number;
}

export function dataRecife(t: Instante): DataRecife {
  const d = new Date(t - DESLOCAMENTO_MS);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth(), dia: d.getUTCDate(), diaSemana: d.getUTCDay() };
}

/** Meia-noite em Recife do dia informado (mes começando em 0; dia pode transbordar, como em Date.UTC). */
export function meiaNoiteRecife(ano: number, mes: number, dia: number): Instante {
  return Date.UTC(ano, mes, dia) + DESLOCAMENTO_MS;
}

const dois = (n: number) => String(n).padStart(2, "0");

/** "AAAA-MM-DD" do dia em Recife. */
export function chaveDia(t: Instante): string {
  const d = dataRecife(t);
  return `${d.ano}-${dois(d.mes + 1)}-${dois(d.dia)}`;
}

/** "dd/mm" do dia em Recife. */
export function rotuloDia(t: Instante): string {
  const d = dataRecife(t);
  return `${dois(d.dia)}/${dois(d.mes + 1)}`;
}

/** "mar/26" do mês em Recife. */
export function rotuloMesCurto(t: Instante): string {
  const d = dataRecife(t);
  return `${MESES[d.mes]}/${String(d.ano).slice(2)}`;
}

/** Dias de calendário (meia-noite em Recife) de `de` até `ate`, inclusive. */
export function diasEntre(de: Instante, ate: Instante): Instante[] {
  const a = dataRecife(de);
  const inicio = meiaNoiteRecife(a.ano, a.mes, a.dia);
  const dias: Instante[] = [];
  for (let t = inicio; t <= ate; t += MS_POR_DIA) dias.push(t);
  return dias;
}

export { MS_POR_DIA };
