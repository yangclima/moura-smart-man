"use client";

import { PlusIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { EstadoTela } from "@/components/EstadoTela";
import { BadgePrioridade } from "@/components/chamado/BadgePrioridade";
import { SeloCondicao } from "@/components/chamado/CartaoChamado";
import { Cronometro } from "@/components/chamado/Cronometro";
import { FotoChamado } from "@/components/chamado/FotoChamado";
import { LinhaDoTempo } from "@/components/chamado/LinhaDoTempo";
import { ChamadosEmAberto } from "@/components/chamado/ChamadosEmAberto";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgora } from "@/hooks/useAgora";
import { useChamadosAbertos } from "@/hooks/useChamadosAbertos";
import { useChamado } from "@/hooks/useChamado";
import { useConfig } from "@/hooks/useConfig";
import { useOperador } from "@/hooks/useOperador";
import { executarAcao, mensagemDeErro } from "@/lib/chamados";
import type { Acao } from "@/lib/estados";
import { estourouMeta, ordenarFila, prioridadeAtual } from "@/lib/prioridade";
import { formatarHora, formatarMinutos } from "@/lib/tempo";
import type { Chamado, ConfigPriorizacao } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const AVISO = "rounded-xl border-l-4 bg-card p-4 shadow-sm";

export function AcompanharChamado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const op = useOperador();
  const config = useConfig(op.pronto);
  const agora = useAgora();
  const { dado: chamado, carregando } = useChamado(op.pronto ? id : null);
  const fila = useChamadosAbertos(op.pronto);
  const [executando, setExecutando] = useState<Acao | null>(null);

  if (!op.pronto || carregando) return <Carregando />;
  if (!chamado) {
    return (
      <main id="conteudo">
        <EstadoTela
          icone={SearchXIcon}
          titulo="Chamado não encontrado"
          acoes={
            <Button asChild className="h-12 rounded-xl px-5 text-base">
              <Link href="/chamado">Ver chamados em aberto</Link>
            </Button>
          }
        >
          O link pode estar incompleto ou o chamado foi removido.
        </EstadoTela>
      </main>
    );
  }

  const ordem = ordenarFila(fila.chamados.filter((c) => c.status === "aberto"), agora, config);
  const chamadoId = chamado.id;
  const posicao = ordem.findIndex((c) => c.id === chamadoId) + 1;

  async function agir(acao: Acao) {
    if (!op.usuario) return;
    setExecutando(acao);
    try {
      await executarAcao(chamadoId, acao, { ...op.usuario, nome: op.nome || op.usuario.nome });
      toast.success(acao === "liberar" ? "Obrigado! Chamado encerrado." : "Manutenção avisada: o chamado voltou para atendimento.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setExecutando(null);
    }
  }

  return (
    <main id="conteudo" className="mx-auto grid w-full max-w-lg content-start gap-5 p-4">
      <header className="grid gap-1.5 rounded-2xl bg-moura-azul p-5 text-white shadow-md">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-sm">{chamado.numero}</span>
          <SeloCondicao chamado={chamado} />
        </div>
        <h1 className="text-3xl leading-tight font-bold">
          {chamado.maquinaNome} <span className="text-moura-amarelo">· {chamado.subdivisaoNome}</span>
        </h1>
        <p className="text-white/90">{chamado.erroNome}</p>
        {chamado.descricaoLivre && <p className="text-sm text-white/70 italic">“{chamado.descricaoLivre}”</p>}
      </header>

      <Mensagem chamado={chamado} posicao={posicao} agora={agora} config={config} />

      {chamado.status === "aguardando_liberacao" && (
        <Card className="border-2 border-green-600 shadow-md">
          <CardContent className="grid gap-3">
            <p className="text-lg font-semibold">
              {chamado.responsavel?.nome ?? "A manutenção"} concluiu o atendimento. A máquina voltou a produzir?
            </p>
            <Button className="h-16 rounded-xl bg-green-600 text-lg text-white hover:bg-green-700" disabled={executando !== null} onClick={() => agir("liberar")}>
              {executando === "liberar" ? "Enviando…" : "Máquina liberada, voltou a produzir"}
            </Button>
            <Button variant="outline" className="h-14 rounded-xl text-base" disabled={executando !== null} onClick={() => agir("reabrir")}>
              {executando === "reabrir" ? "Enviando…" : "Não resolveu"}
            </Button>
          </CardContent>
        </Card>
      )}

      <FotoChamado chamado={chamado} grande />
      <LinhaDoTempo chamado={chamado} agora={agora} />

      <Button asChild variant="outline" className="h-12 rounded-xl text-base">
        <Link href={`/c/${chamado.maquinaId}`}>
          <PlusIcon /> Abrir outro chamado nesta máquina
        </Link>
      </Button>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Outros chamados em aberto</h2>
        <ChamadosEmAberto chamados={fila.chamados.filter((c) => c.id !== chamado.id)} />
      </section>
    </main>
  );
}

function Mensagem({
  chamado: c,
  posicao,
  agora,
  config,
}: {
  chamado: Chamado;
  posicao: number;
  agora: number;
  config: ConfigPriorizacao;
}) {
  const p = prioridadeAtual(c, agora, config);
  const espera = <Cronometro desdeMs={c.marcos.abertura} agora={agora} situacao={estourouMeta(c, agora, config)} />;

  switch (c.status) {
    case "aberto":
      return (
        <Alert className={cn(AVISO, "border-l-moura-amarelo")}>
          <AlertTitle className="flex flex-wrap items-center gap-2 text-lg">
            Aguardando a manutenção{posicao > 0 && ` · ${posicao}º na fila`} · <BadgePrioridade classe={p.classe} />
          </AlertTitle>
          <AlertDescription className="text-base">Aberto há {espera}, ainda sem receber.</AlertDescription>
        </Alert>
      );
    case "recebido":
      return (
        <Alert className={cn(AVISO, "border-l-moura-azul-claro")}>
          <AlertTitle className="text-lg">
            {c.responsavel?.nome} recebeu seu chamado às {formatarHora(c.marcos.recebido)}
          </AlertTitle>
          <AlertDescription className="text-base">A caminho da máquina. Aberto há {espera}.</AlertDescription>
        </Alert>
      );
    case "em_atendimento":
      return (
        <Alert className={cn(AVISO, "border-l-moura-azul")}>
          <AlertTitle className="text-lg">{c.responsavel?.nome} está atendendo</AlertTitle>
          <AlertDescription className="text-base">
            Início às {formatarHora(c.marcos.inicio)} · {c.marcos.inicio && formatarMinutos((agora - c.marcos.inicio) / 60_000)} em atuação
          </AlertDescription>
        </Alert>
      );
    case "pausado":
      return (
        <Alert className={cn(AVISO, "border-l-moura-laranja")}>
          <AlertTitle className="text-lg">Atendimento pausado</AlertTitle>
          <AlertDescription className="text-base">
            {c.pausas.at(-1)?.motivo} · {c.responsavel?.nome}
          </AlertDescription>
        </Alert>
      );
    case "encerrado":
      return (
        <Alert className={cn(AVISO, "border-l-green-600")}>
          <AlertTitle className="text-lg">Chamado encerrado</AlertTitle>
          <AlertDescription className="text-base">Máquina liberada às {formatarHora(c.marcos.liberado)}.</AlertDescription>
        </Alert>
      );
    case "cancelado":
      return (
        <Alert variant="destructive" className={cn(AVISO, "border-l-destructive")}>
          <AlertTitle className="text-lg">Chamado cancelado</AlertTitle>
          <AlertDescription className="text-base">{c.cancelamento?.motivo}</AlertDescription>
        </Alert>
      );
    default:
      return null;
  }
}

