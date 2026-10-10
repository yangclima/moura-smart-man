import { Loader2Icon } from "lucide-react";

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 p-10 text-muted-foreground">
      <Loader2Icon className="size-5 animate-spin" />
      <span>{texto}</span>
    </div>
  );
}
