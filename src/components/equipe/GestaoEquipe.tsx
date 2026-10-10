"use client";

import { KeyRoundIcon, PlusIcon, PowerIcon, RotateCcwIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUsuario } from "@/hooks/useUsuario";
import { contarPorPapel, FILTRO_EQUIPE_PADRAO, filtrarPessoas, iniciais, type FiltroEquipe, type Pessoa } from "@/lib/equipe";
import { chamarApiEquipe, ROTULO_PAPEL } from "@/lib/perfis";
import type { Papel } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { DialogNovaPessoa } from "./DialogNovaPessoa";
import { DialogPin } from "./DialogPin";
import { FiltrosEquipe } from "./FiltrosEquipe";

const PAPEIS = Object.keys(ROTULO_PAPEL) as Papel[];

const COR_PAPEL: Record<Papel, string> = {
  engenharia: "bg-moura-azul text-white",
  lider: "bg-moura-azul-claro text-white",
  mantenedor: "bg-moura-amarelo text-moura-marinho",
  operador: "bg-muted text-foreground",
  oficina: "bg-moura-marinho text-white",
};

/** Cadastro de pessoas com PIN: criar, gerar novo PIN, desativar/reativar. */
export function GestaoEquipe() {
  const { usuario } = useUsuario();
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroEquipe>(FILTRO_EQUIPE_PADRAO);
  const [ocupado, setOcupado] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const [pinMostrado, setPinMostrado] = useState<{ nome: string; pin: string } | null>(null);
  const [desativando, setDesativando] = useState<Pessoa | null>(null);

  // Incrementar a versão refaz a busca (depois de criar, trocar PIN ou desativar).
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let ativo = true;
    chamarApiEquipe<{ pessoas: Pessoa[] }>("GET")
      .then((r) => ativo && setPessoas(r.pessoas))
      .catch((e: Error) => {
        if (!ativo) return;
        toast.error(e.message);
        setPessoas([]);
      });
    return () => {
      ativo = false;
    };
  }, [versao]);

  async function executar(acao: () => Promise<void>): Promise<boolean> {
    setOcupado(true);
    try {
      await acao();
      recarregar();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const criar = (nome: string, papel: Papel) =>
    executar(async () => {
      const r = await chamarApiEquipe<{ pessoa: Pessoa; pin: string }>("POST", { nome, papel });
      setNovaAberta(false);
      setPinMostrado({ nome: r.pessoa.nome, pin: r.pin });
    });

  const novoPin = (p: Pessoa) =>
    executar(async () => {
      const r = await chamarApiEquipe<{ pin: string }>("PATCH", { id: p.id, acao: "novo_pin" });
      setPinMostrado({ nome: p.nome, pin: r.pin });
    });

  const alternar = (p: Pessoa) =>
    executar(async () => {
      await chamarApiEquipe("PATCH", { id: p.id, acao: p.ativo ? "desativar" : "ativar" });
      setDesativando(null);
      toast.success(p.ativo ? `${p.nome} não consegue mais entrar` : `${p.nome} reativado(a)`);
    });

  if (!pessoas) return <Carregando />;

  const visiveis = filtrarPessoas(pessoas, filtro);
  const ativos = pessoas.filter((p) => p.ativo).length;
  const filtrando = filtro.busca !== "" || filtro.papel !== null || filtro.situacao !== FILTRO_EQUIPE_PADRAO.situacao;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid max-w-2xl gap-1">
          <h1 className="text-3xl font-bold text-moura-azul">Acessos da equipe</h1>
          <p className="text-sm text-muted-foreground">
            Cada pessoa entra só com um PIN de 6 dígitos, que aparece uma única vez ao cadastrar ou gerar um novo.
            Operadores não precisam de PIN: entram pelo QR Code da máquina.
          </p>
        </div>
        <Button className="sm:ml-auto" onClick={() => setNovaAberta(true)}>
          <PlusIcon /> Novo acesso
        </Button>
      </div>

      <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <FiltrosEquipe filtro={filtro} onFiltro={setFiltro} papeis={PAPEIS} contagem={contarPorPapel(pessoas, filtro)} />

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {visiveis.length} de {pessoas.length} pessoa(s) · {ativos} ativa(s)
          </span>
          {filtrando && (
            <Button variant="ghost" size="sm" onClick={() => setFiltro(FILTRO_EQUIPE_PADRAO)}>
              Limpar filtros
            </Button>
          )}
        </div>

        {visiveis.length === 0 ? (
          <div className="grid justify-items-center gap-2 py-10 text-center text-muted-foreground">
            <UsersIcon className="size-8" aria-hidden />
            <p>{pessoas.length === 0 ? "Ninguém cadastrado ainda." : "Ninguém com esses filtros."}</p>
            {pessoas.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => setNovaAberta(true)}>
                <PlusIcon /> Cadastrar a primeira pessoa
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {visiveis.map((p) => {
              const souEu = p.id === usuario?.uid;
              return (
                <li key={p.id} className={cn("flex flex-wrap items-center gap-3 p-3", !p.ativo && "bg-muted/40")}>
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold",
                      p.ativo ? COR_PAPEL[p.papel] : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {iniciais(p.nome)}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className={cn("truncate font-medium", !p.ativo && "text-muted-foreground line-through")}>
                      {p.nome}
                      {souEu && <span className="ml-2 text-xs font-normal text-muted-foreground no-underline">(você)</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {ROTULO_PAPEL[p.papel]}
                      {!p.ativo && <Badge variant="secondary">desativado</Badge>}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {p.ativo ? (
                      <>
                        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => novoPin(p)}>
                          <KeyRoundIcon /> Novo PIN
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={ocupado || souEu}
                          title={souEu ? "Você não pode desativar o próprio acesso" : undefined}
                          onClick={() => setDesativando(p)}
                        >
                          <PowerIcon /> Desativar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => alternar(p)}>
                        <RotateCcwIcon /> Reativar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DialogNovaPessoa aberto={novaAberta} onAberto={setNovaAberta} papeis={PAPEIS} ocupado={ocupado} onCriar={criar} />
      <DialogPin pin={pinMostrado} onFechar={() => setPinMostrado(null)} />

      <Dialog open={desativando !== null} onOpenChange={(aberto) => !aberto && setDesativando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar {desativando?.nome}?</DialogTitle>
            <DialogDescription>
              O PIN deixa de funcionar na hora. Dá para reativar depois, e o histórico de chamados é mantido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDesativando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={ocupado} onClick={() => desativando && alternar(desativando)}>
              Desativar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
