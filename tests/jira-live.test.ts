import { expect, it } from 'vitest'
import { handle } from '../netlify/functions/jira.mts'
// Explicit opt-in: this real integration test is read-only and never creates worklogs.
it.skipIf(process.env.JIRA_LIVE_TEST !== '1')(
  'conexão real Netlify handler → Jira /myself',
  async () => {
    const deployment =
      process.env.JIRA_LIVE_DEPLOYMENT === 'data-center'
        ? 'data-center'
        : 'cloud'
    const credentials = {
      deployment,
      baseUrl:
        deployment === 'data-center'
          ? process.env.JIRA_DC_BASE_URL
          : process.env.JIRA_BASE_URL,
      email: deployment === 'data-center' ? '' : process.env.JIRA_EMAIL,
      token:
        deployment === 'data-center'
          ? process.env.JIRA_DC_PAT
          : process.env.JIRA_API_TOKEN,
    }
    const response = await handle(
      new Request('http://localhost/.netlify/functions/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', credentials }),
      })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user: { accountId: string } }
    expect(body.user.accountId).toBeTruthy()
  },
  60000
)
