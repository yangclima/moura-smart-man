"""Gera data/seed.json a partir da base tratada do case (MES + SAP).

Uso (com o venv do projeto de análise):
    ../moura_manutencao/.venv/Scripts/python.exe scripts/gerar_seed.py [pasta_processed]

Saída: máquinas, subdivisões (com critHist e componentes), catálogo de erros
inicial e o documento config/priorizacao.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PADRAO_PROCESSED = RAIZ.parent.parent / "moura_manutencao" / "src" / "data" / "processed"
SAIDA = RAIZ / "data" / "seed.json"

REINCIDENCIA_DIAS = 7
MAX_COMPONENTES = 12

IMPACTO = {
    "A": ("gargalo", 1.0),
    "B": ("sem_redundancia", 0.7),
    "C": ("sem_redundancia", 0.7),
    "D": ("sem_redundancia", 0.7),
}

# (nome, riscoPessoas, impactoQualidade)
ERROS_GENERICOS = [
    ("Parou sem causa aparente", False, False),
    ("Ruído ou vibração anormal", False, False),
    ("Vazamento", True, False),
    ("Superaquecimento / temperatura fora", True, True),
    ("Falha elétrica ou de sensor", True, False),
    ("Travamento / desalinhamento", False, True),
]

# Refinamento da Máquina A com os termos mais frequentes do texto SAP.
ERROS_MAQUINA_A = {
    "FORNO 1": [
        ("Falha no QMD", False, True),
        ("Transferência entupida", False, True),
        ("Chumbo fora da temperatura de fusão", True, True),
    ],
    "FORNO 2": [
        ("Falha no QMD", False, True),
        ("Chama apagada / sem ignição", True, False),
        ("Bomba sem funcionar", False, False),
    ],
    "LONAS": [
        ("Lona travada", False, False),
        ("Lona danificada / rasgada", False, True),
        ("Falha no retrator (ESTRT)", False, False),
        ("Redutor ou motor da lona", False, False),
    ],
    "ROLOS": [
        ("Rolo travado", False, False),
        ("Rolo patinando", False, True),
        ("Acoplamento do rolo solto", False, False),
    ],
    "DISCO": [
        ("Disco travado", False, False),
        ("Proteção ou guia do disco danificada", True, False),
        ("Disco não liga", False, False),
    ],
    "AQUECIMENTO": [
        ("Roda ou cinta com folga", False, False),
        ("Soprador sem funcionar", False, True),
    ],
    "ESTACAO FIM": [("Rolo folgado na estação fim", False, False)],
    "FACAO": [("Lâmina do facão solta", True, False)],
    "MECANISMO": [("Falha no mecanismo de tração", False, False)],
}


def slug(texto: str, maiusculo: bool = False) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "-", sem_acento).strip("-")
    return s.upper() if maiusculo else s.lower()


def crit_hist(paradas: pd.DataFrame) -> pd.DataFrame:
    """Criticidade histórica por subdivisão: média dos percentis de
    frequência de quebra, MTTR e reincidência (paradas a menos de 7 dias)."""
    p = paradas[~paradas["micro_parada"]].sort_values("inicio").copy()
    p["gap_dias"] = p.groupby(["maquina", "equipamento"])["inicio"].diff().dt.total_seconds() / 86400
    p["reincidente"] = p["gap_dias"] <= REINCIDENCIA_DIAS

    g = p.groupby(["maquina", "equipamento"]).agg(
        quebras=("contem_quebra", "sum"),
        mttr=("duracao_h", "mean"),
        reincidencia=("reincidente", "mean"),
    )
    pct = g.rank(pct=True)
    g["critHist"] = pct.mean(axis=1).round(2)
    return g.reset_index()


def componentes_por_subdivisao(registros: pd.DataFrame) -> dict[tuple[str, str], list[str]]:
    r = registros[registros["componente"].fillna("").str.strip() != ""]
    out: dict[tuple[str, str], list[str]] = {}
    for (maq, eq), grupo in r.groupby(["maquina", "equipamento"]):
        out[(maq, eq)] = grupo["componente"].value_counts().head(MAX_COMPONENTES).index.tolist()
    return out


def montar_seed(pasta: Path) -> dict:
    paradas = pd.read_parquet(pasta / "mes_paradas.parquet")
    registros = pd.read_parquet(pasta / "mes_registros.parquet")
    sap = pd.read_parquet(pasta / "sap_ordens.parquet")

    criticidade = crit_hist(paradas)
    componentes = componentes_por_subdivisao(registros)
    locais = sap.groupby("maquina")["local_instalacao"].first()

    maquinas, subdivisoes, erros = [], [], []
    for maq in sorted(paradas["maquina"].dropna().unique()):
        local = str(locais.get(maq, f"9001.FABX.CEL00.MAQ{maq}"))
        partes = local.split(".")
        impacto, valor = IMPACTO.get(maq, ("sem_redundancia", 0.7))
        maquinas.append({
            "id": maq,
            "nome": f"Máquina {maq}",
            "tag": ".".join(partes[:4]),
            "linha": partes[2] if len(partes) > 2 else "",
            "impacto": impacto,
            "impactoValor": valor,
            "ativo": True,
        })

        crit_maq = criticidade[criticidade["maquina"] == maq].sort_values("equipamento")
        for ordem, linha in enumerate(crit_maq.itertuples(index=False)):
            sub_id = f"{maq}-{slug(linha.equipamento, maiusculo=True)}"
            subdivisoes.append({
                "id": sub_id,
                "maquinaId": maq,
                "nome": linha.equipamento,
                "ordem": ordem,
                "critHist": float(linha.critHist),
                "componentes": componentes.get((maq, linha.equipamento), []),
            })
            especificos = ERROS_MAQUINA_A.get(linha.equipamento, []) if maq == "A" else []
            for i, (nome, risco, qualidade) in enumerate(especificos + ERROS_GENERICOS):
                erros.append({
                    "id": f"{sub_id}-{slug(nome)}",
                    "maquinaId": maq,
                    "subdivisaoId": sub_id,
                    "nome": nome,
                    "riscoPessoas": risco,
                    "impactoQualidade": qualidade,
                    "ordem": i,
                    "ativo": True,
                    "origem": "seed",
                })

    config = {
        "versao": 1,
        "pesos": {"c1": 0.42, "c2": 0.26, "c3": 0.16, "c4": 0.10, "c5": 0.06},
        "condicao": {"parada": 1.0, "restricao": 0.5},
        "aging": {"ptsPorMin": 0.5, "maxPts": 30},
        "limiares": {"P1": 70, "P2": 50, "P3": 30},
        "metaInicioMin": {"P0": 0, "P1": 15, "P2": 30, "P3": 120, "P4": None},
        "reincidenciaDias": REINCIDENCIA_DIAS,
    }
    return {"maquinas": maquinas, "subdivisoes": subdivisoes, "erros": erros, "config": config}


def main() -> None:
    pasta = Path(sys.argv[1]) if len(sys.argv) > 1 else PADRAO_PROCESSED
    seed = montar_seed(pasta)
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(seed['maquinas'])} máquinas, {len(seed['subdivisoes'])} subdivisões, "
          f"{len(seed['erros'])} erros -> {SAIDA}")


if __name__ == "__main__":
    main()
