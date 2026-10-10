/**
 * Integração contra o Supabase local (RLS e funções reais).
 *   npm run supabase:local          (Docker)
 *   SUPABASE_TESTE=1 npx vitest run fluxo
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const RODAR = process.env.SUPABASE_TESTE === "1";
const URL_LOCAL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:55321";
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// O teste usa o Supabase local; segredos locais padrão quando não vierem do ambiente.
process.env.NEXT_PUBLIC_SUPABASE_URL = URL_LOCAL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = CHAVE;
process.env.SUPABASE_SECRET_KEY ||= "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";
process.env.PIN_SEGREDO ||= "segredo-local-de-teste";

type Conta = "engenharia" | "lider" | "mantenedor" | "mantenedor2" | "oficina";
const PINS = {} as Record<Conta, string>;

function cliente(): SupabaseClient {
  return createClient(URL_LOCAL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Entra exatamente como o app: PIN → sessão (rota /api/entrar) → setSession. */
async function entrar(conta: Conta) {
  const { entrarComPin } = await import("./servidor/credenciais");
  const sessao = await entrarComPin(PINS[conta], `teste-${conta}`);
  const c = cliente();
  const { data, error } = await c.auth.setSession(sessao);
  if (error) throw error;
  return { c, uid: data.user!.id };
}

async function anonimo() {
  const c = cliente();
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return { c, uid: data.user!.id };
}

const PRIORIDADE = { scoreBase: 70, classeBase: "P1", criterios: { c1: 1, c2: 1, c3: 0, c4: 0.4, c5: 0 }, versaoConfig: 1 };

async function abrir(c: SupabaseClient, extra: Record<string, unknown> = {}) {
  const { data, error } = await c.rpc("abrir_chamado", {
    p: { maquina_id: "A", subdivisao_id: "A-ROLOS", erro_id: "A-ROLOS-rolo-patinando", condicao: "parada", solicitante_nome: "Maria", prioridade: PRIORIDADE, ...extra },
  });
  if (error) throw error;
  return data as string;
}

const acao = (c: SupabaseClient, id: string, a: string, dados: object = {}) =>
  c.rpc("executar_acao", { p_id: id, p_acao: a, p_dados: dados });

describe.skipIf(!RODAR)("fluxo do chamado no Supabase local", () => {
  beforeAll(async () => {
    const { clienteAdmin, criarPessoa } = await import("./servidor/credenciais");
    const admin = clienteAdmin();
    const papeis: Record<Conta, ["engenharia" | "lider" | "mantenedor" | "oficina", string]> = {
      engenharia: ["engenharia", "Engenharia"],
      lider: ["lider", "Ana (líder)"],
      mantenedor: ["mantenedor", "João"],
      mantenedor2: ["mantenedor", "Pedro"],
      oficina: ["oficina", "TV da oficina"],
    };
    for (const [conta, [papel, nome]] of Object.entries(papeis) as [Conta, [typeof papeis.lider[0], string]][]) {
      PINS[conta] = (await criarPessoa(admin, nome, papel)).pin;
    }
  });

  it("login por PIN: errado, bloqueio por tentativas e pessoa desativada", { timeout: 60_000 }, async () => {
    const cred = await import("./servidor/credenciais");
    await expect(cred.entrarComPin("12", "ip-a")).rejects.toMatchObject({ status: 400 });
    const errado = PINS.lider === "000000" ? "000001" : "000000";
    await expect(cred.entrarComPin(errado, "ip-b")).rejects.toMatchObject({ status: 401, message: "PIN inválido" });

    // 20 erros no mesmo IP em 10 min bloqueiam até o PIN certo (contra adivinhação).
    const ip = `ip-bloqueio-${Date.now()}`;
    const admin = cred.clienteAdmin();
    await admin.from("tentativas_login").insert(Array.from({ length: 20 }, () => ({ ip })));
    await expect(cred.entrarComPin(PINS.lider, ip)).rejects.toMatchObject({ status: 429 });

    // Desativar bloqueia novo login; reativar devolve o acesso.
    const temp = await cred.criarPessoa(admin, "Temporário", "mantenedor");
    await cred.entrarComPin(temp.pin, "ip-c");
    await cred.definirAtivo(admin, temp.pessoa.id, false);
    await expect(cred.entrarComPin(temp.pin, "ip-c")).rejects.toMatchObject({ status: 403 });
    await cred.definirAtivo(admin, temp.pessoa.id, true);
    await expect(cred.entrarComPin(temp.pin, "ip-c")).resolves.toHaveProperty("access_token");

    // Novo PIN invalida o anterior.
    const novo = await cred.definirNovoPin(admin, temp.pessoa.id);
    if (novo !== temp.pin) await expect(cred.entrarComPin(temp.pin, "ip-d")).rejects.toMatchObject({ status: 401 });
    await expect(cred.entrarComPin(novo, "ip-d")).resolves.toHaveProperty("refresh_token");

    // A tabela de PINs não é legível pelo cliente.
    const { c } = await entrar("lider");
    const { data } = await c.from("pins").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("operador abre, mantenedor atende e o solicitante libera", { timeout: 60_000 }, async () => {
    const op = await anonimo();
    const id = await abrir(op.c);
    const { data: linha } = await op.c.from("chamados").select("*").eq("id", id).single();
    expect(linha.numero).toMatch(/^CH-\d{6}$/);
    expect(linha.status).toBe("aberto");
    expect(linha.maquina_nome).toBe("Máquina A"); // copiado do cadastro pelo banco
    expect(linha.impacto_qualidade).toBe(true); // rolo patinando afeta qualidade

    // Operador anônimo não edita cadastro, não altera chamado direto e não recebe.
    await op.c.from("maquinas").update({ nome: "X" }).eq("id", "A");
    const { data: maq } = await op.c.from("maquinas").select("nome").eq("id", "A").single();
    expect(maq!.nome).toBe("Máquina A");
    await op.c.from("chamados").update({ status: "encerrado" }).eq("id", id);
    expect((await op.c.from("chamados").select("status").eq("id", id).single()).data!.status).toBe("aberto");
    expect((await acao(op.c, id, "receber")).error?.message).toBe("Seu perfil não pode executar esta ação");

    // Dois mantenedores disputam: só o primeiro recebe.
    const joao = await entrar("mantenedor");
    const pedro = await entrar("mantenedor2");
    const [r1, r2] = await Promise.all([acao(joao.c, id, "receber"), acao(pedro.c, id, "receber")]);
    const erros = [r1.error?.message, r2.error?.message].filter(Boolean);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/^Chamado já recebido por (João|Pedro)$/);
    const dono = r1.error ? pedro : joao;
    const outro = r1.error ? joao : pedro;

    expect((await acao(outro.c, id, "iniciar")).error?.message).toMatch(/^Chamado está com/);
    expect((await acao(dono.c, id, "iniciar")).error).toBeNull();
    expect((await acao(dono.c, id, "pausar")).error?.message).toBe("Informe o motivo");
    expect((await acao(dono.c, id, "pausar", { motivo: "Aguardando peça" })).error).toBeNull();
    expect((await acao(dono.c, id, "retomar")).error).toBeNull();
    expect((await acao(dono.c, id, "concluir", {})).error?.message).toMatch(/^Preencha componente/);
    expect(
      (await acao(dono.c, id, "concluir", { conclusao: { componente: "RMPF", modoFalha: "Desgaste", acao: "Substituído", pecas: "", obs: "" } })).error,
    ).toBeNull();

    // Outro aparelho anônimo não libera; o solicitante sim.
    const intruso = await anonimo();
    expect((await acao(intruso.c, id, "liberar")).error?.message).toBe("Seu perfil não pode executar esta ação");
    expect((await acao(op.c, id, "reabrir")).error).toBeNull();
    await acao(dono.c, id, "concluir", { conclusao: { componente: "RMPF", modoFalha: "Desgaste", acao: "Substituído", pecas: "", obs: "" } });
    expect((await acao(op.c, id, "liberar")).error).toBeNull();

    const { mapear } = { mapear: await import("./mapear") };
    const final = mapear.chamadoDeLinha((await op.c.from("chamados").select("*").eq("id", id).single()).data!);
    expect(final.status).toBe("encerrado");
    expect(final.pausas).toHaveLength(1);
    expect(final.pausas[0].fim).toBeGreaterThan(final.pausas[0].inicio);
    expect(final.marcos.liberado).toBeGreaterThanOrEqual(final.marcos.fimAtuacao!);

    const { data: eventos } = await op.c.from("eventos").select("acao").eq("chamado_id", id).order("id");
    expect(eventos!.map((e) => e.acao)).toEqual([
      "abrir", "receber", "iniciar", "pausar", "retomar", "concluir", "reabrir", "concluir", "liberar",
    ]);
    // Log imutável e chamado não apagável pelo cliente.
    await dono.c.from("eventos").delete().eq("chamado_id", id);
    await dono.c.from("chamados").delete().eq("id", id);
    expect((await op.c.from("eventos").select("id").eq("chamado_id", id)).data).toHaveLength(9);
  });

  it("líder: override com justificativa, atribuição e cancelamento", { timeout: 60_000 }, async () => {
    const op = await anonimo();
    const id = await abrir(op.c, { erro_id: null, descricao_livre: "barulho estranho" });
    const lider = await entrar("lider");
    const joao = await entrar("mantenedor");
    expect((await acao(joao.c, id, "priorizar", { classe: "P0", justificativa: "linha parada no cliente" })).error).not.toBeNull();
    expect((await acao(lider.c, id, "priorizar", { classe: "P0", justificativa: "curta" })).error?.message).toMatch(/15 caracteres/);
    expect((await acao(lider.c, id, "priorizar", { classe: "P0", justificativa: "linha parada no cliente" })).error).toBeNull();
    expect((await acao(lider.c, id, "atribuir", { mantenedor: { uid: joao.uid, nome: "João" } })).error).toBeNull();
    expect((await acao(lider.c, id, "cancelar", { motivo: "aberto por engano" })).error).toBeNull();
    const { data } = await op.c.from("chamados").select("status, override, responsavel_nome, erro_nome").eq("id", id).single();
    expect(data).toMatchObject({ status: "cancelado", responsavel_nome: "João", erro_nome: "Outro / não identificado" });
    expect(data!.override.classe).toBe("P0");
  });

  it("realtime: chamado novo chega na TV em até 2 s", { timeout: 30_000 }, async () => {
    const tv = await entrar("oficina");
    const chegou = new Promise<number>((ok) => {
      tv.c
        .channel("tv-teste")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chamados" }, () => ok(Date.now()))
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          const op = await anonimo();
          inicio = Date.now();
          await abrir(op.c);
        });
    });
    let inicio = 0;
    const quando = await chegou;
    expect(quando - inicio).toBeLessThan(2000);
    await tv.c.removeAllChannels();
  });

  it("código do app: cenário demo pelo cliente, A passa à frente de D, duplicidade", { timeout: 60_000 }, async () => {
    const { supabase } = await import("./supabase");
    const catalogo = await import("./catalogo");
    const chamados = await import("./chamados");
    const demo = await import("./demo");
    const { ordenarFila } = await import("./prioridade");
    const { CONFIG_PADRAO } = await import("./tipos");

    const { entrarComPin } = await import("./servidor/credenciais");
    const { data, error } = await supabase.auth.setSession(await entrarComPin(PINS.engenharia, "teste-app"));
    if (error) throw error;
    const eng = { uid: data.user!.id, nome: "Engenharia", papel: "engenharia" as const };
    const cat = {
      maquinas: await catalogo.listarMaquinas(),
      subdivisoes: await catalogo.listarSubdivisoes(),
      erros: await catalogo.listarErros(),
    };
    expect(cat.maquinas).toHaveLength(4);
    expect(cat.subdivisoes).toHaveLength(31);

    await demo.limparDemo();
    await demo.criarCenarioDemo(cat, eng, CONFIG_PADRAO);
    const { data: linhas } = await supabase.from("chamados").select("*").eq("demo", true).eq("status", "aberto");
    const { chamadoDeLinha } = await import("./mapear");
    const fila = ordenarFila(linhas!.map(chamadoDeLinha), Date.now(), CONFIG_PADRAO);
    expect(fila[0].maquinaId).toBe("A"); // mais nova, mas qualidade + reincidência + gargalo
    expect(fila[0].prioridade.criterios.c5).toBeGreaterThan(0); // reincidência pelo histórico

    const dup = await chamados.buscarDuplicado("A", "A-AQUECIMENTO");
    expect(dup?.maquinaId).toBe("A");
    expect(await chamados.contarReincidencia("A-AQUECIMENTO", 7)).toBeGreaterThanOrEqual(2);

    expect(await demo.limparDemo()).toBe(4);
    await supabase.auth.signOut();
  });

  it("foto: operador anônimo envia ao bucket e a TV abre por URL assinada", { timeout: 30_000 }, async () => {
    const op = await anonimo();
    const path = `chamados/teste-${Date.now()}.jpg`;
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
    expect((await op.c.storage.from("fotos").upload(path, jpeg, { contentType: "image/jpeg" })).error).toBeNull();
    // Não é imagem: recusado pelo bucket.
    const txt = new Blob(["x"], { type: "text/plain" });
    expect((await op.c.storage.from("fotos").upload(`${path}.txt`, txt, { contentType: "text/plain" })).error).not.toBeNull();

    const tv = await entrar("oficina");
    const { data, error } = await tv.c.storage.from("fotos").createSignedUrl(path, 60);
    expect(error).toBeNull();
    expect((await fetch(data!.signedUrl)).status).toBe(200);
  });

  it("cenário de demonstração e limpeza (engenharia)", { timeout: 60_000 }, async () => {
    const eng = await entrar("engenharia");
    const id = await abrir(eng.c, { demo: true, abertura: new Date(Date.now() - 25 * 60_000).toISOString() });
    const { data } = await eng.c.from("chamados").select("abertura, demo").eq("id", id).single();
    expect(data!.demo).toBe(true);
    expect(Date.now() - Date.parse(data!.abertura)).toBeGreaterThan(24 * 60_000);

    // Operador não consegue recuar a abertura nem marcar demo.
    const op = await anonimo();
    const id2 = await abrir(op.c, { demo: true, abertura: "2020-01-01T00:00:00Z" });
    const { data: d2 } = await op.c.from("chamados").select("abertura, demo").eq("id", id2).single();
    expect(d2!.demo).toBe(false);
    expect(Date.now() - Date.parse(d2!.abertura)).toBeLessThan(60_000);
    expect((await op.c.rpc("limpar_demo")).error).not.toBeNull();

    const { data: n, error } = await eng.c.rpc("limpar_demo");
    expect(error).toBeNull();
    expect(n).toBeGreaterThanOrEqual(1);
  });
});
