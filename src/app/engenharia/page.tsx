"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { Carregando } from "@/components/Carregando";
import { CenarioDemo } from "@/components/engenharia/CenarioDemo";
import { FormMaquina } from "@/components/engenharia/FormMaquina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useErros, useMaquinas, useSubdivisoes } from "@/hooks/useCatalogo";
import { IMPACTO_ROTULO } from "@/lib/tipos";

function contarPor<T>(itens: T[], chave: (t: T) => string): Map<string, number> {
  return itens.reduce((m, t) => m.set(chave(t), (m.get(chave(t)) ?? 0) + 1), new Map<string, number>());
}

export default function Engenharia() {
  const maquinas = useMaquinas();
  const subs = useSubdivisoes();
  const erros = useErros();

  const nSubs = contarPor(subs.dados, (s) => s.maquinaId);
  const nErros = contarPor(
    erros.dados.filter((e) => e.ativo),
    (e) => e.maquinaId,
  );
  const lista = [...maquinas.dados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-moura-azul">Máquinas</h1>
        <FormMaquina
          gatilho={
            <Button className="ml-auto">
              <PlusIcon /> Nova máquina
            </Button>
          }
        />
      </div>

      {maquinas.erro && <p className="text-destructive">Erro ao carregar: {maquinas.erro}</p>}
      {maquinas.carregando ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma máquina cadastrada. Rode o seed ou crie uma.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {lista.map((m) => (
            <Link key={m.id} href={`/engenharia/maquinas/${m.id}`} className="group">
              <Card className="h-full border-t-4 border-t-moura-azul transition-all group-hover:-translate-y-0.5 group-hover:border-t-moura-amarelo group-hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-semibold text-moura-azul">
                    {m.nome}
                    {!m.ativo && <Badge variant="secondary">inativa</Badge>}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">{m.tag}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <Badge variant={m.impacto === "gargalo" ? "destructive" : "outline"}>
                    {IMPACTO_ROTULO[m.impacto]} · {m.impactoValor.toFixed(1)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {nSubs.get(m.id) ?? 0} subdivisões · {nErros.get(m.id) ?? 0} erros ativos
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CenarioDemo maquinas={maquinas.dados} subdivisoes={subs.dados} erros={erros.dados} />
    </div>
  );
}
