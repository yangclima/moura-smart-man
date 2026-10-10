"use client";

import { PrinterIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Carregando } from "@/components/Carregando";
import { EtiquetaQR } from "@/components/engenharia/EtiquetaQR";
import { DialogEtiqueta, type EtiquetaParaImprimir } from "@/components/engenharia/qrcodes/DialogEtiqueta";
import { TabelaMaquinasQR } from "@/components/engenharia/qrcodes/TabelaMaquinasQR";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMaquinas } from "@/hooks/useCatalogo";
import { FILTRO_MAQUINAS_PADRAO, filtrarMaquinas, linhasDasMaquinas, maquinaExata, type FiltroMaquinas } from "@/lib/qrcodes";
import { APP_URL } from "@/lib/supabase";
import type { Maquina } from "@/lib/tipos";

const TODAS_LINHAS = "__todas__";

/** O atalho "/" leva para a busca, como em outros sistemas; não interfere quando já se está digitando. */
function useAtalhoBusca(ref: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function aoTeclar(e: globalThis.KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (e.key !== "/" || alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;
      e.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ref]);
}

export default function QrCodes() {
  const { dados, carregando, erro } = useMaquinas();
  const [filtro, setFiltro] = useState<FiltroMaquinas>(FILTRO_MAQUINAS_PADRAO);
  const [selecionadas, setSelecionadas] = useState<ReadonlySet<string>>(new Set());
  const [aberta, setAberta] = useState<Maquina | null>(null);
  const [impressao, setImpressao] = useState<EtiquetaParaImprimir[] | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  useAtalhoBusca(buscaRef);

  const ativas = useMemo(() => dados.filter((m) => m.ativo), [dados]);
  const linhas = useMemo(() => linhasDasMaquinas(dados), [dados]);
  const listadas = useMemo(() => filtrarMaquinas(dados, filtro, selecionadas), [dados, filtro, selecionadas]);

  // As etiquetas só entram no DOM na hora de imprimir: com centenas de máquinas, a tela fica leve.
  useEffect(() => {
    if (!impressao) return;
    const quadro = requestAnimationFrame(() => {
      window.print();
      setImpressao(null);
    });
    return () => cancelAnimationFrame(quadro);
  }, [impressao]);

  function alternar(id: string, marcado: boolean) {
    setSelecionadas((s) => {
      const nova = new Set(s);
      if (marcado) nova.add(id);
      else nova.delete(id);
      return nova;
    });
  }

  function alternarVarias(ids: string[], marcado: boolean) {
    setSelecionadas((s) => {
      const nova = new Set(s);
      ids.forEach((id) => (marcado ? nova.add(id) : nova.delete(id)));
      return nova;
    });
  }

  /** Enter na busca: TAG/código exato ou resultado único abre a etiqueta direto. */
  function aoTeclarNaBusca(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setFiltro((f) => ({ ...f, busca: "" }));
    if (e.key !== "Enter") return;
    const alvo = maquinaExata(dados, filtro.busca) ?? (listadas.length === 1 ? listadas[0] : undefined);
    if (alvo) setAberta(alvo);
  }

  function imprimirSelecionadas() {
    setImpressao(ativas.filter((m) => selecionadas.has(m.id)).map((maquina) => ({ maquina })));
  }

  function imprimirUma(etiqueta: EtiquetaParaImprimir) {
    setAberta(null);
    setImpressao([etiqueta]);
  }

  if (carregando) return <Carregando />;

  const filtrando = filtro.busca !== "" || filtro.linha !== null || filtro.soSelecionadas;

  return (
    <>
      <div className={`nao-imprimir grid gap-5 ${selecionadas.size > 0 ? "pb-24" : ""}`}>
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold text-moura-azul">Etiquetas QR</h1>
          <p className="text-sm text-muted-foreground">
            Busque a máquina, confira a etiqueta e imprima ou baixe o PNG. Para várias de uma vez, marque na lista e
            imprima juntas. {ativas.length} máquina(s) ativa(s).
          </p>
        </div>

        {APP_URL.includes("localhost") && (
          <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-950">
            Os QR Codes estão apontando para <code>{APP_URL}</code>. Configure <code>NEXT_PUBLIC_APP_URL</code> com a
            URL pública da Vercel antes de imprimir.
          </p>
        )}
        {erro && <p className="text-destructive">{erro}</p>}

        <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 basis-80">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={buscaRef}
                type="search"
                value={filtro.busca}
                onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
                onKeyDown={aoTeclarNaBusca}
                placeholder="Buscar por nome, TAG, código ou linha"
                aria-label="Buscar máquina"
                aria-describedby="dica-busca"
                autoFocus
                className="h-11 pr-16 pl-10 text-base"
              />
              {filtro.busca ? (
                <button
                  type="button"
                  onClick={() => {
                    setFiltro((f) => ({ ...f, busca: "" }));
                    buscaRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground">
                  /
                </kbd>
              )}
            </div>
            {linhas.length > 1 && (
              <Select
                value={filtro.linha ?? TODAS_LINHAS}
                onValueChange={(v) => setFiltro((f) => ({ ...f, linha: v === TODAS_LINHAS ? null : v }))}
              >
                <SelectTrigger className="h-11 w-44" aria-label="Linha">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS_LINHAS}>Todas as linhas</SelectItem>
                  {linhas.map((l) => (
                    <SelectItem key={l} value={l}>
                      Linha {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={filtro.soSelecionadas}
                onCheckedChange={(v) => setFiltro((f) => ({ ...f, soSelecionadas: v }))}
                disabled={selecionadas.size === 0 && !filtro.soSelecionadas}
              />
              Só selecionadas
            </label>
          </div>
          <p id="dica-busca" className="-mt-2 text-xs text-muted-foreground">
            Digite a TAG completa (ou use um leitor de código) e aperte Enter para abrir a etiqueta direto.
          </p>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {listadas.length} de {ativas.length} máquina(s)
            </span>
            {filtrando && (
              <Button variant="ghost" size="sm" onClick={() => setFiltro(FILTRO_MAQUINAS_PADRAO)}>
                Limpar filtros
              </Button>
            )}
          </div>

          {listadas.length === 0 ? (
            <div className="grid justify-items-center gap-2 py-10 text-center text-muted-foreground">
              {ativas.length === 0 ? (
                <>
                  <p>Nenhuma máquina ativa cadastrada.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/engenharia">Cadastrar máquinas</Link>
                  </Button>
                </>
              ) : (
                <p>Nenhuma máquina encontrada para “{filtro.busca || "estes filtros"}”.</p>
              )}
            </div>
          ) : (
            <TabelaMaquinasQR
              maquinas={listadas}
              selecionadas={selecionadas}
              onAlternar={alternar}
              onAlternarTodas={alternarVarias}
              onAbrir={setAberta}
            />
          )}
        </section>
      </div>

      {selecionadas.size > 0 && (
        <div className="nao-imprimir fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 p-3">
            <span className="font-medium tabular-nums">{selecionadas.size} etiqueta(s) selecionada(s)</span>
            <Button variant="ghost" size="sm" onClick={() => setFiltro((f) => ({ ...f, soSelecionadas: !f.soSelecionadas }))}>
              {filtro.soSelecionadas ? "Ver todas" : "Ver selecionadas"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelecionadas(new Set());
                setFiltro((f) => ({ ...f, soSelecionadas: false }));
              }}
            >
              Limpar seleção
            </Button>
            <Button className="ml-auto" onClick={imprimirSelecionadas}>
              <PrinterIcon /> Imprimir {selecionadas.size} etiqueta(s)
            </Button>
          </div>
        </div>
      )}

      <DialogEtiqueta
        maquina={aberta}
        selecionada={aberta ? selecionadas.has(aberta.id) : false}
        onFechar={() => setAberta(null)}
        onSelecionar={(id) => alternar(id, !selecionadas.has(id))}
        onImprimir={imprimirUma}
      />

      {impressao && (
        <div className="hidden flex-wrap gap-4 print:flex" aria-hidden>
          {impressao.map((e) => (
            <EtiquetaQR key={`${e.maquina.id}-${e.subdivisao?.id ?? ""}`} maquina={e.maquina} subdivisao={e.subdivisao} />
          ))}
        </div>
      )}
    </>
  );
}
