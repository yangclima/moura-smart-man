"use client";

import { ArrowLeftIcon, ExpandIcon, LogOutIcon, Volume2Icon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Carregando } from "@/components/Carregando";
import { CartaoChamado } from "@/components/chamado/CartaoChamado";
import { SimboloMoura } from "@/components/marca/Marca";
import { Button } from "@/components/ui/button";
import { useAgora } from "@/hooks/useAgora";
import { useChamadosAbertos } from "@/hooks/useChamadosAbertos";
import { useConfig } from "@/hooks/useConfig";
import { useEquipe } from "@/hooks/useMantenedores";
import { useRecursosTV } from "@/hooks/useRecursosTV";
import { useUsuario } from "@/hooks/useUsuario";
import { DESTINO_POR_PAPEL } from "@/lib/perfis";
import { ordenarFila } from "@/lib/prioridade";
import { supabase } from "@/lib/supabase";
import { formatarCronometro } from "@/lib/tempo";
import type { Chamado } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const EM_FILA = new Set(["aberto", "recebido"]);
const EM_ATUACAO = new Set(["em_atendimento", "pausado"]);

export default function PainelOficina() {
  const agora = useAgora();
  const config = useConfig();
  const { chamados, carregando, offline, atualizadoEm, novos } = useChamadosAbertos();
  const equipe = useEquipe();
  const tv = useRecursosTV();

  // Toca o alerta quando chega chamado novo.
  const qtdNovos = novos.size;
  const anterior = useRef(0);
  const { alertar } = tv;
  useEffect(() => {
    if (qtdNovos > anterior.current) alertar();
    anterior.current = qtdNovos;
  }, [qtdNovos, alertar]);

  if (carregando) return <Carregando />;

  const fila = ordenarFila(chamados.filter((c) => EM_FILA.has(c.status)), agora, config);
  const atuacao = chamados.filter((c) => EM_ATUACAO.has(c.status));
  const liberacao = chamados.filter((c) => c.status === "aguardando_liberacao");
  const ocupados = new Set(atuacao.map((c) => c.responsavel?.uid).filter(Boolean));
  const mantenedores = equipe.filter((p) => p.papel === "mantenedor");
  const livres = mantenedores.filter((m) => !ocupados.has(m.uid)).length;
  const paradas = chamados.filter((c) => c.condicao === "parada").length;
  const maiorEspera = Math.max(0, ...fila.map((c) => agora - c.marcos.abertura));

  return (
    <div className="dark flex min-h-dvh flex-col bg-background text-base text-foreground lg:h-dvh lg:overflow-hidden lg:text-2xl">
      {offline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-red-600 py-1 text-lg text-white">
          <WifiOffIcon className="size-5" /> Sem conexão — dados de{" "}
          {atualizadoEm ? new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </div>
      )}
      <div className="faixa-moura h-1.5 shrink-0" aria-hidden />
      <header className="flex flex-wrap items-center gap-3 border-b bg-moura-azul p-3 text-white">
        <div className="flex items-center gap-3 pr-2">
          <SimboloMoura className="h-10 lg:h-12" />
          <div className="leading-none">
            <div className="font-heading text-2xl font-bold tracking-wide uppercase lg:text-3xl">Oficina</div>
            <div className="font-heading text-3xl font-bold text-moura-amarelo tabular-nums lg:text-4xl">
              {new Date(agora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
        <div className="order-last grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:order-none lg:flex lg:w-auto lg:flex-1 lg:gap-3">
          <Indicador rotulo="Máquinas paradas" valor={paradas} alerta={paradas > 0} />
          <Indicador rotulo="Abertos" valor={chamados.length} />
          <Indicador rotulo="Mantenedores livres" valor={`${livres}/${mantenedores.length}`} />
          <Indicador rotulo="Maior espera" valor={fila.length ? formatarCronometro(maiorEspera) : "—"} />
        </div>
        <div className="nao-imprimir ml-auto flex items-center gap-2">
          {!tv.somAtivo && (
            <Button variant="destaque" size="lg" onClick={tv.ativarSom}>
              <Volume2Icon /> Ativar som
            </Button>
          )}
          <Button variant="ghost" size="icon-lg" onClick={tv.telaCheia} aria-label="Tela cheia" className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex">
            <ExpandIcon />
          </Button>
          <SairDaTV />
        </div>
      </header>

      <main id="conteudo" className="grid min-h-0 flex-1 gap-4 p-3 sm:p-4 lg:grid-cols-[65fr_35fr]">
        <Coluna titulo={`Fila · ${fila.length}`} vazio="Nenhum chamado aguardando">
          {fila.map((c) => (
            <CartaoChamado key={c.id} chamado={c} agora={agora} config={config} destaque={novos.has(c.id)} />
          ))}
        </Coluna>
        <div className="grid min-h-0 gap-4 lg:grid-rows-2">
          <Coluna titulo={`Em atendimento · ${atuacao.length}`} vazio="Ninguém em atendimento" compacta>
            {atuacao.map((c) => (
              <Cartao key={c.id} c={c} agora={agora} config={config} />
            ))}
          </Coluna>
          <Coluna titulo={`Aguardando liberação · ${liberacao.length}`} vazio="—" compacta>
            {liberacao.map((c) => (
              <Cartao key={c.id} c={c} agora={agora} config={config} />
            ))}
          </Coluna>
        </div>
      </main>
    </div>
  );
}

/** A conta da TV sai de fato; quem é da equipe só volta para a própria área. */
function SairDaTV() {
  const { usuario } = useUsuario();
  const router = useRouter();
  const estilo = "text-white/80 hover:bg-white/10 hover:text-white";

  if (!usuario?.papel || usuario.papel === "oficina") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={estilo}
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }}
      >
        <LogOutIcon /> Sair
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="sm" className={estilo}>
      <Link href={DESTINO_POR_PAPEL[usuario.papel]}>
        <ArrowLeftIcon /> Voltar
      </Link>
    </Button>
  );
}

function Cartao({ c, agora, config }: { c: Chamado; agora: number; config: ReturnType<typeof useConfig> }) {
  return <CartaoChamado chamado={c} agora={agora} config={config} variante="compacto" />;
}

function Indicador({ rotulo, valor, alerta = false }: { rotulo: string; valor: React.ReactNode; alerta?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-1.5 lg:min-w-40",
        alerta ? "border-red-400 bg-red-600 text-white shadow-lg shadow-red-900/40" : "border-white/15 bg-white/10",
      )}
    >
      <div className={cn("text-xs font-medium tracking-wide uppercase lg:text-sm", !alerta && "text-white/70")}>{rotulo}</div>
      <div className="font-heading text-3xl font-bold tabular-nums lg:text-4xl">{valor}</div>
    </div>
  );
}

function Coluna({
  titulo,
  vazio,
  compacta = false,
  children,
}: {
  titulo: string;
  vazio: string;
  compacta?: boolean;
  children: React.ReactNode[];
}) {
  return (
    <section className="flex min-h-0 flex-col gap-2 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 sm:p-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-wider text-muted-foreground uppercase lg:text-xl">
        <span className="h-4 w-1 rounded-full bg-moura-amarelo" aria-hidden />
        {titulo}
      </h2>
      <div className={cn("flex min-h-0 flex-col gap-3 lg:overflow-hidden", compacta && "lg:text-xl")}>
        {children.length ? children : <p className="py-4 text-center text-muted-foreground">{vazio}</p>}
      </div>
    </section>
  );
}
