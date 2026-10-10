"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MOTIVOS = ["Aguardando peça", "Aguardando terceiro", "Aguardando liberação da produção", "Outro"];

export function FormPausa({ desabilitado, aoPausar }: { desabilitado: boolean; aoPausar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="flex gap-2">
      <Select value={motivo} onValueChange={setMotivo}>
        <SelectTrigger className="h-12 flex-1" aria-label="Motivo da pausa">
          <SelectValue placeholder="Motivo da pausa…" />
        </SelectTrigger>
        <SelectContent>
          {MOTIVOS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" className="h-12" disabled={!motivo || desabilitado} onClick={() => aoPausar(motivo)}>
        Pausar
      </Button>
    </div>
  );
}
