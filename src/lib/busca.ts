/** Busca textual tolerante: ignora acentos, caixa e ordem das palavras. */

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Todas as palavras do termo precisam aparecer em algum dos campos ("ext 03" casa "Extrusora 03"). */
export function casaBusca(termo: string, campos: (string | null | undefined)[]): boolean {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const texto = normalizar(campos.filter(Boolean).join(" "));
  return palavras.every((p) => texto.includes(p));
}
