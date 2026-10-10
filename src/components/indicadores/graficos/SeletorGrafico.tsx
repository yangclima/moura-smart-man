import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface SeletorGraficoProps<T extends string> {
  rotulo: string;
  valor: T;
  opcoes: Record<T, string>;
  onChange: (v: T) => void;
}

/** Alternância compacta entre visões do mesmo gráfico (agrupamento, métrica). */
export function SeletorGrafico<T extends string>({ rotulo, valor, opcoes, onChange }: SeletorGraficoProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      aria-label={rotulo}
      value={valor}
      onValueChange={(v) => v && onChange(v as T)}
    >
      {(Object.keys(opcoes) as T[]).map((k) => (
        <ToggleGroupItem key={k} value={k} className="px-3">
          {opcoes[k]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
