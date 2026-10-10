"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, PlusIcon, PrinterIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BaixarQR } from "@/components/engenharia/BaixarQR";
import { EtiquetaQR, urlDaMaquina } from "@/components/engenharia/EtiquetaQR";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubdivisoes } from "@/hooks/useCatalogo";
import type { Maquina } from "@/lib/tipos";

const MAQUINA_INTEIRA = "__maquina__";

export interface EtiquetaParaImprimir {
  maquina: Maquina;
  subdivisao?: { id: string; nome: string };
}

interface DialogEtiquetaProps {
  maquina: Maquina | null;
  selecionada: boolean;
  onFechar: () => void;
  onSelecionar: (id: string) => void;
  onImprimir: (etiqueta: EtiquetaParaImprimir) => void;
}

/** Pré-visualização de uma etiqueta: escolher subdivisão, baixar PNG, imprimir só ela ou copiar o link. */
export function DialogEtiqueta({ maquina, selecionada, onFechar, onSelecionar, onImprimir }: DialogEtiquetaProps) {
  return (
    <Dialog open={maquina !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="sm:max-w-2xl">
        {maquina && (
          <Conteudo
            key={maquina.id}
            maquina={maquina}
            selecionada={selecionada}
            onSelecionar={onSelecionar}
            onImprimir={onImprimir}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ maquina, selecionada, onSelecionar, onImprimir }: Omit<DialogEtiquetaProps, "maquina" | "onFechar"> & { maquina: Maquina }) {
  const { dados: subdivisoes } = useSubdivisoes(maquina.id);
  const [subId, setSubId] = useState<string>(MAQUINA_INTEIRA);
  const [copiado, setCopiado] = useState(false);
  const sub = subdivisoes.find((s) => s.id === subId);
  const subdivisao = sub ? { id: sub.id, nome: sub.nome } : undefined;
  const url = urlDaMaquina(maquina.id, subdivisao?.id);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">{maquina.nome}</DialogTitle>
        <DialogDescription>
          <span className="font-mono">{maquina.tag}</span>
          {maquina.linha && <> · Linha {maquina.linha}</>} · código <span className="font-mono">{maquina.id}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="justify-self-center rounded-lg border bg-white p-2 shadow-xs">
          <EtiquetaQR maquina={maquina} subdivisao={subdivisao} />
        </div>
        <div className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id="rotulo-sub">
              O QR abre o chamado para
            </span>
            <Select value={subId} onValueChange={(v) => { setSubId(v); setCopiado(false); }}>
              <SelectTrigger className="w-full" aria-labelledby="rotulo-sub">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MAQUINA_INTEIRA}>A máquina inteira</SelectItem>
                {subdivisoes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Só a subdivisão {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Com subdivisão, o operador já cai nela e não precisa escolher.
            </p>
          </div>
          <div className="grid gap-2">
            <Button onClick={() => onImprimir({ maquina, subdivisao })}>
              <PrinterIcon /> Imprimir esta etiqueta
            </Button>
            <BaixarQR maquina={maquina} subdivisao={subdivisao} rotulo="Baixar PNG com nome" />
            {!subdivisao && (
              <Button variant="outline" size="sm" onClick={() => onSelecionar(maquina.id)}>
                {selecionada ? <CheckIcon /> : <PlusIcon />} {selecionada ? "Na seleção para imprimir" : "Adicionar à seleção"}
              </Button>
            )}
          </div>
          <div className="grid gap-1.5 rounded-lg bg-muted p-2.5">
            <span className="text-xs font-medium text-muted-foreground">Link do QR</span>
            <code className="text-xs break-all">{url}</code>
            <div className="flex gap-2">
              <Button variant="outline" size="xs" onClick={copiar}>
                {copiado ? <CheckIcon /> : <CopyIcon />} {copiado ? "Copiado" : "Copiar"}
              </Button>
              <Button variant="ghost" size="xs" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon /> Testar
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
