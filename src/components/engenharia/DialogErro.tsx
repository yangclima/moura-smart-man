"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { criarErro, type DadosErro } from "@/lib/catalogo";
import { mensagemDeErro } from "@/lib/chamados";
import type { ErroCatalogo, Subdivisao } from "@/lib/tipos";

const MAX_NOME = 60;

export function DialogErro({
  subdivisao,
  ordem,
  origem = "engenharia",
  inicial,
  gatilho,
  aoCriar,
}: {
  subdivisao: Subdivisao;
  ordem: number;
  origem?: ErroCatalogo["origem"];
  inicial?: Partial<DadosErro>;
  gatilho: ReactNode;
  aoCriar?: (erroId: string) => void | Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [risco, setRisco] = useState(inicial?.riscoPessoas ?? false);
  const [qualidade, setQualidade] = useState(inicial?.impactoQualidade ?? false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const id = await criarErro(
        subdivisao,
        { nome, riscoPessoas: risco, impactoQualidade: qualidade },
        ordem,
        origem,
      );
      await aoCriar?.(id);
      toast.success("Erro adicionado ao catálogo");
      setAberto(false);
      setNome("");
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <form onSubmit={salvar} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Novo erro · {subdivisao.nome}</DialogTitle>
            <DialogDescription>
              Use o termo que o operador reconhece no chão de fábrica. Os padrões abaixo podem ser
              alterados pelo operador ao abrir o chamado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="erro-nome">Nome do erro</Label>
            <Input
              id="erro-nome"
              value={nome}
              maxLength={MAX_NOME}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Rolo patinando"
              required
            />
          </div>
          <label className="flex items-center justify-between gap-4">
            <span>⚠ Risco a pessoas (vira P0)</span>
            <Switch checked={risco} onCheckedChange={setRisco} />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>◆ Impacto na qualidade</span>
            <Switch checked={qualidade} onCheckedChange={setQualidade} />
          </label>
          <DialogFooter>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
