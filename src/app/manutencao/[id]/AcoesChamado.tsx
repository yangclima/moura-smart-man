"use client";

import { ArrowLeftIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { EstadoTela } from "@/components/EstadoTela";
import { SeloCondicao } from "@/components/chamado/CartaoChamado";
import { Cronometro } from "@/components/chamado/Cronometro";
import { ExplicacaoPrioridade } from "@/components/chamado/ExplicacaoPrioridade";
import { FotoChamado } from "@/components/chamado/FotoChamado";
import { LinhaDoTempo } from "@/components/chamado/LinhaDoTempo";
import { FormPausa } from "@/components/manutencao/FormPausa";
import { PainelLider } from "@/components/manutencao/PainelLider";
import { SheetConcluir } from "@/components/manutencao/SheetConcluir";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgora } from "@/hooks/useAgora";
import { useSubdivisao } from "@/hooks/useCatalogo";
import { useChamado } from "@/hooks/useChamado";
import { useConfig } from "@/hooks/useConfig";
import { useUsuario } from "@/hooks/useUsuario";
import { executarAcao, mensagemDeErro } from "@/lib/chamados";
import { acoesDisponiveis, type Acao, type DadosAcao } from "@/lib/estados";
import { estourouMeta } from "@/lib/prioridade";
import { formatarHora } from "@/lib/tempo";
import { STATUS_ROTULO } from "@/lib/tipos";

const BOTAO_PRINCIPAL: Partial<Record<Acao, string>> = {
  receber: "Receber",
  iniciar: "Iniciar atendimento (cheguei na máquina)",
  retomar: "Retomar",
};

export function AcoesChamado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { usuario } = useUsuario();
  const agora = useAgora();
  const config = useConfig();
  const { dado: c, carregando } = useChamado(id);
  const sub = useSubdivisao(c?.subdivisaoId ?? null);
  const [ocupado, setOcupado] = useState(false);

  if (carregando || !usuario) return <Carregando />;
  if (!c) {
    return (
      <EstadoTela
        icone={SearchXIcon}
        titulo="Chamado não encontrado"
        acoes={
          <Button asChild className="h-11 px-4">
            <Link href="/manutencao">
              <ArrowLeftIcon /> Voltar para a fila
            </Link>
          </Button>
        }
      >
        O chamado pode ter sido cancelado ou o link está incompleto.
      </EstadoTela>
    );
  }
  const chamadoId = c.id;
  const acoes = acoesDisponiveis(c, usuario);

  async function agir(acao: Acao, dados: DadosAcao = {}): Promise<boolean> {
    if (!usuario) return false;
    setOcupado(true);
    try {
      await executarAcao(chamadoId, acao, usuario, dados);
      toast.success("Registrado");
      return true;
    } catch (e) {
      toast.error(mensagemDeErro(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const principal = acoes.find((a) => a in BOTAO_PRINCIPAL);

  return (
    <div className="grid gap-5">
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/manutencao">
          <ArrowLeftIcon /> Fila
        </Link>
      </Button>

      <header className="grid gap-1.5 rounded-2xl border border-l-8 border-l-moura-azul bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-muted-foreground">{c.numero}</span>
          <Badge variant="outline">{STATUS_ROTULO[c.status]}</Badge>
          <SeloCondicao chamado={c} />
          {c.riscoPessoas && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-600">
              <TriangleAlertIcon className="size-4" aria-hidden /> Risco a pessoas
            </span>
          )}
        </div>
        <h1 className="text-3xl leading-tight font-bold text-moura-azul">
          {c.maquinaNome} <span className="text-foreground/70">· {c.subdivisaoNome}</span>
        </h1>
        <p className="text-lg">{c.erroNome}</p>
        {c.descricaoLivre && <p className="text-muted-foreground">“{c.descricaoLivre}”</p>}
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Aberto às {formatarHora(c.marcos.abertura)} por {c.solicitante.nome} ·
          <Cronometro desdeMs={c.marcos.abertura} agora={agora} situacao={estourouMeta(c, agora, config)} />
          {c.responsavel && <> · com {c.responsavel.nome}</>}
        </p>
      </header>

      <ExplicacaoPrioridade chamado={c} agora={agora} config={config} />
      <FotoChamado chamado={c} grande />

      {acoes.some((a) => ["receber", "iniciar", "retomar", "concluir", "devolver", "pausar"].includes(a)) && (
        <Card className="border-moura-amarelo/60 shadow-md">
          <CardContent className="grid gap-3">
            {principal && (
              <Button variant="destaque" className="h-16 rounded-xl text-lg whitespace-normal" disabled={ocupado} onClick={() => agir(principal)}>
                {BOTAO_PRINCIPAL[principal]}
              </Button>
            )}
            {acoes.includes("concluir") && (
              <SheetConcluir
                componentes={sub?.componentes ?? []}
                desabilitado={ocupado}
                aoConcluir={(conclusao) => agir("concluir", { conclusao })}
              />
            )}
            {acoes.includes("pausar") && <FormPausa desabilitado={ocupado} aoPausar={(motivo) => agir("pausar", { motivo })} />}
            {acoes.includes("devolver") && (
              <Button variant="ghost" disabled={ocupado} onClick={() => agir("devolver")}>
                Devolver para a fila
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {c.conclusao && (
        <Card>
          <CardContent className="grid gap-1 text-sm">
            <b>Conclusão</b>
            <span>
              {c.conclusao.componente} · {c.conclusao.modoFalha} · {c.conclusao.acao}
            </span>
            {c.conclusao.pecas && <span>Peças: {c.conclusao.pecas}</span>}
            {c.conclusao.obs && <span className="text-muted-foreground">{c.conclusao.obs}</span>}
          </CardContent>
        </Card>
      )}

      {usuario.papel === "lider" && <PainelLider acoes={acoes} ocupado={ocupado} aoAgir={agir} />}

      <LinhaDoTempo chamado={c} agora={agora} />
    </div>
  );
}
