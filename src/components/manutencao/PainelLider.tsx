"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useEquipe } from "@/hooks/useMantenedores";
import { CLASSES, MIN_JUSTIFICATIVA, type Acao, type DadosAcao } from "@/lib/estados";
import type { Classe } from "@/lib/tipos";

/** Funções do líder: atribuir, alterar prioridade (com justificativa) e cancelar. */
export function PainelLider({
  acoes,
  ocupado,
  aoAgir,
}: {
  acoes: Acao[];
  ocupado: boolean;
  aoAgir: (acao: Acao, dados: DadosAcao) => Promise<boolean>;
}) {
  const equipe = useEquipe();
  const [mantenedor, setMantenedor] = useState("");
  const [classe, setClasse] = useState<Classe | "">("");
  const [justificativa, setJustificativa] = useState("");
  const [motivo, setMotivo] = useState("");

  if (!acoes.some((a) => ["atribuir", "priorizar", "cancelar"].includes(a))) return null;
  const escolhido = equipe.find((p) => p.uid === mantenedor);

  return (
    <Card className="border-t-4 border-t-moura-azul">
      <CardHeader>
        <CardTitle className="text-xl text-moura-azul">Painel do líder</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {acoes.includes("atribuir") && (
          <div className="grid gap-1.5">
            <Label>Atribuir a…</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={mantenedor} onValueChange={setMantenedor}>
                <SelectTrigger className="w-full sm:flex-1">
                  <SelectValue placeholder="Mantenedor" />
                </SelectTrigger>
                <SelectContent>
                  {equipe.map((p) => (
                    <SelectItem key={p.uid} value={p.uid}>
                      {p.nome} · {p.papel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!escolhido || ocupado}
                onClick={() => escolhido && aoAgir("atribuir", { mantenedor: { uid: escolhido.uid, nome: escolhido.nome } })}
              >
                Atribuir
              </Button>
            </div>
          </div>
        )}

        {acoes.includes("priorizar") && (
          <>
            <Separator />
            <div className="grid gap-1.5">
              <Label>Alterar prioridade</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={classe} onValueChange={(v) => setClasse(v as Classe)}>
                  <SelectTrigger className="w-full sm:w-24">
                    <SelectValue placeholder="Classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder={`Justificativa (mín. ${MIN_JUSTIFICATIVA} caracteres)`}
                  aria-label="Justificativa"
                />
              </div>
              <Button
                variant="outline"
                disabled={!classe || justificativa.trim().length < MIN_JUSTIFICATIVA || ocupado}
                onClick={async () => {
                  if (classe && (await aoAgir("priorizar", { classe, justificativa }))) setJustificativa("");
                }}
              >
                ✎ Registrar override
              </Button>
            </div>
          </>
        )}

        {acoes.includes("cancelar") && (
          <>
            <Separator />
            <div className="grid gap-1.5">
              <Label htmlFor="motivo-cancelamento">Cancelar chamado</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="motivo-cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ex.: aberto por engano)" />
                <Button variant="destructive" disabled={!motivo.trim() || ocupado} onClick={() => aoAgir("cancelar", { motivo })}>
                  Cancelar
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
