"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Carregando } from "@/components/Carregando";
import { FotoChamado } from "@/components/chamado/FotoChamado";
import { DialogErro } from "@/components/engenharia/DialogErro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useErros, useSubdivisoes } from "@/hooks/useCatalogo";
import { useTempoReal } from "@/hooks/useTempoReal";
import { associarErroRevisado, listarChamadosOutro, porOrdem } from "@/lib/catalogo";
import { mensagemDeErro } from "@/lib/chamados";
import { formatarDataHora } from "@/lib/tempo";
import type { Chamado, ErroCatalogo, Subdivisao } from "@/lib/tipos";

const VAZIO: Chamado[] = [];

export default function Revisao() {
  const chamados = useTempoReal("revisao", listarChamadosOutro, [{ tabela: "chamados" }], VAZIO);
  const subs = useSubdivisoes();
  const erros = useErros();
  const [mostrarRevisados, setMostrarRevisados] = useState(false);

  if (chamados.carregando) return <Carregando />;

  const lista = chamados.dados.filter((c) => mostrarRevisados || !c.erroIdRevisado);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-moura-azul">Revisão de chamados “Outro”</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setMostrarRevisados((v) => !v)}>
          {mostrarRevisados ? "Ocultar revisados" : "Mostrar revisados"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Chamados em que o operador não encontrou o erro na lista. Transforme a descrição em um erro do
        catálogo ou associe a um erro existente. O texto original do operador é mantido.
      </p>
      {chamados.erro && <p className="text-destructive">{chamados.erro}</p>}
      {lista.length === 0 && <p className="text-muted-foreground">Nada para revisar.</p>}
      {lista.map((c) => {
        const sub = subs.dados.find((s) => s.id === c.subdivisaoId);
        const errosSub = erros.dados.filter((e) => e.subdivisaoId === c.subdivisaoId).sort(porOrdem);
        return (
          <ItemRevisao key={c.id} chamado={c} subdivisao={sub} erros={errosSub} />
        );
      })}
    </div>
  );
}

function ItemRevisao({
  chamado: c,
  subdivisao,
  erros,
}: {
  chamado: Chamado;
  subdivisao?: Subdivisao;
  erros: ErroCatalogo[];
}) {
  const [escolhido, setEscolhido] = useState<string>("");
  const revisado = erros.find((e) => e.id === c.erroIdRevisado);

  async function associar(erroId: string) {
    try {
      await associarErroRevisado(c.id, erroId);
      toast.success("Chamado associado ao catálogo");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="font-mono text-muted-foreground">{c.numero}</span>
          {c.maquinaNome} · {c.subdivisaoNome}
          <span className="text-sm font-normal text-muted-foreground">{formatarDataHora(c.marcos.abertura)}</span>
          {revisado && (
            <Badge variant="secondary">
              <CheckIcon /> {revisado.nome}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        <FotoChamado chamado={c} />
        <blockquote className="min-w-48 flex-1 border-l-4 pl-3 italic">
          {c.descricaoLivre || <span className="text-muted-foreground">(sem descrição)</span>}
        </blockquote>
        {subdivisao && (
          <div className="flex flex-wrap items-center gap-2">
            <DialogErro
              subdivisao={subdivisao}
              ordem={erros.length}
              origem="revisao"
              inicial={{ nome: c.descricaoLivre.slice(0, 60), riscoPessoas: c.riscoPessoas, impactoQualidade: c.impactoQualidade }}
              aoCriar={associar}
              gatilho={
                <Button size="sm">
                  <PlusIcon /> Criar erro a partir deste
                </Button>
              }
            />
            <Select value={escolhido} onValueChange={setEscolhido}>
              <SelectTrigger size="sm" className="w-56">
                <SelectValue placeholder="Associar a erro existente" />
              </SelectTrigger>
              <SelectContent>
                {erros.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                    {!e.ativo && " (inativo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!escolhido} onClick={() => associar(escolhido)}>
              Associar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
