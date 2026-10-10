import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BotaoNumeroProps {
  children: ReactNode;
  /** Descreve o que a lista vai mostrar, para leitores de tela. */
  rotulo: string;
  onClick: () => void;
  className?: string;
}

/** Número de um indicador que abre a lista de eventos já filtrada. */
export function BotaoNumero({ children, rotulo, onClick, className }: BotaoNumeroProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "rounded-sm font-medium tabular-nums text-moura-azul-claro underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </button>
  );
}
