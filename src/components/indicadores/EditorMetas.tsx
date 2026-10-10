"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
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
import { useUsuario } from "@/hooks/useUsuario";
import { mensagemDeErro } from "@/lib/chamados";
import { CLASSES_META, META_MAXIMA_MIN, metasParaTexto, salvarMetasInicio, validarMetas, type MetasTexto } from "@/lib/metas";
import type { Classe, ConfigPriorizacao } from "@/lib/tipos";

/** Edita as metas de início (T2−T0) por classe. Vale para a fila, os alertas e os indicadores. */
export function EditorMetas({ config }: { config: ConfigPriorizacao }) {
  const { usuario } = useUsuario();
  const podeEditar = usuario?.papel === "engenharia";
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [texto, setTexto] = useState<MetasTexto>(() => metasParaTexto(config.metaInicioMin));
  const [erros, setErros] = useState<Partial<Record<Classe, string>>>({});

  function abrir(v: boolean) {
    // Ao abrir, parte dos valores atuais (podem ter mudado em tempo real).
    if (v) {
      setTexto(metasParaTexto(config.metaInicioMin));
      setErros({});
    }
    setAberto(v);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const r = validarMetas(texto);
    if (!r.ok) {
      setErros(r.erros);
      return;
    }
    setSalvando(true);
    try {
      await salvarMetasInicio(config, r.metas);
      toast.success("Metas atualizadas");
      setAberto(false);
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  if (!podeEditar) {
    return <p className="text-xs text-muted-foreground">Só a engenharia altera as metas.</p>;
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontalIcon /> Ajustar metas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={salvar} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Metas de início do atendimento</DialogTitle>
            <DialogDescription>
              Tempo máximo, em minutos, entre a abertura (T0) e o início do atendimento (T2). Vale para a fila da
              manutenção, os alertas de meta estourada e estes indicadores. Deixe vazio para “sem meta”.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {CLASSES_META.map((c) => (
              <div key={c} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
                <Label htmlFor={`meta-${c}`} className="font-semibold">
                  {c}
                </Label>
                <Input
                  id={`meta-${c}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={META_MAXIMA_MIN}
                  step={1}
                  placeholder="sem meta"
                  value={texto[c]}
                  onChange={(ev) => setTexto((t) => ({ ...t, [c]: ev.target.value }))}
                  aria-invalid={Boolean(erros[c])}
                  aria-describedby={erros[c] ? `meta-${c}-erro` : undefined}
                />
                <span className="text-sm text-muted-foreground">min</span>
                {erros[c] && (
                  <p id={`meta-${c}-erro`} className="col-start-2 col-end-4 text-xs text-destructive">
                    {erros[c]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => abrir(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar metas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
