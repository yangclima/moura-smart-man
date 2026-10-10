/** Busca e filtros da página de etiquetas QR, pensada para centenas de máquinas. */
import { casaBusca, normalizar } from "./busca";
import type { Maquina } from "./tipos";

export interface FiltroMaquinas {
  busca: string;
  /** null = todas as linhas. */
  linha: string | null;
  soSelecionadas: boolean;
}

export const FILTRO_MAQUINAS_PADRAO: FiltroMaquinas = { busca: "", linha: null, soSelecionadas: false };

/** Só máquinas ativas, ordenadas por nome; a busca olha nome, TAG, código e linha. */
export function filtrarMaquinas(maquinas: Maquina[], f: FiltroMaquinas, selecionadas: ReadonlySet<string>): Maquina[] {
  return maquinas
    .filter(
      (m) =>
        m.ativo &&
        (f.linha === null || m.linha === f.linha) &&
        (!f.soSelecionadas || selecionadas.has(m.id)) &&
        casaBusca(f.busca, [m.nome, m.tag, m.id, m.linha]),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
}

export function linhasDasMaquinas(maquinas: Maquina[]): string[] {
  return [...new Set(maquinas.filter((m) => m.ativo && m.linha).map((m) => m.linha))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );
}

/** Busca exata por TAG ou código: um leitor de código de barras ou a TAG digitada abre a máquina direto. */
export function maquinaExata(maquinas: Maquina[], termo: string): Maquina | undefined {
  const t = normalizar(termo);
  if (!t) return undefined;
  return maquinas.find((m) => m.ativo && (normalizar(m.tag) === t || normalizar(m.id) === t));
}
