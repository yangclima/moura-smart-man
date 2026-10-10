import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gerarPin, hashPin, pinValido, senhaInterna } from "./credenciais";

describe("credenciais por PIN", () => {
  const original = process.env.PIN_SEGREDO;
  beforeEach(() => {
    process.env.PIN_SEGREDO = "segredo-de-teste";
  });
  afterEach(() => {
    process.env.PIN_SEGREDO = original;
  });

  it("aceita só 6 dígitos", () => {
    expect(pinValido("012345")).toBe(true);
    expect(pinValido("12345")).toBe(false);
    expect(pinValido("1234567")).toBe(false);
    expect(pinValido("12a456")).toBe(false);
    expect(pinValido(123456)).toBe(false);
  });

  it("gera PINs de 6 dígitos, inclusive com zeros à esquerda", () => {
    for (let i = 0; i < 200; i++) expect(pinValido(gerarPin())).toBe(true);
  });

  it("hash depende do segredo do servidor e não contém o PIN", () => {
    const h = hashPin("123456");
    expect(h).toHaveLength(64);
    expect(h).not.toContain("123456");
    expect(hashPin("123456")).toBe(h);
    process.env.PIN_SEGREDO = "outro-segredo";
    expect(hashPin("123456")).not.toBe(h);
  });

  it("senha interna é estável por usuário e diferente entre usuários", () => {
    expect(senhaInterna("a")).toBe(senhaInterna("a"));
    expect(senhaInterna("a")).not.toBe(senhaInterna("b"));
  });

  it("falha claramente sem PIN_SEGREDO", () => {
    delete process.env.PIN_SEGREDO;
    expect(() => hashPin("123456")).toThrow("PIN_SEGREDO");
  });
});
