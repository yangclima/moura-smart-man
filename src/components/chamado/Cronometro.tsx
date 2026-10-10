import { TimerIcon } from "lucide-react";
import type { SituacaoMeta } from "@/lib/prioridade";
import { formatarCronometro } from "@/lib/tempo";
import { cn } from "@/lib/utils";

const COR: Record<SituacaoMeta, string> = {
  ok: "text-foreground",
  atencao: "text-amber-600 dark:text-amber-400",
  estourado: "text-red-600 dark:text-red-400",
};

export function Cronometro({
  desdeMs,
  agora,
  situacao = "ok",
  className,
}: {
  desdeMs: number;
  agora: number;
  situacao?: SituacaoMeta;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono font-semibold tabular-nums", COR[situacao], className)}>
      <TimerIcon className="size-[1em]" aria-hidden />
      {formatarCronometro(agora - desdeMs)}
      {situacao === "estourado" && <span aria-label="meta estourada">▲</span>}
    </span>
  );
}
