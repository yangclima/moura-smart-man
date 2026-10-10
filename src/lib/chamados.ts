import { AcaoRecusada, type Acao, type DadosAcao } from "./estados";
import { enviarFoto } from "./foto";
import { chamadoDeLinha } from "./mapear";
import { classe, criterios, scoreBase } from "./prioridade";
import { supabase } from "./supabase";
import {
  STATUS_ABERTOS,
  type Chamado,
  type Condicao,
  type ConfigPriorizacao,
  type ErroCatalogo,
  type Maquina,
  type Subdivisao,
  type Usuario,
} from "./tipos";

const MS_POR_DIA = 86_400_000;

/** Chamados da subdivisão abertos nos últimos N dias, exceto cancelados (critério C5). */
export async function contarReincidencia(subdivisaoId: string, dias: number): Promise<number> {
  const desde = new Date(Date.now() - dias * MS_POR_DIA).toISOString();
  const { count, error } = await supabase
    .from("chamados")
    .select("id", { count: "exact", head: true })
    .eq("subdivisao_id", subdivisaoId)
    .neq("status", "cancelado")
    .gte("abertura", desde);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Chamado ainda não encerrado da mesma máquina e subdivisão, se houver. */
export async function buscarDuplicado(maquinaId: string, subdivisaoId: string): Promise<Chamado | null> {
  const { data, error } = await supabase
    .from("chamados")
    .select("*")
    .eq("maquina_id", maquinaId)
    .eq("subdivisao_id", subdivisaoId)
    .in("status", STATUS_ABERTOS)
    .order("abertura")
    .limit(1);
  if (error) throw new Error(error.message);
  return data[0] ? chamadoDeLinha(data[0]) : null;
}

export interface NovoChamado {
  maquina: Maquina;
  subdivisao: Subdivisao;
  erro: ErroCatalogo | null;
  descricaoLivre: string;
  condicao: Condicao;
  riscoPessoas: boolean;
  foto: Blob | null;
  solicitanteNome: string;
  /** Só no cenário de demonstração (engenharia): abertura recuada no tempo. */
  aberturaMs?: number;
  demo?: boolean;
}

/** Calcula a prioridade (T4.4), envia a foto e cria o chamado pela função abrir_chamado. */
export async function abrirChamado(novo: NovoChamado, config: ConfigPriorizacao): Promise<string> {
  const impactoQualidade = novo.erro?.impactoQualidade ?? false;
  const n = await contarReincidencia(novo.subdivisao.id, config.reincidenciaDias);
  const c = criterios(novo.maquina, novo.subdivisao, { condicao: novo.condicao, impactoQualidade }, n, config);
  const base = scoreBase(c, config.pesos);
  const fotoPath = novo.foto ? await enviarFoto(novo.foto) : null;

  const { data, error } = await supabase.rpc("abrir_chamado", {
    p: {
      maquina_id: novo.maquina.id,
      subdivisao_id: novo.subdivisao.id,
      erro_id: novo.erro?.id ?? null,
      descricao_livre: novo.descricaoLivre.trim(),
      condicao: novo.condicao,
      risco_pessoas: novo.riscoPessoas,
      foto_path: fotoPath,
      solicitante_nome: novo.solicitanteNome,
      reincidencia: n,
      prioridade: {
        scoreBase: base,
        classeBase: classe(base, novo.riscoPessoas, config.limiares),
        criterios: c,
        versaoConfig: config.versao,
      },
      ...(novo.demo ? { demo: true } : {}),
      ...(novo.aberturaMs ? { abertura: new Date(novo.aberturaMs).toISOString() } : {}),
    },
  });
  if (error) throw new AcaoRecusada(error.message);
  return data as string;
}

/**
 * Única porta para mudar um chamado. A validação definitiva (estado, papel,
 * responsável) e a gravação do marco e do evento acontecem na função
 * executar_acao do banco, numa transação com o chamado travado.
 */
export async function executarAcao(
  chamadoId: string,
  acao: Acao,
  usuario: Usuario,
  dados: DadosAcao = {},
): Promise<void> {
  const { error } = await supabase.rpc("executar_acao", {
    p_id: chamadoId,
    p_acao: acao,
    p_dados: { ...dados, nome_usuario: usuario.nome },
  });
  if (error) throw new AcaoRecusada(error.message);
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String(e.message);
  return "Erro inesperado";
}
