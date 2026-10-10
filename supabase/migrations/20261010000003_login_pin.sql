-- Login por PIN de 6 dígitos (sem e-mail). O PIN nunca é guardado em texto:
-- só o HMAC-SHA256 com o segredo PIN_SEGREDO do servidor. As duas tabelas
-- abaixo não têm políticas de RLS: só a chave secreta (rotas do servidor) acessa.

create table public.pins (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  pin_hash text not null unique,
  atualizado_em timestamptz not null default now()
);
alter table public.pins enable row level security;
revoke all on public.pins from anon, authenticated;

-- PINs errados por IP, para limitar tentativas de adivinhação.
create table public.tentativas_login (
  id bigint generated always as identity primary key,
  ip text not null,
  em timestamptz not null default now()
);
create index on public.tentativas_login (ip, em);
alter table public.tentativas_login enable row level security;
revoke all on public.tentativas_login from anon, authenticated;

-- Desativar uma pessoa sem apagar o histórico dos chamados dela.
alter table public.perfis add column ativo boolean not null default true;
