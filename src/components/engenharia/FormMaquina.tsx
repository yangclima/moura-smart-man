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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { salvarMaquina } from "@/lib/catalogo";
import { mensagemDeErro } from "@/lib/chamados";
import { IMPACTO_ROTULO, type Impacto, type Maquina } from "@/lib/tipos";

/** Diálogo de cadastro/edição de máquina. Sem `maquina`, cria uma nova. */
export function FormMaquina({ maquina, gatilho }: { maquina?: Maquina; gatilho: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState(maquina?.nome ?? "");
  const [tag, setTag] = useState(maquina?.tag ?? "");
  const [linha, setLinha] = useState(maquina?.linha ?? "");
  const [impacto, setImpacto] = useState<Impacto>(maquina?.impacto ?? "sem_redundancia");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !tag.trim()) return;
    setSalvando(true);
    try {
      await salvarMaquina({ nome, tag, linha, impacto }, maquina?.id);
      toast.success(maquina ? "Máquina atualizada" : "Máquina criada");
      setAberto(false);
      if (!maquina) {
        setNome("");
        setTag("");
        setLinha("");
      }
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
            <DialogTitle>{maquina ? "Editar máquina" : "Nova máquina"}</DialogTitle>
            <DialogDescription>
              O impacto define o critério C2 da priorização (gargalo 1,0 · sem redundância 0,7 · com
              redundância 0,4).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="maq-nome">Nome</Label>
            <Input id="maq-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Máquina E" required disabled={Boolean(maquina)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="maq-tag">TAG (localização técnica SAP)</Label>
            <Input id="maq-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="9001.FABX.CEL05.MAQE" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="maq-linha">Linha / célula</Label>
            <Input id="maq-linha" value={linha} onChange={(e) => setLinha(e.target.value)} placeholder="CEL05" />
          </div>
          <div className="grid gap-1.5">
            <Label>Impacto na produção</Label>
            <Select value={impacto} onValueChange={(v) => setImpacto(v as Impacto)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(IMPACTO_ROTULO) as Impacto[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {IMPACTO_ROTULO[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
