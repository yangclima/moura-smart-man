"use client";

import { ArrowRightIcon, DeleteIcon, Loader2Icon, QrCodeIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FaixaMoura, LogoMoura, SimboloMoura } from "@/components/marca/Marca";
import { Button } from "@/components/ui/button";
import { useUsuario } from "@/hooks/useUsuario";
import { DESTINO_POR_PAPEL, entrarComPin, TAMANHO_PIN } from "@/lib/perfis";
import { cn } from "@/lib/utils";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function Login() {
  const { usuario, carregando } = useUsuario();
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!carregando && usuario?.papel) router.replace(DESTINO_POR_PAPEL[usuario.papel]);
  }, [carregando, usuario, router]);

  // Com cacheComponents o Next esconde a página (<Activity>) em vez de desmontá-la:
  // sem isto, ao sair da conta o teclado voltaria travado em "Entrando…".
  useLayoutEffect(() => {
    return () => {
      setPin("");
      setEntrando(false);
      setErro(null);
    };
  }, []);

  async function enviar(valor: string) {
    setEntrando(true);
    setErro(null);
    try {
      await entrarComPin(valor);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar");
      setPin("");
      setEntrando(false);
      campo.current?.focus();
    }
  }

  function mudar(valor: string) {
    if (entrando) return;
    const limpo = valor.replace(/\D/g, "").slice(0, TAMANHO_PIN);
    setPin(limpo);
    setErro(null);
    if (limpo.length === TAMANHO_PIN) void enviar(limpo);
  }

  return (
    <div className="grid flex-1 lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <PainelMarca />

      <main id="conteudo" className="flex flex-col bg-card">
        <FaixaMoura className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-8">
          <div className="grid justify-items-center gap-4 text-center">
            <LogoMoura className="h-10 lg:hidden" prioritario />
            <div>
              <h1 className="text-3xl font-bold text-moura-azul">Acionamento da manutenção</h1>
              <p className="text-muted-foreground">Digite seu PIN para entrar</p>
            </div>
          </div>

          {/* Campo real (teclado físico, leitor de senha e teclado numérico do celular). */}
          <input
            ref={campo}
            value={pin}
            onChange={(e) => mudar(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            type="password"
            maxLength={TAMANHO_PIN}
            autoFocus
            aria-label="PIN"
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => campo.current?.focus()}
            className="flex justify-center gap-3"
            aria-hidden
            tabIndex={-1}
          >
            {Array.from({ length: TAMANHO_PIN }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-4 rounded-full border-2 border-moura-azul/30 transition-all duration-150",
                  i < pin.length && "scale-110 border-moura-azul bg-moura-azul",
                  i === pin.length && !erro && "border-moura-amarelo",
                  erro && "border-destructive bg-transparent",
                )}
              />
            ))}
          </button>

          <p className={cn("min-h-6 text-center text-sm", erro ? "text-destructive" : "text-muted-foreground")} role="alert">
            {entrando ? (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin" /> Entrando…
              </span>
            ) : (
              erro
            )}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {TECLAS.map((t) => (
              <Tecla key={t} disabled={entrando} onClick={() => mudar(pin + t)}>
                {t}
              </Tecla>
            ))}
            <span />
            <Tecla disabled={entrando} onClick={() => mudar(pin + "0")}>
              0
            </Tecla>
            <Button
              variant="ghost"
              className="h-16 rounded-2xl text-muted-foreground"
              disabled={entrando || pin.length === 0}
              onClick={() => mudar(pin.slice(0, -1))}
              aria-label="Apagar"
            >
              <DeleteIcon className="size-6" />
            </Button>
          </div>

          <Link
            href="/c"
            className="group flex items-center gap-3 rounded-2xl border border-moura-amarelo/60 bg-moura-amarelo/10 p-4 transition-colors hover:bg-moura-amarelo/20 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-moura-amarelo text-moura-azul">
              <QrCodeIcon className="size-5" />
            </span>
            <span className="grid flex-1 text-left leading-tight">
              <span className="font-semibold text-moura-azul">Sou operador</span>
              <span className="text-sm text-muted-foreground">Abrir chamado sem PIN</span>
            </span>
            <ArrowRightIcon className="size-5 text-moura-azul transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}

function Tecla({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      className="h-16 rounded-2xl font-heading text-3xl font-semibold text-moura-azul shadow-xs hover:border-moura-azul/40 hover:bg-accent active:bg-moura-azul active:text-white"
      {...props}
    >
      {children}
    </Button>
  );
}

/** Lado esquerdo (telas largas): identidade Moura. */
function PainelMarca() {
  return (
    <aside className="relative hidden overflow-hidden bg-moura-azul text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <SimboloMoura className="pointer-events-none absolute -right-24 -bottom-16 h-[28rem] opacity-90" />
      <div className="relative w-fit rounded-xl bg-white px-5 py-3 shadow-lg">
        <LogoMoura className="h-9" prioritario />
      </div>
      <div className="relative grid max-w-md gap-4">
        <span className="h-1.5 w-16 rounded-full bg-moura-amarelo" />
        <h2 className="text-5xl leading-none font-bold">
          Máquina parou?
          <br />
          <span className="text-moura-amarelo">A manutenção já sabe.</span>
        </h2>
        <p className="text-lg text-white/75">
          Chamados por QR Code, com prioridade automática, rastreabilidade e acompanhamento em tempo real.
        </p>
      </div>
      <p className="relative text-sm text-white/50">Baterias Moura · Manutenção</p>
    </aside>
  );
}
