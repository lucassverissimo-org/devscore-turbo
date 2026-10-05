# Verificação — 03/10/2026

| Verificação | Resultado |
| --- | --- |
| npm install | Executado com npm; lockfile atualizado |
| npm run lint | Passou: ESLint e TypeScript, incluindo frontend, Function e testes |
| npm run test | 93 testes passaram; 1 teste real Jira foi pulado por falta de credenciais |
| npm run test:functions | 9 verificações HTTP reais passaram em cada porta: Netlify 8888 e Vite 5173 |
| npm run build | Passou com Vite 4.5.14 |
| Bundle frontend | Não contém JIRA_API_TOKEN ou JIRA_EMAIL server-side |
| Desktop/mobile | Hub e configuração Timesheet verificados no navegador, incluindo 390px |

DevScore foi exercitado manualmente no modo local: cadastro de desenvolvedor, capacidade 40, apontamento de 8 pontos, saldo 32, histórico, exclusão de histórico e remoção do desenvolvedor de teste. O planejamento Sprint existente abriu com seus controles e restrições de perfil preservados. A consulta ao Supabase configurado falhou por rede; não foi possível validar leitura/gravação remota autenticada. Nenhum dado remoto foi alterado.

Os testes da interface cobrem configuração → análise → sugestão → revisão → confirmação → resultado, edição em horas decimais com totais atualizados, bloqueio de outro usuário, conexão validada no sessionStorage, restauração automática para Cloud e Data Center, desconexão, falha de autenticação sem persistência, duplicidade e desfazer. Os testes da Function usam o transporte injetável para percorrer APIs, paginação, erros, permissões, dados frescos e criação real do corpo de requisição. O smoke test HTTP usa a Function em execução, sem mocks.

O seletor Cloud/Data Center foi acrescentado ao Timesheet. Os testes Data Center verificam Bearer/PAT sem e-mail, REST v2, identidade por user key, JQL com username obtido no servidor, todas as páginas de issues/worklogs, comentário em texto, bloqueio de outro usuário, destinos autorizados e corpo de criação sem alterações de estimativas. A interface usa somente credenciais informadas, sem seletor de modo deploy. As duas mensagens informativas solicitadas foram removidas. O período pode ficar antes ou depois das datas da Sprint; isso foi validado na análise e no registro.

O erro 404 informado em localhost:5173 veio da ausência do backend Jira no Vite. Foi adicionado um adaptador local que executa o mesmo handler da Function, com limite de corpo, proteção de origem e respostas sem cache. O servidor foi reiniciado e as duas portas responderam em JSON. Uma chamada de leitura via Vite ao Jira corporativo com PAT fictício recebeu 401 em JSON, confirmando o transporte até o servidor sem usar credenciais reais. A autenticação foi comparada com `equalizador-promax/src/equalizador_promax/jira_client.py`, que também usa token/PAT e `myself()`.

A escolha de Sprint agora usa listas de boards Scrum e Sprints, sem pedir IDs. Testes Cloud/Data Center verificam endpoints Agile, autenticação, paginação completa, ordem de apresentação e recusa de Board ID inválido. O teste de interface cobre seleção de board/Sprint, limpeza ao trocar de board e preservação do período informado.

As chamadas autenticadas a um Jira e a criação real de worklogs não foram executadas: não foram fornecidas credenciais para execução dos testes. O README documenta o teste real opt-in de leitura para ambos os tipos e a validação de escrita em ambiente de teste com confirmação no produto.

Build emite avisos de Browserslist desatualizado e chunk ExcelJS acima de 500 kB. Não impedem o build. npm audit reportou 34 vulnerabilidades na árvore instalada (2 low, 7 moderate, 25 high), incluindo dependências existentes e ferramentas de desenvolvimento; não foi feita atualização forçada de majors.

A configuração Netlify foi adicionada e a Function ESM carregou localmente. Não houve publicação remota, commit ou alteração de secrets do Netlify. As alterações Jira/Supabase que já estavam no working tree foram preservadas.
