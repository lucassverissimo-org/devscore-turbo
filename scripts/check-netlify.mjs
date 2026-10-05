import assert from 'node:assert/strict'
const base = process.env.NETLIFY_TEST_URL || 'http://localhost:8888'
const endpoint = `${base}/.netlify/functions/jira`
const send = async (payload, origin) =>
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(payload),
  })
const method = await fetch(endpoint)
assert.equal(method.status, 405)
assert.match(method.headers.get('content-type'), /application\/json/)
const blocked = await send({
  action: 'test',
  credentials: {
    baseUrl: 'http://127.0.0.1',
    email: 'test@example.com',
    token: 'dummy-test-token',
  },
})
assert.equal(blocked.status, 400)
const body = await blocked.json()
assert.ok(!JSON.stringify(body).includes('dummy-test-token'))
assert.equal(blocked.headers.get('cache-control'), 'no-store')
const dcBlocked = await send({
  action: 'test',
  deployment: 'data-center',
  credentials: {
    baseUrl: 'https://untrusted.example',
    email: '',
    token: 'dummy-pat',
  },
})
assert.equal(dcBlocked.status, 403)
assert.ok(!JSON.stringify(await dcBlocked.json()).includes('dummy-pat'))
const invalidDeployment = await send({
  action: 'test',
  deployment: 'invalid',
  credentials: {
    baseUrl: 'https://agile.corp.edp.pt',
    email: '',
    token: 'dummy-pat',
  },
})
assert.equal(invalidDeployment.status, 400)
const csrf = await send({ action: 'test' }, 'https://evil.example')
assert.equal(csrf.status, 403)
const deploy = await send({ action: 'test' })
assert.ok(
  [401, 403].includes(deploy.status),
  'Deploy não deve permitir conexão sem sessão autorizada.'
)
for (const path of ['/', '/devscore', '/timesheet']) {
  const response = await fetch(base + path)
  assert.equal(response.status, 200)
  assert.match(await response.text(), /<div id="root"><\/div>/)
}
console.log(
  `API local (${base}): 9 verificações HTTP reais passaram; nenhuma escrita Jira foi executada.`
)
