"use client";

import { KeyRoundIcon, PlusIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUsuario } from "@/hooks/useUsuario";
import { chamarApiEquipe, ROTULO_PAPEL } from "@/lib/perfis";
import type { Papel } from "@/lib/tipos";

interface Pessoa {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

const PAPEIS = Object.keys(ROTULO_PAPEL) as Papel[];

/** Cadastro de pessoas com PIN: criar, gerar novo PIN, desativar/reativar. */
export function GestaoEquipe() {
  const { usuario } = useUsuario();
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Papel>("mantenedor");
  const [ocupado, setOcupado] = useState(false);
  const [pinMostrado, setPinMostrado] = useState<{ nome: string; pin: string } | null>(null);

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

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    try {
      await acao();
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setOcupado(false);
    }
  }

  function criar(e: FormEvent) {
    e.preventDefault();
    void executar(async () => {
      const r = await chamarApiEquipe<{ pessoa: Pessoa; pin: string }>("POST", { nome, papel });
      setPinMostrado({ nome: r.pessoa.nome, pin: r.pin });
      setNome("");
    });
  }

  const novoPin = (p: Pessoa) =>
    executar(async () => {
      const r = await chamarApiEquipe<{ pin: string }>("PATCH", { id: p.id, acao: "novo_pin" });
      setPinMostrado({ nome: p.nome, pin: r.pin });
    });

  const alternar = (p: Pessoa) =>
    executar(async () => {
      await chamarApiEquipe("PATCH", { id: p.id, acao: p.ativo ? "desativar" : "ativar" });
      toast.success(p.ativo ? `${p.nome} desativado(a)` : `${p.nome} reativado(a)`);
    });

  if (!pessoas) return <Carregando />;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold text-moura-azul">Acessos da equipe</h1>
        <p className="text-sm text-muted-foreground">
          Cada pessoa entra só com um PIN de 6 dígitos. O PIN aparece uma única vez, ao criar ou gerar um novo:
          anote e entregue à pessoa. Operadores não precisam de PIN (entram pelo QR Code).
        </p>
      </div>

      <form onSubmit={criar} className="flex flex-wrap items-end gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="w-56" required minLength={2} maxLength={60} aria-label="Nome" />
        <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
          <SelectTrigger className="w-44" aria-label="Perfil">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPEIS.map((p) => (
              <SelectItem key={p} value={p}>
                {ROTULO_PAPEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={ocupado}>
          <PlusIcon /> Cadastrar e gerar PIN
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pessoas.map((p) => (
            <TableRow key={p.id} className={p.ativo ? "" : "opacity-50"}>
              <TableCell className="font-medium">{p.nome}</TableCell>
              <TableCell>{ROTULO_PAPEL[p.papel]}</TableCell>
              <TableCell>{p.ativo ? <Badge variant="outline">ativo</Badge> : <Badge variant="secondary">desativado</Badge>}</TableCell>
              <TableCell className="space-x-1 text-right">
                <Button size="sm" variant="outline" disabled={ocupado || !p.ativo} onClick={() => novoPin(p)}>
                  <KeyRoundIcon /> Novo PIN
                </Button>
                <Button size="sm" variant="ghost" disabled={ocupado || p.id === usuario?.uid} onClick={() => alternar(p)}>
                  {p.ativo ? "Desativar" : "Reativar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={pinMostrado !== null} onOpenChange={(aberto) => !aberto && setPinMostrado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN de {pinMostrado?.nome}</DialogTitle>
            <DialogDescription>Anote agora: por segurança, ele não será mostrado de novo.</DialogDescription>
          </DialogHeader>
          <p className="text-center font-mono text-5xl font-bold tracking-[0.3em]">{pinMostrado?.pin}</p>
          <Button onClick={() => setPinMostrado(null)}>Já anotei</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
