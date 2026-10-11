-- Classes de prioridade passam a ser P0, P1, P2 e P3; P4 sai.
-- Com os pesos atuais o menor score base possível é 31,4, acima do antigo limiar de P3 (30),
-- então P4 nunca era atribuída pelo cálculo. P3 passa a cobrir todo score efetivo abaixo de P2 (50).

-- Config gravada: sobrepõe o padrão do código, então a mudança precisa chegar ao banco.
update public.config
set dados = jsonb_set(
  (dados #- '{limiares,P3}') #- '{metaInicioMin,P4}',
  '{versao}', '2'::jsonb, true)
where id = 'priorizacao';

-- Chamados já gravados com P4 (classe calculada ou ajuste do líder) viram P3.
update public.chamados
set prioridade = jsonb_set(prioridade, '{classeBase}', '"P3"'::jsonb)
where prioridade->>'classeBase' = 'P4';

update public.chamados
set override = jsonb_set(override, '{classe}', '"P3"'::jsonb)
where override->>'classe' = 'P4';

-- executar_acao: "priorizar" deixa de aceitar P4. O restante é igual ao da migração 20261010000006.

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
  -- coalesce: sem perfil (operador anônimo), v_papel é NULL e não entra na equipe.
  v_equipe boolean := coalesce(v_papel in ('mantenedor', 'lider'), false);
  v_lider boolean := coalesce(v_papel = 'lider', false);
  -- Produção: operador anônimo (sem perfil, v_papel NULL), papel 'operador' ou o líder.
  v_producao boolean := v_papel is null or v_papel in ('operador', 'lider');
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
      if not v_producao then
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
      if coalesce(p_dados->>'classe', '') not in ('P0', 'P1', 'P2', 'P3') then raise exception 'Escolha a classe'; end if;
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

revoke execute on function public.executar_acao(uuid, text, jsonb) from anon, public;
grant execute on function public.executar_acao(uuid, text, jsonb) to authenticated;
