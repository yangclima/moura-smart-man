"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ROTULO_PAPEL } from "@/lib/perfis";
import type { Papel } from "@/lib/tipos";

/** O que cada perfil faz no app, para quem cadastra escolher sem dúvida. */
export const DESCRICAO_PAPEL: Record<Papel, string> = {
  mantenedor: "Recebe e atende os chamados da manutenção.",
  lider: "Organiza a fila da manutenção e gerencia os acessos da equipe.",
  engenharia: "Cadastra máquinas, QR Codes e acessos; revisa chamados.",
  oficina: "Só exibe a TV da oficina, sem poder alterar nada.",
  operador: "Abre chamados. Normalmente entra pelo QR Code, sem PIN.",
};

interface DialogNovaPessoaProps {
  aberto: boolean;
  onAberto: (aberto: boolean) => void;
  papeis: Papel[];
  ocupado: boolean;
  onCriar: (nome: string, papel: Papel) => Promise<boolean>;
}

export function DialogNovaPessoa({ aberto, onAberto, papeis, ocupado, onCriar }: DialogNovaPessoaProps) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Papel>("mantenedor");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (await onCriar(nome.trim(), papel)) {
      setNome("");
      setPapel("mantenedor");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent>
        <form onSubmit={enviar} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Novo acesso</DialogTitle>
            <DialogDescription>O PIN de 6 dígitos é gerado na hora e aparece uma única vez.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="nome-pessoa">Nome</Label>
            <Input
              id="nome-pessoa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria Souza"
              required
              minLength={2}
              maxLength={60}
              autoFocus
              autoComplete="off"
            />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Perfil</legend>
            <RadioGroup value={papel} onValueChange={(v) => setPapel(v as Papel)} className="gap-1.5">
              {papeis.map((p) => (
                <Label
                  key={p}
                  htmlFor={`papel-${p}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-moura-azul-claro has-data-checked:bg-accent"
                >
                  <RadioGroupItem id={`papel-${p}`} value={p} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{ROTULO_PAPEL[p]}</span>
                    <span className="text-xs text-muted-foreground">{DESCRICAO_PAPEL[p]}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={ocupado || nome.trim().length < 2}>
              Cadastrar e gerar PIN
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
