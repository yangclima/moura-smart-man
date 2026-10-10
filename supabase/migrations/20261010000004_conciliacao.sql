-- Subproduto 2 — Resultado da conciliação MES × SAP (base histórica).
-- Carregado por carregar_conciliacao.py com a chave service_role (que ignora RLS).
-- Usuários logados só leem; não há políticas de escrita, como em pins/tentativas_login.
-- Cada execução do notebook vira uma linha em conc_execucoes; as views *_atual
-- mostram sempre a mais recente, e as antigas ficam para comparar parâmetros.

-- ============================================================ execuções
create table public.conc_execucoes (
  id bigint generated always as identity primary key,
  gerado_em timestamptz not null,               -- parametros_conciliacao.json -> gerado_em
  carregado_em timestamptz not null default now(),
  parametros jsonb not null,                    -- P do conciliacao.py (limiares, pesos...)
  resumo jsonb not null default '{}'            -- contagem de eventos por classe
);

-- ============================================================ eventos (1 linha por evento)
create table public.conc_eventos (
  execucao_id bigint not null references public.conc_execucoes (id) on delete cascade,
  id_evento text not null,                      -- ex.: A-EV0001
  maquina text not null,
  classe text not null check (classe in ('MES + SAP', 'MES sem SAP', 'SAP sem MES')),
  confianca text check (confianca in ('alta', 'media', 'baixa', 'sem correspondencia')),
  score numeric,
  revisar boolean not null default false,
  ambiguo boolean not null default false,
  ordem_longa boolean not null default false,
  possivel_duplicidade_sap boolean not null default false,

  -- visão da Produção (MES)
  id_parada text,
  equipamento_mes text,
  familia_mes text,
  componente_mes text,
  contem_quebra boolean,
  micro_parada boolean,
  mes_inicio timestamptz,
  mes_fim timestamptz,
  indisponibilidade_h numeric,
  ids_registro_mes text[] not null default '{}',

  -- visão da Manutenção (SAP)
  ordens text[] not null default '{}',
  n_ordens int not null default 0,
  descricao_equip_sap text,
  tipo_sap text,
  tipo_atividade_sap text,
  texto_sap text,
  sap_inicio timestamptz,
  sap_fim timestamptz,
  atuacao_h numeric,
  atuacao_na_parada_h numeric,
  n_candidatos int,

  -- linha do tempo e divergências
  inicio_evento timestamptz,
  espera_ate_atuacao_min numeric,
  retomada_apos_atuacao_min numeric,
  dif_duracao_h numeric,
  divergencia_duracao text check (divergencia_duracao in ('SAP maior', 'MES maior', 'compatível')),
  sap_antes_da_parada boolean not null default false,
  motivo_sem_par text not null default '',

  primary key (execucao_id, id_evento)
);
create index on public.conc_eventos (execucao_id, maquina, inicio_evento);
create index on public.conc_eventos (execucao_id, classe);
create index on public.conc_eventos (execucao_id) where revisar;

-- ============================================================ vínculos (1 linha por ordem SAP válida)
create table public.conc_vinculos (
  execucao_id bigint not null references public.conc_execucoes (id) on delete cascade,
  n_ordem text not null,
  maquina text not null,
  id_parada text,                               -- null = sem correspondência
  confianca text not null check (confianca in ('alta', 'media', 'baixa', 'sem correspondencia')),
  score numeric not null,
  s_tempo numeric,
  s_equip numeric,
  s_comp numeric,
  dif_inicio_min numeric,
  contencao numeric,
  ancora boolean,
  score_2o numeric,
  parada_2a text,
  ambiguo boolean not null default false,
  ordem_longa boolean not null default false,
  revisar boolean not null default false,
  n_candidatos int not null default 0,
  descricao_equip text,
  tipo text,
  tipo_atividade text,
  texto_padronizado text,
  inicio timestamptz,
  fim timestamptz,
  horas numeric,
  primary key (execucao_id, n_ordem)
);
create index on public.conc_vinculos (execucao_id, id_parada);

-- ============================================================ views da execução mais recente
create view public.conc_eventos_atual with (security_invoker = true) as
  select * from public.conc_eventos
  where execucao_id = (select max(id) from public.conc_execucoes);

create view public.conc_vinculos_atual with (security_invoker = true) as
  select * from public.conc_vinculos
  where execucao_id = (select max(id) from public.conc_execucoes);

-- ============================================================ RLS
alter table public.conc_execucoes enable row level security;
alter table public.conc_eventos enable row level security;
alter table public.conc_vinculos enable row level security;

create policy "conc_execucoes: leitura" on public.conc_execucoes for select to authenticated using (true);
create policy "conc_eventos: leitura" on public.conc_eventos for select to authenticated using (true);
create policy "conc_vinculos: leitura" on public.conc_vinculos for select to authenticated using (true);

revoke insert, update, delete on public.conc_execucoes, public.conc_eventos, public.conc_vinculos
  from anon, authenticated;
