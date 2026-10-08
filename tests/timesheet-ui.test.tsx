// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Timesheet from '../src/features/timesheet/Timesheet'
import { CONNECTION_SESSION_KEY } from '../src/features/timesheet/connectionSession'
import type { Analysis, JiraUser } from '../src/features/timesheet/types'
const user = { accountId: 'me', displayName: 'Lucas' }
const other = { accountId: 'other', displayName: 'João' }
const sprint = {
  id: 123,
  name: 'Sprint 64',
  state: 'active',
  startDate: '2026-10-05T12:00:00Z',
  endDate: '2026-10-06T12:00:00Z',
}
function data(selected: JiraUser = user): Analysis {
  return {
    sprint,
    user: selected,
    authenticatedUser: user,
    baseUrl: 'https://example.atlassian.net',
    timezone: 'America/Fortaleza',
    warnings: [],
    worklogs: [],
    issues: [
      {
        id: '1',
        key: 'ABC-1',
        summary: 'Uma task',
        issueType: 'Task',
        status: 'Active',
        assignee: selected,
        originalEstimateSeconds: 21600,
        remainingEstimateSeconds: 3600,
        timeSpentSeconds: 0,
      },
    ],
  }
}
vi.mock('../src/features/timesheet/api', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/features/timesheet/api')>()
  return {
    ...original,
    testConnection: vi.fn(),
    getSprint: vi.fn(),
    getBoards: vi.fn(),
    getSprints: vi.fn(),
    getAnalysis: vi.fn(),
    findUsers: vi.fn(),
    createWorklog: vi.fn(),
  }
})
import {
  createWorklog,
  findUsers,
  getAnalysis,
  getSprint,
  getBoards,
  getSprints,
  testConnection,
} from '../src/features/timesheet/api'
beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.mocked(testConnection).mockResolvedValue({
    user,
    timezone: 'America/Fortaleza',
    baseUrl: 'https://example.atlassian.net',
  })
  vi.mocked(getSprint).mockResolvedValue(sprint)
  vi.mocked(getBoards).mockResolvedValue([
    { id: 7, name: 'Equipe', type: 'scrum' },
  ])
  vi.mocked(getSprints).mockResolvedValue([sprint])
  vi.mocked(getAnalysis).mockImplementation(async (_id, selected) =>
    data(selected)
  )
  vi.mocked(findUsers).mockResolvedValue([other])
  vi.mocked(createWorklog).mockResolvedValue({ id: 'created-1' })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
async function configure() {
  const actions = userEvent.setup()
  render(<Timesheet />)
  await actions.click(screen.getByRole('button', { name: 'Conectar' }))
  await screen.findByText('Conectado como: Lucas')
  await screen.findByRole('option', { name: 'Equipe' })
  await actions.selectOptions(screen.getByLabelText('Board'), '7')
  await screen.findByRole('option', { name: 'Sprint 64 · Ativa' })
  await actions.selectOptions(screen.getByLabelText('Sprint'), '123')
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Consultar tasks e saldos',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  )
  return actions
}
describe('fluxo Timesheet na interface', () => {
  it('lista Sprints do board e limpa a seleção ao trocar de board, preservando o período', async () => {
    const actions = await configure()
    expect(screen.queryByLabelText('Sprint ID')).toBeNull()
    expect(getSprints).toHaveBeenCalledWith(7, expect.any(Object), 'cloud')
    expect(screen.queryByLabelText('Data inicial')).toBeNull()
    await actions.click(
      screen.getByRole('button', { name: 'Consultar tasks e saldos' })
    )
    await screen.findByRole('heading', {
      name: 'Quando você quer registrar as horas?',
    })
    const readsBeforeEditingPeriod = vi.mocked(getAnalysis).mock.calls.length
    fireEvent.change(screen.getByLabelText('Data inicial'), {
      target: { value: '2026-09-28' },
    })
    fireEvent.change(screen.getByLabelText('Data final'), {
      target: { value: '2026-09-30' },
    })
    expect(getAnalysis).toHaveBeenCalledTimes(readsBeforeEditingPeriod)
    await actions.click(screen.getByRole('button', { name: 'Gerar sugestão' }))
    await screen.findByRole('button', { name: 'Revisar apontamentos' })
    expect(getAnalysis).toHaveBeenLastCalledWith(
      123,
      user,
      expect.objectContaining({ start: '2026-09-28', end: '2026-09-30' }),
      expect.any(Object),
      'cloud'
    )
    await actions.selectOptions(screen.getByLabelText('Board'), '')
    expect((screen.getByLabelText('Sprint') as HTMLSelectElement).value).toBe(
      ''
    )
    expect(
      (
        screen.getByRole('button', {
          name: 'Consultar tasks e saldos',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    await actions.selectOptions(screen.getByLabelText('Board'), '7')
    await screen.findByRole('option', { name: 'Sprint 64 · Ativa' })
    await actions.selectOptions(screen.getByLabelText('Sprint'), '123')
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Consultar tasks e saldos',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    )
    await actions.click(
      screen.getByRole('button', { name: 'Consultar tasks e saldos' })
    )
    await screen.findByRole('heading', {
      name: 'Quando você quer registrar as horas?',
    })
    expect(
      (screen.getByLabelText('Data inicial') as HTMLInputElement).value
    ).toBe('2026-09-28')
    expect(
      (screen.getByLabelText('Data final') as HTMLInputElement).value
    ).toBe('2026-09-30')
  })
  it('alterna Cloud/Data Center e usa somente credenciais informadas', async () => {
    const actions = userEvent.setup()
    render(<Timesheet />)
    await actions.type(screen.getByLabelText('API Token'), 'cloud-secret')
    await actions.selectOptions(
      screen.getByLabelText('Tipo de Jira'),
      'data-center'
    )
    expect(screen.queryByLabelText('E-mail Jira')).toBeNull()
    expect(
      (screen.getByLabelText('PAT (Personal Access Token)') as HTMLInputElement)
        .value
    ).toBe('')
    expect(
      (screen.getByLabelText('Jira Base URL') as HTMLInputElement).value
    ).toBe('https://agile.corp.edp.pt')
    await actions.type(
      screen.getByLabelText('PAT (Personal Access Token)'),
      'dummy-pat'
    )
    await actions.click(screen.getByRole('button', { name: 'Conectar' }))
    await screen.findByText('Conectado como: Lucas')
    expect(testConnection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deployment: 'data-center',
        email: '',
        token: 'dummy-pat',
      }),
      'data-center'
    )
    expect(screen.queryByLabelText('Modo de conexão')).toBeNull()
    expect(
      screen.queryByText(/Use um PAT da sua própria conta Jira/)
    ).toBeNull()
    await actions.selectOptions(screen.getByLabelText('Tipo de Jira'), 'cloud')
    expect((screen.getByLabelText('API Token') as HTMLInputElement).value).toBe(
      ''
    )
    expect(screen.queryByLabelText('PAT (Personal Access Token)')).toBeNull()
  })
  it('edita na confirmação, recalcula totais e só escreve após confirmação', async () => {
    const actions = await configure()
    await actions.click(
      screen.getByRole('button', { name: 'Consultar tasks e saldos' })
    )
    await screen.findByRole('heading', { name: 'Análise da Sprint' })
    await actions.click(screen.getByRole('button', { name: 'Gerar sugestão' }))
    expect(createWorklog).not.toHaveBeenCalled()
    await actions.click(
      screen.getByRole('button', { name: 'Revisar apontamentos' })
    )
    await actions.click(
      screen.getByRole('button', { name: 'Ir para confirmação' })
    )
    const submit = screen.getByRole('button', {
      name: 'Confirmar e registrar no Jira',
    }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    expect(
      screen.getByRole('list', { name: 'Lançamentos a registrar' }).textContent
    ).toContain('05/10/2026: ABC-1 => 6h')
    await actions.click(screen.getByText('Editar lançamentos antes de enviar'))
    const hours = screen.getByRole('spinbutton', { name: /Horas auto-/ })
    for (const [value, total] of [
      ['0.5', '30m'],
      ['1.5', '1h 30m'],
      ['0.75', '45m'],
      ['1.25', '1h 15m'],
    ]) {
      fireEvent.change(hours, { target: { value } })
      expect(
        screen.getByText(`Serão criados: 1 worklogs · Total: ${total}`)
      ).toBeTruthy()
      expect(
        screen.getByRole('list', { name: 'Lançamentos a registrar' })
          .textContent
      ).toContain(`05/10/2026: ABC-1 => ${total}`)
    }
    fireEvent.change(hours, { target: { value: '2' } })
    expect(
      screen.getByText(/Serão criados: 1 worklogs · Total: 2h/)
    ).toBeTruthy()
    expect(screen.getByText('Editado manualmente')).toBeTruthy()
    expect(createWorklog).not.toHaveBeenCalled()
    await actions.click(
      screen.getByRole('checkbox', { name: /Revisei os lançamentos/ })
    )
    await actions.click(submit)
    await screen.findByRole('heading', { name: 'Resultado' })
    expect(createWorklog).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createWorklog).mock.calls[0][3].seconds).toBe(7200)
    expect(screen.getByText('Worklog ID: created-1')).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Revisar e reenviar somente os que falharam',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
  it('analisa somente a conta conectada, sem busca ou troca de usuário', async () => {
    const actions = await configure()
    expect(screen.queryByLabelText('Procurar outro usuário')).toBeNull()
    expect(screen.queryByLabelText('Usuário analisado')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Buscar usuário' })).toBeNull()
    await actions.click(
      screen.getByRole('button', { name: 'Consultar tasks e saldos' })
    )
    await screen.findByRole('heading', { name: 'Análise da Sprint' })
    expect(getAnalysis).toHaveBeenLastCalledWith(
      123,
      user,
      expect.any(Object),
      expect.any(Object),
      'cloud'
    )
    expect(findUsers).not.toHaveBeenCalled()
    expect(createWorklog).not.toHaveBeenCalled()
  })
  it.each(['cloud', 'data-center'] as const)(
    'salva apenas a conexão validada %s na sessão, restaura e desconecta',
    async (deployment) => {
      const actions = userEvent.setup()
      const mounted = render(<Timesheet />)
      const baseUrl =
        deployment === 'cloud'
          ? 'https://example.atlassian.net'
          : 'https://agile.corp.edp.pt'
      vi.mocked(testConnection).mockResolvedValue({
        user,
        timezone: 'America/Fortaleza',
        baseUrl,
      })
      await actions.selectOptions(
        screen.getByLabelText('Tipo de Jira'),
        deployment
      )
      fireEvent.change(screen.getByLabelText('Jira Base URL'), {
        target: { value: baseUrl },
      })
      const label =
        deployment === 'cloud' ? 'API Token' : 'PAT (Personal Access Token)'
      if (deployment === 'cloud')
        await actions.type(
          screen.getByLabelText('E-mail Jira'),
          'test@example.com'
        )
      await actions.type(screen.getByLabelText(label), 'session-secret')
      expect(sessionStorage.getItem(CONNECTION_SESSION_KEY)).toBeNull()
      await actions.click(screen.getByRole('button', { name: 'Conectar' }))
      await screen.findByText('Conectado como: Lucas')
      expect(
        JSON.parse(sessionStorage.getItem(CONNECTION_SESSION_KEY)!)
      ).toEqual({
        deployment,
        baseUrl,
        email: deployment === 'cloud' ? 'test@example.com' : '',
        token: 'session-secret',
      })
      expect(localStorage.getItem(CONNECTION_SESSION_KEY)).toBeNull()
      mounted.unmount()
      vi.mocked(testConnection).mockClear()
      render(<Timesheet />)
      await screen.findByText('Conectado como: Lucas')
      expect(
        (screen.getByLabelText('Tipo de Jira') as HTMLSelectElement).value
      ).toBe(deployment)
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(
        'session-secret'
      )
      expect(testConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          deployment,
          baseUrl,
          token: 'session-secret',
        }),
        deployment
      )
      await actions.click(
        screen.getByRole('button', { name: 'Desconectar e limpar credenciais' })
      )
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('')
      expect(sessionStorage.getItem(CONNECTION_SESSION_KEY)).toBeNull()
    }
  )
  it('não guarda uma conexão que falhou', async () => {
    vi.mocked(testConnection).mockRejectedValue(
      new Error('Credenciais inválidas')
    )
    const actions = userEvent.setup()
    render(<Timesheet />)
    await actions.type(screen.getByLabelText('API Token'), 'invalid-token')
    await actions.click(screen.getByRole('button', { name: 'Conectar' }))
    await screen.findByText('Credenciais inválidas')
    expect(sessionStorage.getItem(CONNECTION_SESSION_KEY)).toBeNull()
  })
  it('permite remover pela lixeira e desfazer sem duplicar ou dividir', async () => {
    const actions = await configure()
    await actions.click(
      screen.getByRole('button', { name: 'Consultar tasks e saldos' })
    )
    await screen.findByRole('heading', { name: 'Análise da Sprint' })
    await actions.click(screen.getByRole('button', { name: 'Gerar sugestão' }))
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dividir' })).toBeNull()
    await actions.click(
      screen.getByRole('button', { name: /Remover lançamento/ })
    )
    expect(screen.queryByRole('spinbutton', { name: /Horas/ })).toBeNull()
    await actions.click(
      screen.getByRole('button', { name: 'Desfazer alteração' })
    )
    expect(screen.queryByText(/ERROR: Possível duplicidade/)).toBeNull()
    expect(screen.getAllByRole('spinbutton', { name: /Horas/ })).toHaveLength(1)
  })
})
