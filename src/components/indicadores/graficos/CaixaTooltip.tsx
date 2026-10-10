import type { ReactNode } from "react";

export interface LinhaTooltip {
  rotulo: string;
  valor: ReactNode;
  cor?: string;
  /** Linha secundária (ex.: mediana sob a média). */
  detalhe?: ReactNode;
}

/** Conteúdo do tooltip dos gráficos: título, linhas com valor exato e o n do ponto ou da barra. */
export function CaixaTooltip({ titulo, linhas, rodape }: { titulo: ReactNode; linhas: LinhaTooltip[]; rodape?: ReactNode }) {
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{titulo}</div>
      <div className="grid gap-1">
        {linhas.map((l) => (
          <div key={l.rotulo} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2">
            <span className="size-2.5 rounded-[2px]" style={{ background: l.cor ?? "transparent" }} aria-hidden />
            <span className="text-muted-foreground">{l.rotulo}</span>
            <span className="text-right font-mono font-medium text-foreground tabular-nums">{l.valor}</span>
            {l.detalhe && <span className="col-start-2 col-end-4 text-[11px] text-muted-foreground">{l.detalhe}</span>}
          </div>
        ))}
      </div>
      {rodape && <div className="border-t pt-1 text-muted-foreground">{rodape}</div>}
    </div>
  );
}
