import { CheckIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { EventoHistorico } from "@/lib/historico";
import type { ResumoTempo } from "@/lib/indicadores";
import { contarClasses, type FiltroLista } from "@/lib/indicadores-historico";
import { formatarMinutos } from "@/lib/tempo";
import { PERIODOS, type Periodo } from "./AbaOperacao";
import { BotaoNumero } from "./BotaoNumero";
import { GraficoEspera } from "./graficos/GraficoEspera";

/** Números reais da aba Operação, para o lado "depois". */
export interface ResumoOperacao {
  reacao: ResumoTempo;
  encerrados: number;
  periodo: Periodo;
  carregando: boolean;
}

interface AntesDepoisProps {
  eventos: EventoHistorico[];
  operacao: ResumoOperacao;
  onAbrir: (f: FiltroLista) => void;
}

function Item({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icone = ok ? CheckIcon : XIcon;
  return (
    <li className="flex gap-2">
      <Icone className={ok ? "mt-0.5 size-4 shrink-0 text-emerald-600" : "mt-0.5 size-4 shrink-0 text-destructive"} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** Mensagem principal da aba: o que se perdia sem o acionamento digital, e a espera estimada do histórico. */
export function AntesDepois({ eventos, operacao, onAbrir }: AntesDepoisProps) {
  const classes = contarClasses(eventos);
  const periodo = PERIODOS[operacao.periodo].toLowerCase();

  return (
    <section className="grid gap-4" aria-label="Antes e depois do acionamento digital">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-3 rounded-2xl border bg-card p-4 shadow-xs">
          <div>
            <h2 className="text-lg font-semibold">Histórico (MES e SAP separados)</h2>
            <p className="text-sm text-muted-foreground">Produção e manutenção apontavam em sistemas diferentes.</p>
          </div>
          <ul className="grid gap-2 text-sm">
            <Item ok={false}>
              <BotaoNumero rotulo="Ver as paradas sem ordem no SAP" onClick={() => onAbrir({ classe: "MES sem SAP" })}>
                {classes["MES sem SAP"]}
              </BotaoNumero>{" "}
              paradas sem ordem de manutenção
            </Item>
            <Item ok={false}>
              <BotaoNumero rotulo="Ver as ordens sem parada no MES" onClick={() => onAbrir({ classe: "SAP sem MES" })}>
                {classes["SAP sem MES"]}
              </BotaoNumero>{" "}
              ordens sem parada correspondente
            </Item>
            <Item ok={false}>Sem registro de T1: não se sabe quando a manutenção foi avisada</Item>
            <Item ok={false}>Horário do SAP apontado à mão, depois do fato</Item>
          </ul>
        </div>

        <div className="grid content-start gap-3 rounded-2xl border border-t-4 border-t-moura-amarelo bg-card p-4 shadow-xs">
          <div>
            <h2 className="text-lg font-semibold">Com acionamento digital</h2>
            <p className="text-sm text-muted-foreground">Um chamado liga a parada ao atendimento desde a abertura.</p>
          </div>
          <ul className="grid gap-2 text-sm">
            <Item ok>Cada chamado tem um ID único, da abertura à liberação</Item>
            <Item ok>Marcos T0 a T5 registrados no momento em que acontecem</Item>
            <Item ok>
              T1 existe: reação mediana de{" "}
              <strong className="tabular-nums">
                {operacao.carregando ? "…" : formatarMinutos(operacao.reacao.mediana)}
              </strong>{" "}
              ({operacao.carregando ? "carregando" : `${operacao.encerrados} chamado(s) encerrado(s)`}, {periodo}, aba
              Operação)
            </Item>
          </ul>
        </div>
      </div>

      <GraficoEspera
        eventos={eventos}
        reacaoOperacao={operacao.reacao}
        carregandoOperacao={operacao.carregando}
        onAbrir={onAbrir}
      />
    </section>
  );
}
