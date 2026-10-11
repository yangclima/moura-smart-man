import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Tela de estado (não encontrado, erro, vazio): ícone, título, explicação e o próximo passo. */
export function EstadoTela({
  icone: Icone,
  titulo,
  children,
  acoes,
  tom = "neutro",
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  children?: ReactNode;
  acoes?: ReactNode;
  tom?: "neutro" | "erro";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mx-auto grid w-full max-w-md justify-items-center gap-4 px-4 py-12 text-center animate-in fade-in-0 duration-300",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl",
          tom === "erro" ? "bg-destructive/10 text-destructive" : "bg-accent text-moura-azul",
        )}
      >
        <Icone className="size-7" aria-hidden />
      </span>
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-bold text-moura-azul">{titulo}</h1>
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
      {acoes && <div className="flex flex-wrap justify-center gap-2">{acoes}</div>}
    </section>
  );
}
