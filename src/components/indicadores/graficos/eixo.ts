import { formatarMinutos } from "@/lib/tempo";

/** Rótulo de eixo em minutos: o zero aparece como "0", e não "< 1 min". */
export function formatarEixoMin(v: number): string {
  return v === 0 ? "0" : formatarMinutos(v);
}
