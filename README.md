# devscore-turbo

## Integracao Jira

A integracao com Jira usa Supabase Edge Functions para manter tokens fora do front-end.

### Jira Data Center/Server com PAT

Este e o modo usado para `https://agile.corp.edp.pt`.

1. Rode o SQL `supabase/jira_integration.sql` no projeto Supabase depois do schema base.
2. Se voce ja rodou o SQL antigo de OAuth Cloud e vai usar apenas PAT, rode `supabase/jira_cloud_oauth_cleanup.sql`.
3. Cadastre os secrets das Edge Functions:

```bash
supabase secrets set JIRA_BASE_URL=https://agile.corp.edp.pt
supabase secrets set JIRA_PAT=<token-de-acesso-pessoal-do-jira>
supabase secrets set JIRA_SITE_NAME="Jira EDP"
supabase secrets set JIRA_SPRINT_CACHE_TTL_SECONDS=900
```

Opcionalmente configure `JIRA_STORY_POINTS_FIELD` para importar story points como pontos Dev.

Depois publique as funcoes usadas pelo modo PAT:

```bash
supabase functions deploy jira-connection-status
supabase functions deploy jira-import-sprint
```

O token fica apenas no backend. No front, usuarios `SCRUM` ou `ADMIN` veem a conexao como configurada pelo backend.

### Jira Cloud OAuth 2.0

Use este modo apenas para Jira Cloud.

1. Crie um app OAuth 2.0 (3LO) na Atlassian Developer Console.
2. Configure a callback URL como `https://<seu-projeto>.supabase.co/functions/v1/jira-oauth-callback`.
3. Cadastre os secrets das Edge Functions:

```bash
supabase secrets set ATLASSIAN_CLIENT_ID=...
supabase secrets set ATLASSIAN_CLIENT_SECRET=...
supabase secrets set ATLASSIAN_REDIRECT_URI=https://<seu-projeto>.supabase.co/functions/v1/jira-oauth-callback
supabase secrets set APP_BASE_URL=https://<seu-dominio>
supabase secrets set JIRA_TOKEN_ENCRYPTION_KEY=<chave-com-32-ou-mais-caracteres>
```

Depois publique as funcoes OAuth:

```bash
supabase functions deploy jira-oauth-start
supabase functions deploy jira-oauth-callback
supabase functions deploy jira-connection-status
supabase functions deploy jira-disconnect
supabase functions deploy jira-import-sprint
```
- Organizar distribuição de pontuação entre os devs.

## Dev Tools: DevScore e Jira Sprint Timesheet Helper

### Stack e arquitetura

A stack existente foi mantida: React 18, Vite 4, TypeScript, Tailwind CSS, lucide-react, ExcelJS e Supabase. O gerenciador continua sendo npm, com `package-lock.json`. Não havia roteador, testes, lint ou configuração Netlify versionada. A navegação usa a History API, sem adicionar um framework ou uma biblioteca de rotas.

- `/`: hub com as duas ferramentas.
- `/devscore`: aplicação existente, com planejamento, distribuição, histórico, autenticação e integração Jira Supabase preservados.
- `/timesheet`: integração com seletor **Tipo de Jira**: Cloud ou Data Center (PAT). A integração de importação de Sprint do DevScore continua independente.

O `App.tsx` original permanece responsável pelo DevScore. A única limpeza interna remove o nome de uma variável de estado não utilizada, mantendo seu setter e comportamento. A entrada `main.tsx` monta `ToolHub.tsx`. O tema existente é compartilhado.

Arquivos novos principais:

- `src/ToolHub.tsx`: navegação e home.
- `src/features/timesheet/Timesheet.tsx`: etapas e controle dos apontamentos em memória; conexão validada guardada no sessionStorage.
- `AnalysisView.tsx`, `EntryGrid.tsx`, `ui.tsx`: análise, edição e estilos consistentes com o DevScore.
- `types.ts`, `dates.ts`, `distribution.ts`, `validation.ts`, `csv.ts`, `submission.ts`, `api.ts`: domínio, calendário, distribuição, validações, exportação e transporte.
- `netlify/functions/jira.mts`: Function ESM com ações `test`, `boards`, `sprints`, `sprint`, `users`, `analysis` e `create`.
- `netlify/lib/jira.ts`, `netlify/lib/analysis.ts`: cliente autenticado, paginação e leitura Jira.
- `tests/`: testes de domínio, contrato Jira, segurança e regressão DevScore; teste real de leitura com opt-in.

Os helpers visuais novos usam as classes Tailwind, tipografia, cores, cards e tema já adotados; não há uma biblioteca de componentes genéricos no projeto existente. A integração não utiliza o token Jira Data Center do DevScore.

### Executar localmente

Requer Node.js 22.13 ou superior e npm. Copie `.env.example` para `.env` (ignorado pelo Git), preenchendo apenas as variáveis necessárias. As variáveis `VITE_SUPABASE_*` continuam públicas e destinadas ao cliente Supabase; não use nelas credenciais Jira ou service-role keys.

```bash
npm install
npm run dev:netlify
```

Abra `http://localhost:8888`. Esse comando inicia Vite e Netlify Functions juntos. Você também pode usar `npm run dev` e abrir a URL exibida pelo Vite (normalmente `http://localhost:5173`): um adaptador somente de desenvolvimento executa o mesmo backend Jira nessa porta. Credenciais e variáveis Jira permanecem no servidor; a autenticação e as validações são compartilhadas com a Function. Reinicie o servidor se tiver iniciado antes da inclusão de `vite.config.ts`. `npm run dev:prod`, `build:dev`, `build:prod` e `preview` foram preservados. `npm run preview` apenas serve o build estático e não executa a API.

```bash
npm run lint
npm run test
npm run build
```

Lint executa ESLint e TypeScript (incluindo a Function e os testes). O código Supabase/Deno preexistente permanece fora dessa configuração Node; não foi reescrito. Os testes usam Vitest e não escrevem no Jira.

### Configuração Netlify

`netlify.toml` fixa Node.js 22 (compatível com a versão local usada na validação) e mantém o build `npm run build`, publicação `dist`, Functions em `netlify/functions` e bundler esbuild. A Function `.mts` usa o formato ESM atual do Netlify. Os redirects servem `index.html` nas rotas dos módulos, permitindo acesso direto e refresh sem interceptar assets ou módulos Vite no Netlify Dev.

Cadastre secrets **no escopo Functions** do Netlify, sem prefixo `VITE_`:

```env
JIRA_BASE_URL=https://seu-site.atlassian.net
JIRA_EMAIL=conta-jira@example.com
JIRA_API_TOKEN=token-da-conta-jira
JIRA_DC_BASE_URL=https://agile.corp.edp.pt
JIRA_DC_PAT=pat-da-conta-jira
JIRA_DC_ALLOWED_BASE_URLS=
JIRA_TIMEZONE=America/Fortaleza
JIRA_DEPLOY_ALLOWED_USER_IDS=uuid-supabase-autorizado,outro-uuid-autorizado
```

`JIRA_TIMEZONE` é opcional e assume `America/Fortaleza`. Credenciais temporárias dispensam os secrets de conexão e `JIRA_DEPLOY_ALLOWED_USER_IDS`. No modo Cloud, a URL aceita somente tenants HTTPS `*.atlassian.net`, sem paths, portas extras ou credenciais na URL. Usa e-mail + API Token com Basic Auth e REST v3. Tokens Cloud com scopes e o gateway `api.atlassian.com` não são suportados.

No modo Data Center, informe URL + PAT; e-mail não é necessário. A conexão usa Bearer Auth e REST v2, pesquisa por username e paginação por `startAt`. Comentários de worklogs são texto, enquanto no Cloud são ADF. O campo interno `accountId` representa o user key estável no Data Center; o username usado em JQL vem do servidor. A URL `https://agile.corp.edp.pt` já está autorizada. Para outros servidores, configure bases HTTPS exatas em `JIRA_DC_ALLOWED_BASE_URLS`, separadas por vírgula. A base definida em `JIRA_DC_BASE_URL` também é autorizada, inclusive com contexto `/jira`. Destinos fora dessa lista e redirects são recusados antes de transmitir o PAT.

Para testar agora: selecione **Jira Data Center (PAT)**, informe seu PAT e clique **Conectar**. A tela usa somente credenciais informadas pelo usuário, sem seletor de modo de conexão. Ao validar a conexão, tipo de Jira, URL, e-mail e PAT/API Token são guardados no `sessionStorage`. Reabrir o módulo ou atualizar a página restaura os campos e testa automaticamente a conexão. Uma tentativa inválida não sobrescreve a última conexão validada. **Desconectar e limpar credenciais** apaga essa conexão da sessão. Trocar o tipo de Jira limpa os campos da tela e os dados da análise. O servidor que executa a Function precisa alcançar o Jira corporativo.

O backend mantém compatibilidade com chamadas autenticadas usando secrets do deploy, mas essa opção não está disponível na interface. Nesse caminho, valida o JWT em `/auth/v1/user` e verifica `JIRA_DEPLOY_ALLOWED_USER_IDS` antes de usar qualquer segredo Jira. Sem allowlist, esse caminho falha fechado. A tela sempre envia as credenciais informadas pelo usuário.

Depois de mudar secrets, faça um novo deploy. Nenhuma configuração remota ou publicação foi feita automaticamente por esta alteração.

### Conexão, permissões e identidade

Escolha **Tipo de Jira** antes de conectar. Para Cloud, crie o API Token na conta Atlassian e informe URL, e-mail e token. Para Data Center, crie um Personal Access Token na sua conta Jira e informe URL + PAT. Clique **Conectar**: a Function usa `/rest/api/3/myself` no Cloud ou `/rest/api/2/myself` no Data Center e retorna somente usuário, timezone e URL pública.

**Worklogs somente podem ser registrados utilizando a identidade Jira autenticada.**

A busca e seleção usam `accountId`. Outro usuário pode ser analisado e seus lançamentos podem ser preparados, editados e exportados. O botão de registro e a validação server-side bloqueiam o registro se a identidade selecionada for diferente da autenticada. O corpo de criação nunca define `author`.

A conta precisa de acesso ao Jira Software e de permissão para visualizar Sprint, projetos e issues, incluindo a segurança da issue. Para buscar pessoas, precisa de **Browse users and groups**. Para registrar, precisa de **Work on issues**; essa permissão é conferida no contexto da issue imediatamente antes da criação. O controle de tempo Jira precisa estar habilitado. Restrições de visibilidade de worklogs podem reduzir os dados retornados.

### Fluxo e algoritmo

Após conectar, selecione o board Scrum e escolha a Sprint pelo nome. A listagem usa `/rest/agile/1.0/board` e `/rest/agile/1.0/board/{boardId}/sprint`, com paginação, tanto no Cloud quanto no Data Center. Mostra somente boards/Sprints visíveis à conta; Sprints ativas vêm primeiro, depois futuras e concluídas. Não é preciso informar IDs. Ajuste o período inclusivo e a jornada (8h por padrão). Datas da Sprint preenchem somente campos ainda vazios, preservando o período já informado; você pode escolher datas fora desse intervalo. O board organiza a lista de Sprints, e a Sprint seleciona as issues atribuídas ao usuário, sem filtro de tipo. As datas inicial e final definem independentemente os dias para análise e registro de horas.

A busca usa `/rest/api/3/search/jql` com `nextPageToken`, sem os endpoints de busca removidos. Worklogs são paginados separadamente por issue: não se assume que o campo inline worklog está completo. Também são buscadas issues com worklogs do usuário no período (incluindo issues fora da Sprint). A busca amplia em um dia cada extremidade para acomodar a diferença entre timezone JQL e o timezone escolhido; a classificação final é feita pelo timestamp do worklog no timezone da aplicação.

Todos os cálculos usam segundos inteiros. Para cada issue:

```text
saldo = max(0, originalEstimateSeconds - timeSpentSeconds global da issue)
excesso = max(0, timeSpentSeconds - originalEstimateSeconds), quando há estimativa
capacidade diária = max(0, jornada - worklogs visíveis do usuário no dia)
```

Issues sem estimativa original não usam Remaining Estimate como substituto e não recebem sugestões automáticas. A capacidade automática considera segunda a sexta. A política de calendário é injetável para futuras regras de feriados, afastamentos ou jornadas especiais.

O algoritmo é puro, determinístico e ordena issues por key e dias cronologicamente. Preenche blocos grandes respeitando saldo e capacidade, sem inventar horas para completar a jornada. Retorna totais de horas existentes, disponíveis, sugeridas, não alocadas e saldo não distribuído. A edição usa horas decimais na interface (0.5 = 30 minutos, 0.75 = 45 minutos, 1.25 = 1h15, 1.5 = 1h30), incrementos de 0.25 hora e mantém segundos no domínio; valores inválidos digitados não são corrigidos silenciosamente.

A grade permite adicionar, remover, editar issue/data/duração/comentário, duplicar, dividir e desfazer alterações. Depois de uma edição, totais e validações são recalculados. Dividir um lançamento em dois blocos idênticos na mesma issue/data produz alerta de duplicidade: ajuste as datas/durações ou remova um bloco antes do envio.

A revisão e a confirmação são etapas separadas. A confirmação exige reconhecer explicitamente os dados e avisos. ERROR bloqueia envio; WARNING permite excessos manuais apenas depois da confirmação. O backend recarrega Sprint, usuário, issues e worklogs antes de cada criação e verifica permissões, identidade, período, duração, saldo e duplicidade.

O registro é sequencial, com progresso e bloqueio de edição/duplo envio. Falhas individuais não interrompem itens seguintes, exceto quando o Jira retorna 429: os itens restantes são adiados para respeitar `Retry-After`, sem retry automático de POST. Sucessos guardam o Worklog ID e não são reenviados no retry. Timeout, falha de rede ou 5xx durante uma escrita podem ter resultado incerto: confira a issue no Jira; a tela exige essa revisão antes de liberar nova tentativa. Duplicidades existentes continuam bloqueadas na revalidação.

A criação usa comentário em Atlassian Document Format e `adjustEstimate=leave`. Não altera Original Estimate nem Remaining Estimate. Worklogs existentes são somente leitura.

### CSV e timezone

O CSV é gerado a partir do estado da tela, nas etapas análise, revisão, confirmação e resultado. Usa UTF-8 com BOM, delimitador vírgula, aspas escapadas e proteção contra fórmulas Excel. A análise exporta os totais globais por issue com origem explicitamente identificada; demais etapas incluem worklogs existentes e lançamentos preparados/resultados, sem duplicar sucessos da sessão. As colunas incluem os campos solicitados e Worklog ID, resultado e erro quando disponíveis. Credenciais nunca entram no CSV.

Nome: `jira-timesheet-YYYY-MM-DD-a-YYYY-MM-DD.csv`. A data lógica de worklogs usa `Intl.DateTimeFormat` no timezone do servidor, sem depender do timezone do navegador. Novos apontamentos começam às 09:00 da data local escolhida, com conversão de offset e DST centralizada em `dates.ts`.

### Segurança e limitações

- PAT/API Token não entra no bundle, URLs, localStorage, CSV, respostas ou logs da aplicação. Por solicitação do usuário, a conexão validada fica no sessionStorage da aba, inclusive o token. Atualizar a página ou sair do módulo mantém a conexão nessa sessão; desconectar apaga os dados. Evite habilitar logs de corpo de requisições em serviços externos.
- Erros upstream são convertidos em mensagens controladas; não se devolve corpo Jira, stack trace ou credenciais. A Function tem timeout por chamada, rejeita origem diferente e não segue redirects do Jira.
- A capacidade usa somente worklogs visíveis à conta conectada. O índice JQL pode estar atrasado e restrições podem ocultar dados. Se a busca externa à Sprint retornar 400/403, a análise usa apenas as issues da Sprint e mostra aviso específico. Confira os apontamentos na conta Jira antes de registrar.
- Não há feriados, férias ou atividade/histórico como heurística nesta primeira versão; segunda a sexta é a política padrão.
- Até 367 dias por análise e 5.000 issues por busca. Leituras de worklogs são sequenciais; Sprints grandes podem atingir o timeout da plataforma. Reduza o período ou processe lotes menores.
- O Jira não fornece transação atômica para validar saldo e criar worklog. Não há garantia de exactly-once entre abas, deploys ou processos diferentes: evita-se duplo clique na tela, conferem-se duplicidades e bloqueiam-se resultados incertos, mas não há lock distribuído. Não execute o mesmo lote em duas abas simultaneamente.
- Para registrar como outra pessoa, conecte usando as credenciais Jira dessa pessoa.
- O projeto já usa dependências antigas. `npm audit` ainda reporta vulnerabilidades na árvore (inclusive Vite/Tailwind/ExcelJS e dependências de ferramentas). Uma atualização de majors não foi incluída para preservar a stack e evitar mudanças alheias ao pedido. O Vitest adicionado foi atualizado para uma versão corrigida, sem substituir o Vite de build da aplicação.

### Validar integração real

Sem credenciais Jira fornecidas, o teste real é pulado; os testes automatizados injetam respostas no formato documentado no transporte e executam o cliente, a Function e as regras reais para Cloud e Data Center. O Netlify Dev permite validar o caminho navegador → Function mesmo sem secrets, retornando erros seguros. Isso não comprova leitura ou escrita autenticada em um Jira real.

Para um teste real **somente de leitura**, defina `JIRA_BASE_URL`, `JIRA_EMAIL` e `JIRA_API_TOKEN` no ambiente do processo, e execute no PowerShell:

```powershell
$env:JIRA_LIVE_TEST = '1'
npm run test -- tests/jira-live.test.ts
Remove-Item Env:JIRA_LIVE_TEST
```

Para o teste de leitura Data Center, configure `JIRA_DC_BASE_URL` e `JIRA_DC_PAT` e defina também `$env:JIRA_LIVE_DEPLOYMENT = 'data-center'` antes do comando. Remova essa variável depois. Nenhum desses testes cria worklogs.

Depois, com Netlify Dev, teste conexão, Sprint ID, busca de usuário e análise em um tenant de teste. Compare manualmente estimativa/saldo e os worklogs fora da Sprint. Prepare e exporte um lote, revise, edite na confirmação e confirme **um único lançamento de teste**. Confira autor, Worklog ID, duração, comentário e estimativas inalteradas no Jira. Teste duplicidade e retry somente com dados descartáveis. Esse teste de escrita exige a confirmação explícita no produto.

Documentação oficial consultada:

- [Sprint Jira Software Cloud](https://developer.atlassian.com/cloud/jira/software/rest/api-group-sprint/)
- [Busca JQL atual](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
- [Myself](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/)
- [Busca de usuários](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-user-search/)
- [Worklogs, paginação e criação](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/)
- [Permissões por issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permissions/)
- [REST v2 Data Center: usuários, buscas, permissões e worklogs](https://docs.atlassian.com/software/jira/docs/api/REST/9.12.0/)
- [Personal Access Tokens Data Center](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)

A navegação também preserva retornos OAuth Jira legados na raiz (`/?jira=...`), direcionando-os ao DevScore com os parâmetros intactos para seu tratamento original. `useTimesheet.ts` concentra o estado e `Configuration.tsx` isola o formulário de conexão/configuração.

Na revalidação, a leitura direta de cada issue complementa a busca JQL para evitar saldos baseados apenas no índice de pesquisa. Avisos novos entre revisão e criação bloqueiam o envio até serem reconhecidos. Worklog IDs e resultados incertos também ficam em um registro de memória da sessão, impedindo reenvio automático mesmo após uma nova análise na mesma tela.

Com `npm run dev:netlify` em execução, rode `npm run test:functions` em outro terminal. O script verifica as três rotas, o formato JSON da Function, a recusa de acesso anônimo ao deploy, SSRF, origem externa e ausência do token de teste na resposta, usando HTTP real local. Não acessa um tenant Jira nem cria worklogs.

A configuração de runtime segue a [documentação de Functions Netlify](https://docs.netlify.com/build/functions/configuration/?fn-language=js): o runtime padrão acompanha o Node.js válido utilizado no build. Se o site já tiver `AWS_LAMBDA_JS_RUNTIME` definido externamente, configure `nodejs22.x` na UI/CLI do Netlify, pois esse override não pode ser definido em `netlify.toml`.

Resultados desta implementação e limites da validação estão registrados em [VERIFICATION.md](VERIFICATION.md).
