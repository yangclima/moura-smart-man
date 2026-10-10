"use client";

import { PrinterIcon } from "lucide-react";
import { useState } from "react";
import { Carregando } from "@/components/Carregando";
import { BaixarQR } from "@/components/engenharia/BaixarQR";
import { EtiquetaQR, urlDaMaquina } from "@/components/engenharia/EtiquetaQR";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMaquinas } from "@/hooks/useCatalogo";
import { APP_URL } from "@/lib/supabase";

export default function QrCodes() {
  const { dados, carregando } = useMaquinas();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const maquinas = dados.filter((m) => m.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const todas = maquinas.length > 0 && maquinas.every((m) => selecionadas.has(m.id));

  function alternar(id: string, marcado: boolean) {
    setSelecionadas((s) => {
      const nova = new Set(s);
      if (marcado) nova.add(id);
      else nova.delete(id);
      return nova;
    });
  }

  if (carregando) return <Carregando />;

  return (
    <div className="grid gap-6">
      <div className="nao-imprimir grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-moura-azul">Etiquetas QR</h1>
          <Button className="ml-auto" onClick={() => window.print()} disabled={selecionadas.size === 0}>
            <PrinterIcon /> Imprimir
          </Button>
        </div>
        {APP_URL.includes("localhost") && (
          <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-950">
            Os QR Codes estão apontando para <code>{APP_URL}</code>. Configure{" "}
            <code>NEXT_PUBLIC_APP_URL</code> com a URL pública da Vercel antes de imprimir.
          </p>
        )}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 font-medium">
            <Checkbox
              checked={todas}
              onCheckedChange={(v) => setSelecionadas(v ? new Set(maquinas.map((m) => m.id)) : new Set())}
            />
            Selecionar todas
          </label>
          {maquinas.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <Checkbox checked={selecionadas.has(m.id)} onCheckedChange={(v) => alternar(m.id, v === true)} />
              {m.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {maquinas
          .filter((m) => selecionadas.has(m.id))
          .map((m) => (
            <div key={m.id} className="grid gap-1">
              <EtiquetaQR maquina={m} />
              <div className="nao-imprimir grid justify-items-center gap-1">
                <BaixarQR maquina={m} rotulo="PNG com nome" />
                <a href={urlDaMaquina(m.id)} className="text-xs text-muted-foreground underline">
                  {urlDaMaquina(m.id)}
                </a>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
