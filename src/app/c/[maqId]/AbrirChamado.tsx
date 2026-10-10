"use client";

import { Loader2Icon, PencilIcon, SirenIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { Passo } from "@/components/operador/Passo";
import { PassoNome } from "@/components/operador/PassoNome";
import { SeletorFoto } from "@/components/operador/SeletorFoto";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useErros, useMaquina, useSubdivisoes } from "@/hooks/useCatalogo";
import { useConfig } from "@/hooks/useConfig";
import { useOperador } from "@/hooks/useOperador";
import { porOrdem } from "@/lib/catalogo";
import { abrirChamado, buscarDuplicado, mensagemDeErro } from "@/lib/chamados";
import { lembrarChamado } from "@/lib/local";
import { cn } from "@/lib/utils";
import type { Chamado, Condicao } from "@/lib/tipos";
import { DialogDuplicado } from "./DialogDuplicado";

const MAX_DESCRICAO = 140;
const OUTRO = "__outro__";
const OPCAO =
  "rounded-xl whitespace-normal shadow-xs hover:border-moura-azul/50 hover:bg-accent hover:text-moura-azul active:scale-[0.99]";

interface Props {
  params: Promise<{ maqId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export function AbrirChamado({ params, searchParams }: Props) {
  const maqId = decodeURIComponent(use(params).maqId);
  const subDoQr = use(searchParams).sub;
  const op = useOperador();
  const [editandoNome, setEditandoNome] = useState(false);

  if (op.erroLogin) {
    return <Tela><Alert variant="destructive"><AlertTitle>Não foi possível conectar</AlertTitle><AlertDescription>{op.erroLogin}</AlertDescription></Alert></Tela>;
  }
  if (!op.pronto) return <Carregando texto="Conectando…" />;
  if (!op.nome || editandoNome) {
    return (
      <Tela>
        <PassoNome
          inicial={op.nome}
          aoConfirmar={(n) => {
            op.confirmarNome(n);
            setEditandoNome(false);
          }}
        />
      </Tela>
    );
  }
  return (
    <Formulario
      maqId={maqId}
      subInicial={typeof subDoQr === "string" ? subDoQr : null}
      nome={op.nome}
      aoTrocarNome={() => setEditandoNome(true)}
    />
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid w-full max-w-lg content-start gap-7 p-4 pb-8">{children}</main>;
}

function Formulario({
  maqId,
  subInicial,
  nome,
  aoTrocarNome,
}: {
  maqId: string;
  subInicial: string | null;
  nome: string;
  aoTrocarNome: () => void;
}) {
  const router = useRouter();
  const config = useConfig();
  const { dado: maquina, carregando } = useMaquina(maqId);
  const subs = useSubdivisoes(maqId);
  const erros = useErros(maqId);

  const [subId, setSubId] = useState<string | null>(subInicial);
  const [erroId, setErroId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [condicao, setCondicao] = useState<Condicao | null>(null);
  const [risco, setRisco] = useState(false);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [duplicado, setDuplicado] = useState<Chamado | null>(null);

  if (carregando || subs.carregando) return <Carregando />;
  if (!maquina || !maquina.ativo) {
    return (
      <Tela>
        <Alert variant="destructive">
          <AlertTitle>Etiqueta inválida</AlertTitle>
          <AlertDescription>Avise a engenharia: a máquina “{maqId}” não está cadastrada ou está inativa.</AlertDescription>
        </Alert>
      </Tela>
    );
  }

  const listaSubs = [...subs.dados].sort(porOrdem);
  const sub = listaSubs.find((s) => s.id === subId) ?? null;
  const errosSub = erros.dados.filter((e) => e.subdivisaoId === sub?.id && e.ativo).sort(porOrdem);
  const erro = errosSub.find((e) => e.id === erroId) ?? null;
  const ehOutro = erroId === OUTRO;
  const erroOk = Boolean(erro) || (ehOutro && descricao.trim().length > 0);
  const podeEnviar = Boolean(sub && erroOk && condicao) && !enviando;

  function escolherErro(id: string) {
    setErroId(id);
    setRisco(errosSub.find((e) => e.id === id)?.riscoPessoas ?? false);
  }

  async function enviar(ignorarDuplicado = false) {
    if (!sub || !condicao || !maquina) return;
    setEnviando(true);
    try {
      if (!ignorarDuplicado) {
        const existente = await buscarDuplicado(maquina.id, sub.id);
        if (existente) {
          setDuplicado(existente);
          setEnviando(false);
          return;
        }
      }
      const id = await abrirChamado(
        { maquina, subdivisao: sub, erro, descricaoLivre: descricao, condicao, riscoPessoas: risco, foto, solicitanteNome: nome },
        config,
      );
      lembrarChamado(id);
      router.push(`/chamado/${id}`);
    } catch (e) {
      toast.error(`Não foi possível enviar: ${mensagemDeErro(e)}`);
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <header className="sticky top-0 z-10 -mx-4 -mt-4 border-b bg-background/95 px-4 pt-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Chamado para</p>
            <h1 className="truncate text-3xl leading-tight font-bold text-moura-azul">{maquina.nome}</h1>
            <p className="font-mono text-xs text-muted-foreground">{maquina.tag}</p>
          </div>
          <button
            type="button"
            onClick={aoTrocarNome}
            className="mt-1 inline-flex max-w-[45%] items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm shadow-xs transition-colors hover:border-moura-azul/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label={`Operador: ${nome}. Trocar nome`}
          >
            <span className="truncate font-medium">{nome}</span>
            <PencilIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </header>

      <Passo
        numero={1}
        titulo="Onde é o problema?"
        resumo={sub?.nome}
        aoTrocar={() => {
          setSubId(null);
          setErroId(null);
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {listaSubs.map((s) => (
            <Button key={s.id} variant="outline" className={OPCAO + " h-16 text-base"} onClick={() => setSubId(s.id)}>
              {s.nome}
            </Button>
          ))}
        </div>
      </Passo>

      {sub && (
        <Passo
          numero={2}
          titulo="Qual é o problema?"
          resumo={erro ? erro.nome : undefined}
          aoTrocar={() => setErroId(null)}
        >
          <div className="grid gap-2">
            {errosSub.map((e) => (
              <Button key={e.id} variant="outline" className={OPCAO + " h-auto min-h-14 justify-between py-3 text-left text-base"} onClick={() => escolherErro(e.id)}>
                <span>{e.nome}</span>
                <span className="flex gap-1 text-muted-foreground" aria-hidden>
                  {e.riscoPessoas && <TriangleAlertIcon className="size-4 text-red-600" />}
                  {e.impactoQualidade && <span className="text-moura-laranja">◆</span>}
                </span>
              </Button>
            ))}
            <Button variant={ehOutro ? "default" : "secondary"} className="h-14 rounded-xl text-base" onClick={() => escolherErro(OUTRO)}>
              Outro / não sei identificar
            </Button>
            {ehOutro && (
              <div className="grid gap-1">
                <Textarea
                  value={descricao}
                  maxLength={MAX_DESCRICAO}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva rapidamente o que está acontecendo"
                  className="min-h-24 rounded-xl text-base"
                  autoFocus
                />
                <span className="text-right text-xs text-muted-foreground">
                  {descricao.length}/{MAX_DESCRICAO}
                </span>
              </div>
            )}
          </div>
        </Passo>
      )}

      {sub && erroOk && (
        <Passo numero={3} titulo="Como está a máquina?">
          <ToggleGroup
            type="single"
            variant="outline"
            value={condicao ?? ""}
            onValueChange={(v) => setCondicao((v || null) as Condicao | null)}
            spacing={2}
            className="grid w-full grid-cols-2"
          >
            <ToggleGroupItem value="parada" className="h-20 rounded-xl text-base font-semibold data-[state=on]:border-red-600 data-[state=on]:bg-red-600 data-[state=on]:text-white">
              Parada
            </ToggleGroupItem>
            <ToggleGroupItem value="restricao" className="h-20 rounded-xl text-base font-semibold whitespace-normal data-[state=on]:border-moura-laranja data-[state=on]:bg-moura-amarelo data-[state=on]:text-moura-azul">
              Funcionando com problema
            </ToggleGroupItem>
          </ToggleGroup>
          <label className={cn("flex min-h-14 items-center justify-between gap-4 rounded-xl border bg-card p-3 pl-4 text-base transition-colors", risco && "border-red-600 bg-red-50 text-red-800")}>
            <span className="flex items-center gap-2 font-medium">
              <TriangleAlertIcon className={cn("size-5", risco ? "text-red-600" : "text-muted-foreground")} /> Há risco para pessoas
            </span>
            <Switch checked={risco} onCheckedChange={setRisco} />
          </label>
        </Passo>
      )}

      {sub && erroOk && condicao && (
        <Passo numero={4} titulo="Foto">
          <SeletorFoto foto={foto} aoMudar={setFoto} />
        </Passo>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-background via-background to-background/0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button variant="destaque" className="h-16 w-full rounded-2xl text-xl" disabled={!podeEnviar} onClick={() => enviar()}>
          {enviando ? <Loader2Icon className="size-5 animate-spin" /> : <SirenIcon className="size-6" />}
          {enviando ? "Enviando…" : "Chamar manutenção"}
        </Button>
      </div>

      <DialogDuplicado
        chamado={duplicado}
        aoAcompanhar={(c) => router.push(`/chamado/${c.id}`)}
        aoAbrirNovo={() => {
          setDuplicado(null);
          void enviar(true);
        }}
        aoFechar={() => setDuplicado(null)}
      />
    </Tela>
  );
}
