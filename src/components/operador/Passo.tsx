import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Um passo do formulário: aberto mostra as opções; resolvido vira um resumo com "Trocar". */
export function Passo({
  numero,
  titulo,
  resumo,
  aoTrocar,
  children,
}: {
  numero: number;
  titulo: string;
  resumo?: ReactNode;
  aoTrocar?: () => void;
  children?: ReactNode;
}) {
  const feito = Boolean(resumo);
  return (
    <section className="grid gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full font-heading text-base font-bold transition-colors",
            feito ? "bg-moura-amarelo text-moura-azul" : "bg-moura-azul text-white",
          )}
        >
          {feito ? <CheckIcon className="size-4" strokeWidth={3} /> : numero}
        </span>
        <h2 className="text-xl font-semibold">{titulo}</h2>
      </div>
      {resumo ? (
        <div className="flex items-center gap-2 rounded-xl border border-moura-azul/15 bg-accent/60 p-3 pl-4">
          <div className="flex-1 font-medium text-moura-azul">{resumo}</div>
          {aoTrocar && (
            <Button variant="ghost" size="sm" onClick={aoTrocar} className="text-moura-azul">
              Trocar
            </Button>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
