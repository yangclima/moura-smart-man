/** Instante em milissegundos desde a época (Date.getTime()). */
export type Instante = number;

export type Papel = "engenharia" | "lider" | "mantenedor" | "operador" | "oficina";
export type Condicao = "parada" | "restricao";
export type Status =
  | "aberto"
  | "recebido"
  | "em_atendimento"
  | "pausado"
  | "aguardando_liberacao"
  | "encerrado"
  | "cancelado";
export type Classe = "P0" | "P1" | "P2" | "P3" | "P4";
export type Impacto = "gargalo" | "sem_redundancia" | "com_redundancia";

export const STATUS_ABERTOS: Status[] = [
  "aberto",
  "recebido",
  "em_atendimento",
  "pausado",
  "aguardando_liberacao",
];

export const IMPACTO_VALOR: Record<Impacto, number> = {
  gargalo: 1.0,
  sem_redundancia: 0.7,
  com_redundancia: 0.4,
};

export const IMPACTO_ROTULO: Record<Impacto, string> = {
  gargalo: "Gargalo",
  sem_redundancia: "Sem redundância",
  com_redundancia: "Com redundância",
};

export const STATUS_ROTULO: Record<Status, string> = {
  aberto: "Aberto",
  recebido: "Recebido",
  em_atendimento: "Em atendimento",
  pausado: "Pausado",
  aguardando_liberacao: "Aguardando liberação",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export interface Usuario {
  uid: string;
  nome: string;
  papel: Papel | null;
}

export interface Pessoa {
  uid: string;
  nome: string;
}

export interface Maquina {
  id: string;
  nome: string;
  tag: string;
  linha: string;
  impacto: Impacto;
  impactoValor: number;
  ativo: boolean;
}

export interface Subdivisao {
  id: string;
  maquinaId: string;
  nome: string;
  ordem: number;
  critHist: number;
  componentes?: string[];
}

export interface ErroCatalogo {
  id: string;
  maquinaId: string;
  subdivisaoId: string;
  nome: string;
  riscoPessoas: boolean;
  impactoQualidade: boolean;
  ordem: number;
  ativo: boolean;
  origem: "seed" | "engenharia" | "revisao";
}

export interface Criterios {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
}

export interface Prioridade {
  scoreBase: number;
  classeBase: Classe;
  criterios: Criterios;
  versaoConfig: number;
}

export interface Override {
  classe: Classe;
  justificativa: string;
  por: string;
  em: Instante;
}

export interface Marcos {
  abertura: Instante;
  recebido?: Instante;
  inicio?: Instante;
  fimAtuacao?: Instante;
  liberado?: Instante;
}

export interface Pausa {
  inicio: Instante;
  fim?: Instante;
  motivo: string;
}

export interface Conclusao {
  componente: string;
  modoFalha: string;
  acao: string;
  pecas: string;
  obs: string;
}

export interface Chamado {
  id: string;
  numero: string;
  maquinaId: string;
  maquinaNome: string;
  tag: string;
  subdivisaoId: string;
  subdivisaoNome: string;
  erroId: string | null;
  erroNome: string;
  erroIdRevisado?: string | null;
  descricaoLivre: string;
  condicao: Condicao;
  riscoPessoas: boolean;
  impactoQualidade: boolean;
  /** Caminho no bucket "fotos" do Supabase Storage. */
  fotoPath: string | null;
  solicitante: Pessoa;
  responsavel: Pessoa | null;
  status: Status;
  prioridade: Prioridade;
  override: Override | null;
  marcos: Marcos;
  pausas: Pausa[];
  conclusao?: Conclusao;
  cancelamento?: { motivo: string; por: string };
  demo?: boolean;
}

export interface ConfigPriorizacao {
  versao: number;
  pesos: Criterios;
  condicao: Record<Condicao, number>;
  aging: { ptsPorMin: number; maxPts: number };
  limiares: { P1: number; P2: number; P3: number };
  metaInicioMin: Record<Classe, number | null>;
  reincidenciaDias: number;
}

export const CONFIG_PADRAO: ConfigPriorizacao = {
  versao: 1,
  pesos: { c1: 0.42, c2: 0.26, c3: 0.16, c4: 0.1, c5: 0.06 },
  condicao: { parada: 1.0, restricao: 0.5 },
  aging: { ptsPorMin: 0.5, maxPts: 30 },
  limiares: { P1: 70, P2: 50, P3: 30 },
  metaInicioMin: { P0: 10, P1: 15, P2: 30, P3: 120, P4: null },
  reincidenciaDias: 7,
};
