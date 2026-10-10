/** CSV com separador ";" e BOM UTF-8: abre direto no Excel em português. */

export function celula(v: unknown): string {
  const s = String(v ?? "");
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Texto digitado por pessoas: um apóstrofo impede o Excel de ler "=…", "+…", "-…" ou "@…" como fórmula. */
export function textoLivre(s: string | null | undefined): string {
  const t = s ?? "";
  return /^[=+\-@]/.test(t) ? `'${t}` : t;
}

/** Data local AAAA-MM-DD, para o nome do arquivo (toISOString daria a data em UTC). */
export function dataLocal(d = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export function baixarCsv(conteudo: string, nomeArquivo: string): void {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(a.href);
}
