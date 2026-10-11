import type { Chamado, Classe, Marcos, Papel, Status, Usuario } from "./tipos";

export type Acao =
  | "receber"
  | "devolver"
  | "iniciar"
  | "pausar"
  | "retomar"
  | "concluir"
  | "liberar"
  | "reabrir"
  | "cancelar"
  | "atribuir"
  | "priorizar";

interface Transicao {
  de: Status[];
  /** Ausente quando a ação não muda o status (ex.: override de prioridade). */
  para?: Status;
  marco?: keyof Marcos;
  papeis: Papel[];
  /**
   * Qualquer pessoa da produção pode executar: operador anônimo (sem perfil) ou com papel "operador",
   * em qualquer aparelho, mesmo sem ter aberto o chamado.
   */
  producao?: boolean;
}

const EQUIPE: Papel[] = ["mantenedor", "lider"];

export const TRANSICOES: Record<Acao, Transicao> = {
  receber: { de: ["aberto"], para: "recebido", marco: "recebido", papeis: EQUIPE },
  devolver: { de: ["recebido"], para: "aberto", papeis: EQUIPE },
  iniciar: { de: ["recebido"], para: "em_atendimento", marco: "inicio", papeis: EQUIPE },
  pausar: { de: ["em_atendimento"], para: "pausado", papeis: EQUIPE },
  retomar: { de: ["pausado"], para: "em_atendimento", papeis: EQUIPE },
  concluir: {
    de: ["em_atendimento"],
    para: "aguardando_liberacao",
    marco: "fimAtuacao",
    papeis: EQUIPE,
  },
  liberar: {
    de: ["aguardando_liberacao"],
    para: "encerrado",
    marco: "liberado",
    papeis: ["lider", "operador"],
    producao: true,
  },
  reabrir: {
    de: ["aguardando_liberacao"],
    para: "em_atendimento",
    papeis: ["lider", "operador"],
    producao: true,
  },
  cancelar: { de: ["aberto", "recebido"], para: "cancelado", papeis: ["lider"] },
  atribuir: { de: ["aberto", "recebido"], para: "recebido", marco: "recebido", papeis: ["lider"] },
  priorizar: {
    de: ["aberto", "recebido", "em_atendimento", "pausado"],
    papeis: ["lider"],
  },
};

export const MIN_JUSTIFICATIVA = 15;
export const CLASSES: Classe[] = ["P0", "P1", "P2", "P3"];

export interface DadosAcao {
  motivo?: string;
  classe?: Classe;
  justificativa?: string;
  mantenedor?: { uid: string; nome: string };
  conclusao?: Chamado["conclusao"];
}

export class AcaoRecusada extends Error {}

type ChamadoValidavel = Pick<Chamado, "status" | "responsavel">;

function mensagemStatus(acao: Acao, chamado: ChamadoValidavel): string {
  const quem = chamado.responsavel?.nome;
  if (acao === "receber" && quem) return `Chamado já recebido por ${quem}`;
  return `Ação "${acao}" não é válida com o chamado ${chamado.status.replace("_", " ")}`;
}

/** Lança AcaoRecusada se a ação não puder ser executada. Pura: não acessa o banco. */
export function validarAcao(
  chamado: ChamadoValidavel,
  acao: Acao,
  usuario: Usuario,
  dados: DadosAcao = {},
): Transicao {
  const t = TRANSICOES[acao];
  if (!t.de.includes(chamado.status)) throw new AcaoRecusada(mensagemStatus(acao, chamado));

  const temPapel = usuario.papel !== null && t.papeis.includes(usuario.papel);
  const operadorAnonimo = Boolean(t.producao) && usuario.papel === null;
  if (!temPapel && !operadorAnonimo) throw new AcaoRecusada("Seu perfil não pode executar esta ação");

  const ehResponsavel = chamado.responsavel?.uid === usuario.uid;
  const exigeResponsavel = ["iniciar", "devolver", "pausar", "retomar", "concluir"].includes(acao);
  if (exigeResponsavel && !ehResponsavel && usuario.papel !== "lider") {
    throw new AcaoRecusada(`Chamado está com ${chamado.responsavel?.nome ?? "outra pessoa"}`);
  }

  if ((acao === "pausar" || acao === "cancelar") && !dados.motivo?.trim()) {
    throw new AcaoRecusada("Informe o motivo");
  }
  if (acao === "atribuir" && !dados.mantenedor) throw new AcaoRecusada("Escolha o mantenedor");
  if (acao === "priorizar") {
    if (!dados.classe || !CLASSES.includes(dados.classe)) throw new AcaoRecusada("Escolha a classe");
    if ((dados.justificativa?.trim().length ?? 0) < MIN_JUSTIFICATIVA) {
      throw new AcaoRecusada(`Justificativa precisa de pelo menos ${MIN_JUSTIFICATIVA} caracteres`);
    }
  }
  if (acao === "concluir") {
    const c = dados.conclusao;
    if (!c?.componente || !c.modoFalha || !c.acao) {
      throw new AcaoRecusada("Preencha componente, modo de falha e ação realizada");
    }
  }
  return t;
}

/** Ações que o usuário pode executar agora (para montar os botões). */
export function acoesDisponiveis(chamado: ChamadoValidavel, usuario: Usuario): Acao[] {
  return (Object.keys(TRANSICOES) as Acao[]).filter((acao) => {
    try {
      validarAcao(chamado, acao, usuario, {
        motivo: "x",
        classe: "P1",
        justificativa: "x".repeat(MIN_JUSTIFICATIVA),
        mantenedor: { uid: "x", nome: "x" },
        conclusao: { componente: "x", modoFalha: "x", acao: "x", pecas: "", obs: "" },
      });
      return true;
    } catch {
      return false;
    }
  });
}
