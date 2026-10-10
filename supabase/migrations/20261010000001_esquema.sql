-- Subproduto 1 — Acionamento digital: esquema, RLS e funções.
-- Mudanças de chamado só acontecem pelas funções abrir_chamado / executar_acao
-- (security definer), que validam a máquina de estados dentro da transação.

-- ============================================================ perfis
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('engenharia', 'lider', 'mantenedor', 'operador', 'oficina'))
);

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.perfis where id = auth.uid();
$$;

-- ============================================================ cadastro
create table public.maquinas (
  id text primary key,
  nome text not null,
  tag text not null,
  linha text not null default '',
  impacto text not null check (impacto in ('gargalo', 'sem_redundancia', 'com_redundancia')),
  impacto_valor numeric not null,
  ativo boolean not null default true
);

create table public.subdivisoes (
  id text primary key,
  maquina_id text not null references public.maquinas (id),
  nome text not null,
  ordem int not null default 0,
  crit_hist numeric not null default 0.5,
  componentes text[] not null default '{}'
);
create index on public.subdivisoes (maquina_id);

create table public.erros (
  id text primary key,
  maquina_id text not null references public.maquinas (id),
  subdivisao_id text not null references public.subdivisoes (id),
  nome text not null,
  risco_pessoas boolean not null default false,
  impacto_qualidade boolean not null default false,
  ordem int not null default 0,
  ativo boolean not null default true,
  origem text not null default 'engenharia' check (origem in ('seed', 'engenharia', 'revisao'))
);
create index on public.erros (subdivisao_id);

create table public.config (
  id text primary key,
  dados jsonb not null
);

-- ============================================================ chamados
create sequence public.chamados_seq;

create table public.chamados (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  maquina_id text not null references public.maquinas (id),
  maquina_nome text not null,
  tag text not null,
  subdivisao_id text not null references public.subdivisoes (id),
  subdivisao_nome text not null,
  erro_id text references public.erros (id),
  erro_nome text not null,
  erro_id_revisado text references public.erros (id),
  descricao_livre text not null default '' check (char_length(descricao_livre) <= 140),
  condicao text not null check (condicao in ('parada', 'restricao')),
  risco_pessoas boolean not null default false,
  impacto_qualidade boolean not null default false,
  foto_path text,
  solicitante_id uuid not null,
  solicitante_nome text not null,
  responsavel_id uuid,
  responsavel_nome text,
  status text not null default 'aberto' check (status in (
    'aberto', 'recebido', 'em_atendimento', 'pausado', 'aguardando_liberacao', 'encerrado', 'cancelado')),
  prioridade jsonb not null,
  override jsonb,
  abertura timestamptz not null default now(),
  recebido timestamptz,
  inicio timestamptz,
  fim_atuacao timestamptz,
  liberado timestamptz,
  pausas jsonb not null default '[]',
  conclusao jsonb,
  cancelamento jsonb,
  demo boolean not null default false
);
create index on public.chamados (status);
create index on public.chamados (subdivisao_id, abertura);
create index on public.chamados (abertura);

-- Log imutável de cada ação (quem, o quê, quando).
create table public.eventos (
  id bigint generated always as identity primary key,
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  acao text not null,
  usuario_id uuid,
  nome text not null,
  em timestamptz not null default now(),
  dados jsonb not null default '{}'
);
create index on public.eventos (chamado_id);

-- ============================================================ RLS
alter table public.perfis enable row level security;
alter table public.maquinas enable row level security;
alter table public.subdivisoes enable row level security;
alter table public.erros enable row level security;
alter table public.config enable row level security;
alter table public.chamados enable row level security;
alter table public.eventos enable row level security;

create policy "perfis: leitura" on public.perfis for select to authenticated using (true);

create policy "maquinas: leitura" on public.maquinas for select to authenticated using (true);
create policy "maquinas: engenharia" on public.maquinas for all to authenticated
  using (public.papel_atual() = 'engenharia') with check (public.papel_atual() = 'engenharia');

create policy "subdivisoes: leitura" on public.subdivisoes for select to authenticated using (true);
create policy "subdivisoes: engenharia" on public.subdivisoes for all to authenticated
  using (public.papel_atual() = 'engenharia') with check (public.papel_atual() = 'engenharia');

create policy "erros: leitura" on public.erros for select to authenticated using (true);
create policy "erros: engenharia" on public.erros for all to authenticated
  using (public.papel_atual() = 'engenharia') with check (public.papel_atual() = 'engenharia');

create policy "config: leitura" on public.config for select to authenticated using (true);
create policy "config: engenharia" on public.config for all to authenticated
  using (public.papel_atual() = 'engenharia') with check (public.papel_atual() = 'engenharia');

create policy "chamados: leitura" on public.chamados for select to authenticated using (true);
-- Só o histórico do cenário de demonstração entra direto; o resto passa por abrir_chamado().
create policy "chamados: historico demo" on public.chamados for insert to authenticated
  with check (public.papel_atual() = 'engenharia' and demo and solicitante_id = auth.uid());

create policy "eventos: leitura" on public.eventos for select to authenticated using (true);
-- Sem políticas de insert/update/delete: eventos só nascem dentro das funções.

-- ============================================================ funções
create or replace function public.abrir_chamado(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_maq maquinas;
  v_sub subdivisoes;
  v_erro erros;
  v_id uuid;
  v_nome text := coalesce(nullif(trim(p->>'solicitante_nome'), ''), 'Operador');
  -- coalesce: sem perfil (operador anônimo), papel_atual() é NULL.
  v_demo boolean := coalesce((p->>'demo')::boolean, false) and coalesce(public.papel_atual() = 'engenharia', false);
begin
  if auth.uid() is null then
    raise exception 'Faça login para abrir chamados';
  end if;

  select * into v_maq from maquinas where id = p->>'maquina_id' and ativo;
  if not found then
    raise exception 'Máquina inválida ou inativa';
  end if;
  select * into v_sub from subdivisoes where id = p->>'subdivisao_id' and maquina_id = v_maq.id;
  if not found then
    raise exception 'Subdivisão inválida';
  end if;
  if p->>'erro_id' is not null then
    select * into v_erro from erros where id = p->>'erro_id' and subdivisao_id = v_sub.id;
    if not found then
      raise exception 'Erro inválido';
    end if;
  elsif coalesce(trim(p->>'descricao_livre'), '') = '' then
    raise exception 'Descreva o problema';
  end if;

  insert into chamados (
    numero, maquina_id, maquina_nome, tag, subdivisao_id, subdivisao_nome, erro_id, erro_nome,
    descricao_livre, condicao, risco_pessoas, impacto_qualidade, foto_path,
    solicitante_id, solicitante_nome, prioridade, abertura, demo
  ) values (
    'CH-' || lpad(nextval('chamados_seq')::text, 6, '0'),
    v_maq.id, v_maq.nome, v_maq.tag, v_sub.id, v_sub.nome,
    v_erro.id, coalesce(v_erro.nome, 'Outro / não identificado'),
    left(coalesce(trim(p->>'descricao_livre'), ''), 140),
    p->>'condicao',
    coalesce((p->>'risco_pessoas')::boolean, false),
    coalesce(v_erro.impacto_qualidade, false),
    nullif(p->>'foto_path', ''),
    auth.uid(), v_nome,
    p->'prioridade',
    -- abertura recuada só no cenário de demonstração
    case when v_demo and p ? 'abertura' then (p->>'abertura')::timestamptz else now() end,
    v_demo
  ) returning id into v_id;

  insert into eventos (chamado_id, acao, usuario_id, nome, dados)
  values (v_id, 'abrir', auth.uid(), v_nome, jsonb_build_object('reincidencia', p->'reincidencia'));
  return v_id;
end;
$$;

-- Máquina de estados (espelha src/lib/estados.ts, que monta os botões da tela).
create or replace function public.executar_acao(p_id uuid, p_acao text, p_dados jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c chamados;
  v_uid uuid := auth.uid();
  v_papel text := public.papel_atual();
  v_nome text;
  -- coalesce: sem perfil (operador anônimo), v_papel é NULL e NULL não pode liberar nada.
  v_equipe boolean := coalesce(v_papel in ('mantenedor', 'lider'), false);
  v_lider boolean := coalesce(v_papel = 'lider', false);
  v_motivo text := nullif(trim(p_dados->>'motivo'), '');
begin
  if v_uid is null then
    raise exception 'Faça login';
  end if;
  select nome into v_nome from perfis where id = v_uid;
  v_nome := coalesce(v_nome, nullif(trim(p_dados->>'nome_usuario'), ''), 'Operador');

  select * into c from chamados where id = p_id for update;
  if not found then
    raise exception 'Chamado não encontrado';
  end if;

  -- Ações que só o responsável (ou o líder) conduz.
  if p_acao in ('iniciar', 'devolver', 'pausar', 'retomar', 'concluir')
     and v_equipe and not v_lider and c.responsavel_id is distinct from v_uid
     and c.status in ('recebido', 'em_atendimento', 'pausado') then
    raise exception 'Chamado está com %', coalesce(c.responsavel_nome, 'outra pessoa');
  end if;

  case p_acao
    when 'receber' then
      if not v_equipe then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status <> 'aberto' then
        if c.responsavel_nome is not null then
          raise exception 'Chamado já recebido por %', c.responsavel_nome;
        end if;
        raise exception 'Ação "receber" não é válida com o chamado %', c.status;
      end if;
      update chamados set status = 'recebido', recebido = now(),
        responsavel_id = v_uid, responsavel_nome = v_nome where id = p_id;

    when 'devolver' then
      if not v_equipe then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status <> 'recebido' then raise exception 'Ação "devolver" não é válida com o chamado %', c.status; end if;
      update chamados set status = 'aberto', recebido = null,
        responsavel_id = null, responsavel_nome = null where id = p_id;

    when 'iniciar' then
      if not v_equipe then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status <> 'recebido' then raise exception 'Ação "iniciar" não é válida com o chamado %', c.status; end if;
      update chamados set status = 'em_atendimento', inicio = now() where id = p_id;

    when 'pausar' then
      if not v_equipe then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status <> 'em_atendimento' then raise exception 'Ação "pausar" não é válida com o chamado %', c.status; end if;
      if v_motivo is null then raise exception 'Informe o motivo'; end if;
      update chamados set status = 'pausado',
        pausas = pausas || jsonb_build_array(jsonb_build_object('inicio', now(), 'motivo', v_motivo))
      where id = p_id;

    when 'retomar' then
      if not v_equipe then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status <> 'pausado' then raise exception 'Ação "retomar" não é válida com o chamado %', c.status; end if;
      update chamados set status = 'em_atendimento',
        pausas = jsonb_set(pausas, array[(jsonb_array_length(pausas) - 1)::text, 'fim'], to_jsonb(now()))
      where id = p_id;

    when 'concluir' then
      if not v_equipe then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status <> 'em_atendimento' then raise exception 'Ação "concluir" não é válida com o chamado %', c.status; end if;
      if coalesce(p_dados#>>'{conclusao,componente}', '') = '' or coalesce(p_dados#>>'{conclusao,modoFalha}', '') = ''
         or coalesce(p_dados#>>'{conclusao,acao}', '') = '' then
        raise exception 'Preencha componente, modo de falha e ação realizada';
      end if;
      update chamados set status = 'aguardando_liberacao', fim_atuacao = now(),
        conclusao = p_dados->'conclusao' where id = p_id;

    when 'liberar', 'reabrir' then
      if not (v_lider or c.solicitante_id = v_uid) then
        raise exception 'Seu perfil não pode executar esta ação';
      end if;
      if c.status <> 'aguardando_liberacao' then
        raise exception 'Ação "%" não é válida com o chamado %', p_acao, c.status;
      end if;
      if p_acao = 'liberar' then
        update chamados set status = 'encerrado', liberado = now() where id = p_id;
      else
        update chamados set status = 'em_atendimento', fim_atuacao = null where id = p_id;
      end if;

    when 'cancelar' then
      if not v_lider then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status not in ('aberto', 'recebido') then raise exception 'Ação "cancelar" não é válida com o chamado %', c.status; end if;
      if v_motivo is null then raise exception 'Informe o motivo'; end if;
      update chamados set status = 'cancelado',
        cancelamento = jsonb_build_object('motivo', v_motivo, 'por', v_nome) where id = p_id;

    when 'atribuir' then
      if not v_lider then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status not in ('aberto', 'recebido') then raise exception 'Ação "atribuir" não é válida com o chamado %', c.status; end if;
      if p_dados#>>'{mantenedor,uid}' is null then raise exception 'Escolha o mantenedor'; end if;
      update chamados set status = 'recebido', recebido = coalesce(recebido, now()),
        responsavel_id = (p_dados#>>'{mantenedor,uid}')::uuid,
        responsavel_nome = p_dados#>>'{mantenedor,nome}'
      where id = p_id;

    when 'priorizar' then
      if not v_lider then raise exception 'Seu perfil não pode executar esta ação'; end if;
      if c.status not in ('aberto', 'recebido', 'em_atendimento', 'pausado') then
        raise exception 'Ação "priorizar" não é válida com o chamado %', c.status;
      end if;
      if coalesce(p_dados->>'classe', '') not in ('P0', 'P1', 'P2', 'P3', 'P4') then raise exception 'Escolha a classe'; end if;
      if char_length(trim(coalesce(p_dados->>'justificativa', ''))) < 15 then
        raise exception 'Justificativa precisa de pelo menos 15 caracteres';
      end if;
      update chamados set override = jsonb_build_object(
        'classe', p_dados->>'classe', 'justificativa', trim(p_dados->>'justificativa'), 'por', v_nome, 'em', now())
      where id = p_id;

    else
      raise exception 'Ação desconhecida: %', p_acao;
  end case;

  insert into eventos (chamado_id, acao, usuario_id, nome, dados)
  values (p_id, p_acao, v_uid, v_nome, coalesce(p_dados, '{}'));
end;
$$;

create or replace function public.revisar_chamado(p_id uuid, p_erro_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.papel_atual() is distinct from 'engenharia' then
    raise exception 'Seu perfil não pode executar esta ação';
  end if;
  update chamados set erro_id_revisado = p_erro_id where id = p_id;
  insert into eventos (chamado_id, acao, usuario_id, nome, dados)
  select p_id, 'revisar', auth.uid(), nome, jsonb_build_object('erro_id', p_erro_id)
  from perfis where id = auth.uid();
end;
$$;

create or replace function public.limpar_demo()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if public.papel_atual() is distinct from 'engenharia' then
    raise exception 'Seu perfil não pode executar esta ação';
  end if;
  delete from chamados where demo;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.abrir_chamado(jsonb) from anon, public;
revoke execute on function public.executar_acao(uuid, text, jsonb) from anon, public;
revoke execute on function public.revisar_chamado(uuid, text) from anon, public;
revoke execute on function public.limpar_demo() from anon, public;
grant execute on function public.abrir_chamado(jsonb) to authenticated;
grant execute on function public.executar_acao(uuid, text, jsonb) to authenticated;
grant execute on function public.revisar_chamado(uuid, text) to authenticated;
grant execute on function public.limpar_demo() to authenticated;

-- ============================================================ realtime
alter publication supabase_realtime add table
  public.chamados, public.maquinas, public.subdivisoes, public.erros, public.config, public.perfis;
