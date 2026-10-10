import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMinutos } from "@/lib/tempo";

interface CartaoTempoProps {
  rotulo: string;
  mediana: number | null;
  p90: number | null;
  /** Quantos registros entraram no cálculo; omitido, não aparece. */
  n?: number;
  /** Observação curta sob os números (ex.: de onde vem o marco). */
  legenda?: string;
  /** Alerta de leitura, destacado (ex.: mediana negativa). */
  aviso?: string;
}

/** Mediana em destaque, P90 e n embaixo. Usado nas abas Operação e Histórico. */
export function CartaoTempo({ rotulo, mediana, p90, n, legenda, aviso }: CartaoTempoProps) {
  return (
    <Card className="border-t-4 border-t-moura-amarelo">
      <CardHeader>
        <CardTitle className="font-sans text-sm font-medium text-muted-foreground">{rotulo}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1">
        <div className="font-heading text-4xl font-bold text-moura-azul tabular-nums">{formatarMinutos(mediana)}</div>
        <div className="text-sm text-muted-foreground">
          mediana · P90 {formatarMinutos(p90)}
          {n !== undefined && <> · n = {n}</>}
        </div>
        {legenda && <p className="text-xs text-muted-foreground">{legenda}</p>}
        {aviso && <p className="text-xs font-medium text-amber-700">{aviso}</p>}
      </CardContent>
    </Card>
  );
}
