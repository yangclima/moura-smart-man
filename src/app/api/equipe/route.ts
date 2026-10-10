import {
  clienteAdmin,
  criarPessoa,
  definirAtivo,
  definirNovoPin,
  ErroLogin,
  exigirGestor,
  listarEquipe,
} from "@/lib/servidor/credenciais";
import type { Papel } from "@/lib/tipos";

async function responder(acao: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await acao());
  } catch (e) {
    if (e instanceof ErroLogin) return Response.json({ erro: e.message }, { status: e.status });
    console.error("[api/equipe]", e);
    return Response.json({ erro: e instanceof Error ? e.message : "Erro no servidor" }, { status: 500 });
  }
}

/** Lista as pessoas cadastradas (engenharia e líderes). */
export async function GET(request: Request) {
  return responder(async () => {
    const admin = clienteAdmin();
    await exigirGestor(admin, request.headers.get("authorization"));
    return { pessoas: await listarEquipe(admin) };
  });
}

/** POST { nome, papel } → { pessoa, pin } (o PIN só aparece nesta resposta). */
export async function POST(request: Request) {
  return responder(async () => {
    const admin = clienteAdmin();
    await exigirGestor(admin, request.headers.get("authorization"));
    const { nome, papel } = (await request.json()) as { nome?: string; papel?: Papel };
    return criarPessoa(admin, nome ?? "", papel as Papel);
  });
}

/** PATCH { id, acao: "novo_pin" | "desativar" | "ativar" } */
export async function PATCH(request: Request) {
  return responder(async () => {
    const admin = clienteAdmin();
    const eu = await exigirGestor(admin, request.headers.get("authorization"));
    const { id, acao } = (await request.json()) as { id?: string; acao?: string };
    if (!id) throw new ErroLogin("Informe a pessoa", 400);
    if (acao === "novo_pin") return { pin: await definirNovoPin(admin, id) };
    if (acao === "desativar" || acao === "ativar") {
      if (id === eu && acao === "desativar") throw new ErroLogin("Você não pode desativar o próprio acesso", 400);
      await definirAtivo(admin, id, acao === "ativar");
      return { ok: true };
    }
    throw new ErroLogin("Ação inválida", 400);
  });
}
