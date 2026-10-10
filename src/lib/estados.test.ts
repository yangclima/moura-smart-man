import { describe, expect, it } from "vitest";
import { AcaoRecusada, acoesDisponiveis, validarAcao } from "./estados";
import type { Chamado, Usuario } from "./tipos";

const joao: Usuario = { uid: "joao", nome: "João", papel: "mantenedor" };
const pedro: Usuario = { uid: "pedro", nome: "Pedro", papel: "mantenedor" };
const lider: Usuario = { uid: "ana", nome: "Ana", papel: "lider" };
const operador: Usuario = { uid: "maria", nome: "Maria", papel: null };

type Base = Pick<Chamado, "status" | "responsavel" | "solicitante">;
const ch = (status: Chamado["status"], responsavel: Usuario | null = null): Base => ({
  status,
  responsavel: responsavel && { uid: responsavel.uid, nome: responsavel.nome },
  solicitante: { uid: "maria", nome: "Maria" },
});

describe("validarAcao", () => {
  it("receber duas vezes: a segunda falha dizendo quem recebeu", () => {
    expect(validarAcao(ch("aberto"), "receber", joao).para).toBe("recebido");
    expect(() => validarAcao(ch("recebido", joao), "receber", pedro)).toThrow(
      "Chamado já recebido por João",
    );
  });

  it("segue a máquina de estados de ponta a ponta", () => {
    expect(validarAcao(ch("recebido", joao), "iniciar", joao).marco).toBe("inicio");
    expect(validarAcao(ch("em_atendimento", joao), "pausar", joao, { motivo: "peça" }).para).toBe(
      "pausado",
    );
    expect(validarAcao(ch("pausado", joao), "retomar", joao).para).toBe("em_atendimento");
    const conclusao = { componente: "BCL", modoFalha: "quebra", acao: "substituído", pecas: "", obs: "" };
    expect(validarAcao(ch("em_atendimento", joao), "concluir", joao, { conclusao }).marco).toBe(
      "fimAtuacao",
    );
    expect(validarAcao(ch("aguardando_liberacao", joao), "liberar", operador).para).toBe("encerrado");
  });

  it("recusa transição inválida", () => {
    expect(() => validarAcao(ch("aberto"), "concluir", joao)).toThrow(AcaoRecusada);
    expect(() => validarAcao(ch("encerrado", joao), "reabrir", operador)).toThrow(AcaoRecusada);
  });

  it("só o responsável (ou o líder) conduz o atendimento", () => {
    expect(() => validarAcao(ch("recebido", joao), "iniciar", pedro)).toThrow("Chamado está com João");
    expect(validarAcao(ch("recebido", joao), "iniciar", lider).para).toBe("em_atendimento");
  });

  it("operador só libera ou reabre o próprio chamado", () => {
    const outro: Usuario = { uid: "zeca", nome: "Zeca", papel: null };
    expect(() => validarAcao(ch("aguardando_liberacao", joao), "liberar", outro)).toThrow(
      "Seu perfil não pode executar esta ação",
    );
    expect(() => validarAcao(ch("aberto"), "receber", operador)).toThrow(AcaoRecusada);
  });

  it("exige motivo, justificativa e campos de conclusão", () => {
    expect(() => validarAcao(ch("em_atendimento", joao), "pausar", joao)).toThrow("Informe o motivo");
    expect(() => validarAcao(ch("aberto"), "cancelar", lider, { motivo: " " })).toThrow();
    expect(() =>
      validarAcao(ch("aberto"), "priorizar", lider, { classe: "P1", justificativa: "curta" }),
    ).toThrow("pelo menos 15");
    expect(
      validarAcao(ch("aberto"), "priorizar", lider, {
        classe: "P1",
        justificativa: "linha parada no cliente",
      }).para,
    ).toBeUndefined();
    expect(() => validarAcao(ch("em_atendimento", joao), "concluir", joao, {})).toThrow(
      "Preencha componente",
    );
  });

  it("cancelar e atribuir são exclusivos do líder", () => {
    expect(() => validarAcao(ch("aberto"), "cancelar", joao, { motivo: "engano" })).toThrow();
    expect(() => validarAcao(ch("aberto"), "atribuir", lider)).toThrow("Escolha o mantenedor");
    expect(
      validarAcao(ch("aberto"), "atribuir", lider, { mantenedor: { uid: "joao", nome: "João" } }).para,
    ).toBe("recebido");
  });
});

describe("acoesDisponiveis", () => {
  it("lista as ações válidas para o perfil", () => {
    expect(acoesDisponiveis(ch("aberto"), joao)).toEqual(["receber"]);
    expect(acoesDisponiveis(ch("em_atendimento", joao), joao)).toEqual(["pausar", "concluir"]);
    expect(acoesDisponiveis(ch("aberto"), lider)).toEqual([
      "receber",
      "cancelar",
      "atribuir",
      "priorizar",
    ]);
    expect(acoesDisponiveis(ch("aguardando_liberacao", joao), operador)).toEqual([
      "liberar",
      "reabrir",
    ]);
  });
});
