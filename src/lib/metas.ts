/** Metas de início do atendimento (T2−T0) por classe: validação e gravação na config. */
import { supabase } from "./supabase";
import type { Classe, ConfigPriorizacao } from "./tipos";

export const CLASSES_META: Classe[] = ["P0", "P1", "P2", "P3", "P4"];
/** Teto de um dia: acima disso a meta deixa de ser útil para a fila. */
export const META_MAXIMA_MIN = 1440;

export type MetasInicio = ConfigPriorizacao["metaInicioMin"];
/** Valores como digitados no formulário; vazio = sem meta. */
export type MetasTexto = Record<Classe, string>;

export function metasParaTexto(metas: MetasInicio): MetasTexto {
  return Object.fromEntries(CLASSES_META.map((c) => [c, metas[c] === null ? "" : String(metas[c])])) as MetasTexto;
}

export type ResultadoMetas = { ok: true; metas: MetasInicio } | { ok: false; erros: Partial<Record<Classe, string>> };

/** Inteiros de 0 a 1440 minutos; campo vazio vira "sem meta" (null). */
export function validarMetas(texto: MetasTexto): ResultadoMetas {
  const erros: Partial<Record<Classe, string>> = {};
  const metas = {} as MetasInicio;
  for (const c of CLASSES_META) {
    const v = texto[c].trim();
    if (v === "") {
      metas[c] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > META_MAXIMA_MIN) {
      erros[c] = `Use um número inteiro de 0 a ${META_MAXIMA_MIN}`;
      continue;
    }
    metas[c] = n;
  }
  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, metas };
}

/** Grava as metas na config "priorizacao". Só a engenharia tem permissão (RLS). */
export async function salvarMetasInicio(config: ConfigPriorizacao, metas: MetasInicio): Promise<void> {
  const { error } = await supabase
    .from("config")
    .upsert({ id: "priorizacao", dados: { ...config, metaInicioMin: metas } });
  if (error) throw new Error(`Não foi possível salvar as metas: ${error.message}`);
}
