import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO = "/Logotipo_da_Baterias_Moura.svg.webp";

/** Logotipo completo (símbolo + "moura"). Use sobre fundo claro. */
export function LogoMoura({ className, prioritario = false }: { className?: string; prioritario?: boolean }) {
  return (
    <Image
      src={LOGO}
      alt="Moura"
      width={2000}
      height={556}
      priority={prioritario}
      className={cn("h-7 w-auto", className)}
    />
  );
}

/** Só o símbolo "M" do logotipo, desenhado em SVG: funciona em fundo claro e escuro. */
export function SimboloMoura({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 742 556" aria-hidden className={cn("h-7 w-auto", className)}>
      <polygon points="0,388 408,83 408,250 0,556" fill="var(--moura-amarelo)" />
      <polygon points="278,347 408,250 408,458 278,556" fill="var(--moura-laranja)" />
      <polygon points="408,250 742,0 742,208 408,458" fill="var(--moura-azul-claro)" />
      <polygon points="594,320 742,208 742,444 594,556" fill="var(--moura-azul)" />
    </svg>
  );
}

/** Faixa fina com as cores da marca. */
export function FaixaMoura({ className }: { className?: string }) {
  return <div aria-hidden className={cn("faixa-moura h-1 w-full", className)} />;
}
