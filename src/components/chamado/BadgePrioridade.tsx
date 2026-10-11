import { cn } from "@/lib/utils";
import type { Classe } from "@/lib/tipos";

export const COR_CLASSE: Record<Classe, string> = {
  P0: "bg-p0 text-white",
  P1: "bg-p1 text-white",
  P2: "bg-p2 text-black",
  P3: "bg-p3 text-white",
};

export const BARRA_CLASSE: Record<Classe, string> = {
  P0: "border-l-p0",
  P1: "border-l-p1",
  P2: "border-l-p2",
  P3: "border-l-p3",
};

/** A cor nunca aparece sozinha: o texto da classe vai sempre junto. */
export function BadgePrioridade({
  classe,
  ajustada = false,
  className,
}: {
  classe: Classe;
  ajustada?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold tabular-nums",
        COR_CLASSE[classe],
        className,
      )}
      title={ajustada ? "Prioridade ajustada pelo líder" : undefined}
    >
      {classe}
      {ajustada && <span aria-label="prioridade ajustada pelo líder">✎</span>}
    </span>
  );
}
