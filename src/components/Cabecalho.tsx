"use client";

import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FaixaMoura, LogoMoura } from "@/components/marca/Marca";
import { Button } from "@/components/ui/button";
import { useUsuario } from "@/hooks/useUsuario";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface LinkCabecalho {
  href: string;
  rotulo: string;
}

/** O link mais específico que casa com a rota atual fica ativo. */
function linkAtivo(links: LinkCabecalho[], rota: string): string | undefined {
  return links
    .filter((l) => rota === l.href || rota.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Cabecalho({
  titulo,
  links = [],
  extra,
}: {
  titulo: string;
  links?: LinkCabecalho[];
  extra?: ReactNode;
}) {
  const { usuario } = useUsuario();
  const router = useRouter();
  const rota = usePathname();
  const ativo = linkAtivo(links, rota);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="nao-imprimir sticky top-0 z-20 border-b bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <FaixaMoura />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <LogoMoura className="h-6 sm:h-7" prioritario />
          <span className="h-6 w-px bg-border" aria-hidden />
          <span className="font-heading text-lg font-semibold tracking-wide text-moura-azul uppercase">{titulo}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 md:order-last">
          {extra}
          {usuario && (
            <div className="flex items-center gap-2" title={usuario.nome}>
              <span className="hidden text-right text-sm leading-tight sm:block">
                <span className="block font-medium">{usuario.nome}</span>
                {usuario.papel && <span className="block text-xs text-muted-foreground capitalize">{usuario.papel}</span>}
              </span>
              <span className="flex size-8 items-center justify-center rounded-full bg-moura-azul text-xs font-bold text-white">
                {iniciais(usuario.nome)}
              </span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair" title="Sair">
            <LogOutIcon />
          </Button>
        </div>

        {links.length > 0 && (
          <nav
            aria-label="Seções"
            className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-auto md:overflow-visible md:p-0"
          >
            {links.map((l) => {
              const atual = l.href === ativo;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={atual ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    atual
                      ? "bg-moura-azul text-white shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-moura-azul",
                  )}
                >
                  {l.rotulo}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
