"""Carrega a saída de conciliacao_mes_sap.ipynb no Supabase.

Lê de data/processed: conc_eventos, conc_vinculo (.parquet ou .pkl) e parametros_conciliacao.json.
Cria uma linha em conc_execucoes e insere eventos e vínculos dessa execução.
Se algo falhar no meio, a execução é apagada (cascade) e nada fica pela metade.

Uso, no terminal:
    pip install supabase pandas pyarrow
    export SUPABASE_URL=https://<projeto>.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=<chave service_role>   # nunca no front nem no git
    python carregar_conciliacao.py ./data/processed

Ou no fim do notebook:
    import carregar_conciliacao as db
    db.carregar_no_supabase(OUT_DIR)
"""
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

FUSO = "America/Recife"   # horários do MES/SAP vêm sem fuso; a planta está em UTC-3
LOTE = 500

COLS_EVENTOS = [
    "id_evento", "maquina", "classe", "confianca", "score", "revisar", "ambiguo", "ordem_longa",
    "possivel_duplicidade_sap", "id_parada", "equipamento_mes", "familia_mes", "componente_mes",
    "contem_quebra", "micro_parada", "mes_inicio", "mes_fim", "indisponibilidade_h", "ids_registro_mes",
    "ordens", "n_ordens", "descricao_equip_sap", "tipo_sap", "tipo_atividade_sap", "texto_sap",
    "sap_inicio", "sap_fim", "atuacao_h", "atuacao_na_parada_h", "n_candidatos", "inicio_evento",
    "espera_ate_atuacao_min", "retomada_apos_atuacao_min", "dif_duracao_h", "divergencia_duracao",
    "sap_antes_da_parada", "motivo_sem_par",
]
COLS_VINCULOS = [
    "n_ordem", "maquina", "id_parada", "confianca", "score", "s_tempo", "s_equip", "s_comp",
    "dif_inicio_min", "contencao", "ancora", "score_2o", "parada_2a", "ambiguo", "ordem_longa",
    "revisar", "n_candidatos", "descricao_equip", "tipo", "tipo_atividade", "texto_padronizado",
    "inicio", "fim", "horas",
]
DATAS = {"mes_inicio", "mes_fim", "sap_inicio", "sap_fim", "inicio_evento", "inicio", "fim"}
FLAGS = {"revisar", "ambiguo", "ordem_longa", "possivel_duplicidade_sap", "sap_antes_da_parada"}  # NaN -> False
INTEIROS = {"n_ordens", "n_candidatos"}
LISTAS = {"ids_registro_mes", "ordens"}
TEXTOS_ID = {"n_ordem", "id_parada", "parada_2a"}


# ---------------------------------------------------------------- leitura
def ler(d, nome):
    pq, pk = d / f"{nome}.parquet", d / f"{nome}.pkl"
    return pd.read_parquet(pq) if pq.exists() else pd.read_pickle(pk)


# ---------------------------------------------------------------- conversões
def como_texto(v):
    """Identificador como texto: 4000123.0 -> '4000123'."""
    if v is None or v is pd.NA or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, (float, np.floating)) and float(v).is_integer():
        return str(int(v))
    return str(v)


def como_lista(v):
    """Lista de ids/ordens -> list[str] (aceita lista, array ou '1,2,3')."""
    if isinstance(v, (list, tuple, set, frozenset, np.ndarray)):
        return [como_texto(x) for x in v if como_texto(x) is not None]
    t = como_texto(v)
    return [s.strip() for s in t.split(",") if s.strip()] if t else []


def json_ok(v):
    """Valor do pandas/numpy -> algo que o JSON aceita."""
    if v is None or v is pd.NA or v is pd.NaT:
        return None
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, np.generic):
        v = v.item()
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def preparar(df, colunas):
    df = df.rename(columns=str.lower)
    faltam = [c for c in colunas if c not in df.columns]
    if faltam:
        print(f"  aviso: colunas ausentes, irão como null: {faltam}")
    df = df.reindex(columns=colunas).copy()

    for c in colunas:
        if c in DATAS:
            s = pd.to_datetime(df[c])
            df[c] = s.dt.tz_localize(FUSO) if s.dt.tz is None else s
        elif c in FLAGS:
            df[c] = df[c].fillna(False).astype(bool)
        elif c in INTEIROS:   # Int64 aceita nulo: n_candidatos só existe em "SAP sem MES"
            df[c] = (df[c].fillna(0) if c == "n_ordens" else df[c]).astype("Int64")
        elif c in LISTAS:
            df[c] = df[c].map(como_lista)
        elif c in TEXTOS_ID:
            df[c] = df[c].map(como_texto)

    return [{k: json_ok(v) for k, v in r.items()} for r in df.astype(object).to_dict("records")]


# ---------------------------------------------------------------- carga
def carregar_no_supabase(dirpath="./data/processed"):
    from supabase import create_client

    d = Path(dirpath)
    eventos = preparar(ler(d, "conc_eventos"), COLS_EVENTOS)
    vinculos = preparar(ler(d, "conc_vinculo"), COLS_VINCULOS)
    meta = json.loads((d / "parametros_conciliacao.json").read_text(encoding="utf-8"))
    resumo = meta.pop("eventos", {})
    gerado_em = pd.Timestamp(meta.pop("gerado_em")).tz_localize(FUSO).isoformat()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    execucao_id = (sb.table("conc_execucoes")
                   .insert({"gerado_em": gerado_em, "parametros": meta, "resumo": resumo})
                   .execute().data[0]["id"])
    print(f"execução {execucao_id}")

    try:
        for tabela, linhas in (("conc_eventos", eventos), ("conc_vinculos", vinculos)):
            for i in range(0, len(linhas), LOTE):
                lote = [{"execucao_id": execucao_id, **r} for r in linhas[i:i + LOTE]]
                sb.table(tabela).insert(lote).execute()
            print(f"  {tabela}: {len(linhas)} linhas")
    except Exception:
        sb.table("conc_execucoes").delete().eq("id", execucao_id).execute()
        print(f"  falhou; execução {execucao_id} desfeita")
        raise
    return execucao_id


if __name__ == "__main__":
    carregar_no_supabase(sys.argv[1] if len(sys.argv) > 1 else "./data/processed")
