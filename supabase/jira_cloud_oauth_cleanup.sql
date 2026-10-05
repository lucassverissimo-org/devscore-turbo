drop trigger if exists set_jira_connections_updated_at on public.jira_connections;

drop table if exists public.jira_oauth_states;
drop table if exists public.jira_connections;

-- Mantem public.jira_sprint_cache porque o modo Jira Data Center/PAT usa esta tabela
-- para evitar chamadas repetidas ao Jira.
