/** Preferências do aparelho do operador (localStorage). Tudo tolerante a falhas. */

const CHAVE_NOME = "acionamento.operador.nome";
const CHAVE_CHAMADOS = "acionamento.operador.chamados";
const MAX_CHAMADOS = 10;

function ler(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // modo privado ou armazenamento bloqueado: segue sem lembrar
  }
}

export const lerNomeOperador = () => ler(CHAVE_NOME) ?? "";
export const gravarNomeOperador = (nome: string) => gravar(CHAVE_NOME, nome.trim());

export function lerMeusChamados(): string[] {
  try {
    const lista = JSON.parse(ler(CHAVE_CHAMADOS) ?? "[]");
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function lembrarChamado(id: string): void {
  const lista = [id, ...lerMeusChamados().filter((x) => x !== id)].slice(0, MAX_CHAMADOS);
  gravar(CHAVE_CHAMADOS, JSON.stringify(lista));
}
