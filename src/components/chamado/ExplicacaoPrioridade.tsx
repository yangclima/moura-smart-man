import { explicarScore, prioridadeAtual } from "@/lib/prioridade";
import type { Chamado, ConfigPriorizacao } from "@/lib/tipos";
import { BadgePrioridade } from "./BadgePrioridade";

/** "P1 · score 74 = condição (42) + impacto da máquina (26) + histórico (6) + espera (+0)". */
export function ExplicacaoPrioridade({
  chamado,
  agora,
  config,
}: {
  chamado: Chamado;
  agora: number;
  config: ConfigPriorizacao;
}) {
  const p = prioridadeAtual(chamado, agora, config);
  const partes = explicarScore(chamado.prioridade.criterios, config.pesos);
  const envelhecimento = Math.round(10 * (p.scoreEfetivo - chamado.prioridade.scoreBase)) / 10;

  return (
    <div className="grid gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <BadgePrioridade classe={p.classe} ajustada={Boolean(chamado.override)} />
        <span>
          score <b className="tabular-nums">{p.scoreEfetivo}</b> ={" "}
          {partes.map((x) => `${x.rotulo} (${x.pontos})`).join(" + ") || "0"}
          {envelhecimento > 0 && ` + espera (${envelhecimento})`}
        </span>
      </div>
      {chamado.riscoPessoas && (
        <p className="text-red-600">⚠ Risco a pessoas: P0 independentemente do score.</p>
      )}
      {chamado.override && (
        <p className="text-muted-foreground">
          ✎ Ajustada pelo líder {chamado.override.por} de {p.classeCalculada} para {chamado.override.classe}:{" "}
          “{chamado.override.justificativa}”
        </p>
      )}
    </div>
  );
}
