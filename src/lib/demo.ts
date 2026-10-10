import { abrirChamado } from "./chamados";
import { supabase } from "./supabase";
import type { Condicao, ConfigPriorizacao, ErroCatalogo, Maquina, Subdivisao, Usuario } from "./tipos";

const MIN = 60_000;
const DIA = 86_400_000;

interface Catalogo {
  maquinas: Maquina[];
  subdivisoes: Subdivisao[];
  erros: ErroCatalogo[];
}

interface Roteiro {
  maquina: string;
  subdivisao: string;
  erro: string;
  condicao: Condicao;
  minutosAtras: number;
  solicitante: string;
}

/** Cenário do plano (T13.1): três chamados disputando o mesmo recurso. */
const ROTEIRO: Roteiro[] = [
  { maquina: "D", subdivisao: "D-TRANSPORTADOR", erro: "Parou sem causa aparente", condicao: "parada", minutosAtras: 5, solicitante: "Carlos (demo)" },
  { maquina: "A", subdivisao: "A-AQUECIMENTO", erro: "Soprador sem funcionar", condicao: "restricao", minutosAtras: 2, solicitante: "Maria (demo)" },
  { maquina: "B", subdivisao: "B-SENSORAMENTO", erro: "Ruído ou vibração anormal", condicao: "restricao", minutosAtras: 25, solicitante: "Rita (demo)" },
];

function encontrar(cat: Catalogo, r: Roteiro) {
  const maquina = cat.maquinas.find((m) => m.id === r.maquina);
  const subdivisao = cat.subdivisoes.find((s) => s.id === r.subdivisao);
  const erro =
    cat.erros.find((e) => e.subdivisaoId === r.subdivisao && e.nome === r.erro) ??
    cat.erros.find((e) => e.subdivisaoId === r.subdivisao && e.ativo) ??
    null;
  if (!maquina || !subdivisao) {
    throw new Error(`Cenário precisa da máquina ${r.maquina} e da subdivisão ${r.subdivisao} (rode o seed)`);
  }
  return { maquina, subdivisao, erro };
}

/** Chamado já encerrado há 3 dias na Máquina A: gera a reincidência (C5). */
async function criarHistoricoReincidencia(cat: Catalogo, usuario: Usuario): Promise<void> {
  const { maquina, subdivisao, erro } = encontrar(cat, ROTEIRO[1]);
  const t0 = Date.now() - 3 * DIA;
  const ts = (min: number) => new Date(t0 + min * MIN).toISOString();
  const { error } = await supabase.from("chamados").insert({
    numero: `HIST-${crypto.randomUUID().slice(0, 8)}`,
    maquina_id: maquina.id,
    maquina_nome: maquina.nome,
    tag: maquina.tag,
    subdivisao_id: subdivisao.id,
    subdivisao_nome: subdivisao.nome,
    erro_id: erro?.id ?? null,
    erro_nome: erro?.nome ?? "Outro / não identificado",
    condicao: "parada",
    impacto_qualidade: erro?.impactoQualidade ?? false,
    solicitante_id: usuario.uid,
    solicitante_nome: "Maria (demo)",
    responsavel_nome: "João (demo)",
    status: "encerrado",
    prioridade: { scoreBase: 0, classeBase: "P4", criterios: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 }, versaoConfig: 0 },
    abertura: ts(0),
    recebido: ts(4),
    inicio: ts(11),
    fim_atuacao: ts(52),
    liberado: ts(60),
    pausas: [{ inicio: ts(20), fim: ts(32), motivo: "Aguardando peça" }],
    conclusao: { componente: subdivisao.componentes?.[0] ?? "", modoFalha: "Desgaste", acao: "Substituído", pecas: "", obs: "Histórico de demonstração" },
    demo: true,
  });
  if (error) throw new Error(error.message);
}

export async function criarCenarioDemo(cat: Catalogo, usuario: Usuario, config: ConfigPriorizacao): Promise<void> {
  ROTEIRO.forEach((r) => encontrar(cat, r));
  await criarHistoricoReincidencia(cat, usuario);
  const agora = Date.now();
  for (const r of ROTEIRO) {
    const { maquina, subdivisao, erro } = encontrar(cat, r);
    await abrirChamado(
      {
        maquina,
        subdivisao,
        erro,
        descricaoLivre: "",
        condicao: r.condicao,
        riscoPessoas: false,
        foto: null,
        solicitanteNome: r.solicitante,
        aberturaMs: agora - r.minutosAtras * MIN,
        demo: true,
      },
      config,
    );
  }
}

/** Remove os chamados marcados como demonstração (os eventos vão junto, em cascata). */
export async function limparDemo(): Promise<number> {
  const { data, error } = await supabase.rpc("limpar_demo");
  if (error) throw new Error(error.message);
  return data as number;
}
