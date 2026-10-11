import { Loader2Icon } from "lucide-react";

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center gap-2.5 p-10 text-muted-foreground"
    >
      <Loader2Icon className="size-5 animate-spin text-moura-azul-claro" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}
