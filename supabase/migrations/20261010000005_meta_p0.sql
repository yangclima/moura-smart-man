-- Meta de início do atendimento da classe P0 passa de 0 (imediato) para 10 minutos.
-- A config gravada sobrepõe o padrão do código, então a mudança precisa chegar ao banco.
update public.config
set dados = jsonb_set(dados, '{metaInicioMin,P0}', '10'::jsonb, true)
where id = 'priorizacao';
