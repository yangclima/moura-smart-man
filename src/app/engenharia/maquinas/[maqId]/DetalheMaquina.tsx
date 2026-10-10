"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { use, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { BaixarQR } from "@/components/engenharia/BaixarQR";
import { FormMaquina } from "@/components/engenharia/FormMaquina";
import { ListaErros } from "@/components/engenharia/ListaErros";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useErros, useMaquina, useSubdivisoes } from "@/hooks/useCatalogo";
import {
  alternarMaquinaAtiva,
  atualizarComponentes,
  criarSubdivisao,
  porOrdem,
} from "@/lib/catalogo";
import { mensagemDeErro } from "@/lib/chamados";
import { IMPACTO_ROTULO, type Subdivisao } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const separarLista = (texto: string) =>
  texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function DetalheMaquina({ params }: { params: Promise<{ maqId: string }> }) {
  const { maqId: bruto } = use(params);
  const maqId = decodeURIComponent(bruto);
  const { dado: maquina, carregando } = useMaquina(maqId);
  const subs = useSubdivisoes(maqId);
  const erros = useErros(maqId);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  if (carregando) return <Carregando />;
  if (!maquina) return <p className="text-destructive">Máquina “{maqId}” não encontrada.</p>;

  const listaSubs = [...subs.dados].sort(porOrdem);
  const sub = listaSubs.find((s) => s.id === selecionada) ?? listaSubs[0];
  const errosSub = erros.dados.filter((e) => e.subdivisaoId === sub?.id).sort(porOrdem);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start gap-4">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-moura-azul">
            {maquina.nome}
            {!maquina.ativo && <Badge variant="secondary">inativa</Badge>}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">{maquina.tag}</p>
          <p className="text-sm">
            {maquina.linha && `${maquina.linha} · `}
            {IMPACTO_ROTULO[maquina.impacto]} (C2 = {maquina.impactoValor.toFixed(1)})
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            Ativa
            <Switch
              checked={maquina.ativo}
              onCheckedChange={() => alternarMaquinaAtiva(maquina).catch((e) => toast.error(mensagemDeErro(e)))}
            />
          </label>
          <FormMaquina
            maquina={maquina}
            gatilho={
              <Button variant="outline">
                <PencilIcon /> Editar
              </Button>
            }
          />
          <BaixarQR maquina={maquina} />
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <aside className="grid content-start gap-1">
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground uppercase">Subdivisões</h2>
          {listaSubs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelecionada(s.id)}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                s.id === sub?.id && "bg-muted font-semibold",
              )}
            >
              <span>{s.nome}</span>
              <span className="text-xs text-muted-foreground tabular-nums" title="Criticidade histórica (C4)">
                {s.critHist.toFixed(2)}
              </span>
            </button>
          ))}
          <NovaSubdivisao maquinaId={maquina.id} ordem={listaSubs.length} />
        </aside>

        <section className="grid content-start gap-4">
          {sub ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-xl font-semibold">{sub.nome}</h2>
                <span className="text-sm text-muted-foreground">
                  criticidade histórica (C4): {sub.critHist.toFixed(2)}
                </span>
              </div>
              <Componentes key={sub.id} subdivisao={sub} />
              <ListaErros subdivisao={sub} erros={errosSub} />
            </>
          ) : (
            <p className="text-muted-foreground">Cadastre uma subdivisão para montar o catálogo de erros.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function NovaSubdivisao({ maquinaId, ordem }: { maquinaId: string; ordem: number }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await criarSubdivisao(maquinaId, nome, ordem, []);
      setNome("");
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={criar} className="mt-2 flex gap-1">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova subdivisão" aria-label="Nova subdivisão" />
      <Button type="submit" size="icon" variant="outline" disabled={salvando} aria-label="Adicionar subdivisão">
        <PlusIcon />
      </Button>
    </form>
  );
}

/** Componentes da subdivisão: alimentam o campo "componente" na conclusão do chamado. */
function Componentes({ subdivisao }: { subdivisao: Subdivisao }) {
  const [texto, setTexto] = useState((subdivisao.componentes ?? []).join(", "));
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await atualizarComponentes(subdivisao.id, separarLista(texto));
      toast.success("Componentes salvos");
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-1.5">
      <Label htmlFor="componentes">Componentes (separados por vírgula)</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="componentes" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Button type="submit" variant="outline" disabled={salvando}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
