"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Conclusao } from "@/lib/tipos";

const MODOS_FALHA = ["Desgaste", "Quebra", "Desajuste", "Sujeira / contaminação", "Falha elétrica", "Falha de lubrificação", "Outro"];
const ACOES = ["Substituído", "Ajustado", "Limpo", "Reapertado", "Lubrificado", "Reparado", "Outro"];
const OUTRO_COMPONENTE = "Outro / não listado";

function Escolha({ id, rotulo, valor, opcoes, aoMudar }: { id: string; rotulo: string; valor: string; opcoes: string[]; aoMudar: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select value={valor} onValueChange={aoMudar}>
        <SelectTrigger id={id} className="h-12 w-full">
          <SelectValue placeholder="Escolha…" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Fechamento estruturado: alimenta a padronização dos registros (Subproduto 3). */
export function SheetConcluir({
  componentes,
  desabilitado,
  aoConcluir,
}: {
  componentes: string[];
  desabilitado: boolean;
  aoConcluir: (c: Conclusao) => Promise<boolean>;
}) {
  const [aberto, setAberto] = useState(false);
  const [componente, setComponente] = useState("");
  const [modoFalha, setModoFalha] = useState("");
  const [acao, setAcao] = useState("");
  const [pecas, setPecas] = useState("");
  const [obs, setObs] = useState("");
  const completo = Boolean(componente && modoFalha && acao);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!completo) return;
    const ok = await aoConcluir({ componente, modoFalha, acao, pecas: pecas.trim(), obs: obs.trim() });
    if (ok) setAberto(false);
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button className="h-14 text-lg" disabled={desabilitado}>
          Concluir
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={enviar} className="mx-auto grid w-full max-w-lg gap-4 p-4">
          <SheetHeader className="p-0">
            <SheetTitle>Concluir atendimento</SheetTitle>
            <SheetDescription>Depois disso, o operador confirma se a máquina voltou a produzir.</SheetDescription>
          </SheetHeader>
          <Escolha id="componente" rotulo="Componente" valor={componente} opcoes={[...componentes, OUTRO_COMPONENTE]} aoMudar={setComponente} />
          <Escolha id="modo" rotulo="Modo de falha" valor={modoFalha} opcoes={MODOS_FALHA} aoMudar={setModoFalha} />
          <Escolha id="acao" rotulo="Ação realizada" valor={acao} opcoes={ACOES} aoMudar={setAcao} />
          <div className="grid gap-1.5">
            <Label htmlFor="pecas">Peças utilizadas</Label>
            <Input id="pecas" value={pecas} maxLength={120} onChange={(e) => setPecas(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="obs">Observação (opcional)</Label>
            <Textarea id="obs" value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} />
          </div>
          <SheetFooter className="p-0">
            <Button type="submit" className="h-12" disabled={!completo || desabilitado}>
              Concluir e pedir liberação
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
