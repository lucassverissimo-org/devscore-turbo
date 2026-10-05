import { describe, expect, it, vi } from 'vitest'
import type {
  Analysis,
  Entry,
  Issue,
  Period,
  Worklog,
} from '../src/features/timesheet/types'
import {
  balance,
  distribute,
  summarize,
} from '../src/features/timesheet/distribution'
import {
  logicalDate,
  startedAt,
  validDate,
  periodDays,
} from '../src/features/timesheet/dates'
import { validateEntries } from '../src/features/timesheet/validation'
import { csvCell, exportCsv } from '../src/features/timesheet/csv'
import { submitSequential } from '../src/features/timesheet/submission'
import { ApiError } from '../src/features/timesheet/api'
const h = 3600
export const issue = (
  key = 'ABC-1',
  estimated: number | null = 10 * h,
  spent = 4 * h
): Issue => ({
  id: key,
  key,
  summary: 'Implementar',
  issueType: 'Customizado',
  status: 'Active',
  assignee: { accountId: 'me', displayName: 'Lucas' },
  originalEstimateSeconds: estimated,
  remainingEstimateSeconds: h,
  timeSpentSeconds: spent,
})
export const period: Period = {
  start: '2026-10-05',
  end: '2026-10-09',
  dailySeconds: 8 * h,
  timezone: 'America/Fortaleza',
}
export const log = (seconds = 3 * h, key = 'OUT-1'): Worklog => ({
  id: 'existing',
  issueKey: key,
  accountId: 'me',
  started: '2026-10-05T09:00:00-0300',
  timeSpentSeconds: seconds,
  comment: '',
})
export const analysis = (
  issues: Issue[] = [issue()],
  logs: Worklog[] = []
): Analysis => ({
  sprint: {
    id: 123,
    name: 'Sprint 64',
    state: 'active',
    startDate: '2026-10-01T12:00:00Z',
    endDate: '2026-10-25T12:00:00Z',
  },
  user: { accountId: 'me', displayName: 'Lucas' },
  authenticatedUser: { accountId: 'me', displayName: 'Lucas' },
  issues,
  worklogs: logs,
  baseUrl: 'https://example.atlassian.net',
  timezone: period.timezone,
  warnings: [],
})
export const entry = (seconds = h): Entry => ({
  id: 'one',
  issueKey: 'ABC-1',
  date: period.start,
  seconds,
  comment: '',
  origin: 'automatic',
  edited: false,
})
describe('saldos e distribuição determinística', () => {
  it.each([
    [10, 4, 6, 0],
    [10, 10, 0, 0],
    [10, 12, 0, 2],
  ])('saldo %ih menos %ih', (estimate, spent, expected, excess) =>
    expect(balance(issue('ABC-1', estimate * h, spent * h))).toEqual({
      balance: expected * h,
      excess: excess * h,
    })
  )
  it('desconta worklogs de fora da Sprint da capacidade diária', () => {
    const result = distribute(
      [issue('ABC-1', 10 * h, 0)],
      [log()],
      'me',
      period
    )
    expect(result.entries[0].seconds).toBe(5 * h)
    expect(result.available).toBe(37 * h)
  })
  it('não inventa horas para preencher capacidade', () => {
    const result = distribute([issue('ABC-1', 30 * h, 0)], [], 'me', period)
    expect(result.suggested).toBe(30 * h)
    expect(result.unallocated).toBe(10 * h)
  })
  it('limita pela capacidade e informa saldo não distribuído', () => {
    const result = distribute([issue('ABC-1', 60 * h, 0)], [], 'me', period)
    expect(result.suggested).toBe(40 * h)
    expect(result.undistributed).toBe(20 * h)
  })
  it.each([null, 0])(
    'exclui estimativa %s, sem usar remainingEstimate',
    (estimate) => {
      expect(
        distribute([issue('ABC-1', estimate, 0)], [], 'me', period).entries
      ).toEqual([])
    }
  )
  it('ignora finais de semana, respeita intervalo inclusivo', () => {
    const result = distribute([issue('ABC-1', 60 * h, 0)], [], 'me', {
      ...period,
      start: '2026-10-02',
      end: '2026-10-05',
    })
    expect(result.theoretical).toBe(16 * h)
    expect(result.entries.map((item) => item.date)).toEqual([
      '2026-10-02',
      '2026-10-05',
    ])
  })
  it('gera resultados iguais e não altera entradas', () => {
    const input = [issue('B', 20 * h, 0), issue('A', 10 * h, 4 * h)]
    const before = JSON.stringify(input)
    expect(distribute(input, [log()], 'me', period)).toEqual(
      distribute(input.reverse(), [log()], 'me', period)
    )
    expect(JSON.stringify(input.reverse())).toBe(before)
  })
  it('usa timespent global, ignorando autor para o saldo', () => {
    expect(
      distribute(
        [issue('ABC-1', 10 * h, 5 * h)],
        [log(2 * h, 'ABC-1')],
        'me',
        period
      ).suggested
    ).toBe(5 * h)
  })
  it('não deixa um dia sobrecarregado consumir a capacidade de outros', () => {
    const result = distribute(
      [issue('ABC-1', 60 * h, 0)],
      [log(12 * h)],
      'me',
      period
    )
    expect(result.available).toBe(32 * h)
    expect(result.entries.every((item) => item.date !== period.start)).toBe(
      true
    )
  })
  it('permite política de calendário extensível', () => {
    const result = distribute(
      [issue('ABC-1', 60 * h, 0)],
      [],
      'me',
      period,
      (date) => (date === period.start ? 4 * h : 0)
    )
    expect(result.suggested).toBe(4 * h)
  })
  it('exemplo principal distribui apenas 26h ou 16h', () => {
    const issues = [
      issue('ABC-101', 10 * h, 4 * h),
      issue('ABC-102', 20 * h, 0),
      issue('ABC-103', 8 * h, 8 * h),
    ]
    expect(distribute(issues, [], 'me', period).unallocated).toBe(14 * h)
    const result = distribute(issues, [], 'me', {
      ...period,
      end: '2026-10-06',
    })
    expect(result.suggested).toBe(16 * h)
    expect(result.undistributed).toBe(10 * h)
  })
})
describe('validação central e edição', () => {
  it('bloqueia duplicidade com issue, usuário, data e duração iguais', () => {
    expect(
      validateEntries(analysis([issue()], [log(h, 'ABC-1')]), period, [
        entry(),
      ]).some(
        (item) => item.level === 'ERROR' && item.message.includes('duplicidade')
      )
    ).toBe(true)
  })
  it('outro usuário pode analisar, mas não registrar', () => {
    const data = {
      ...analysis(),
      authenticatedUser: { accountId: 'other', displayName: 'Outro' },
    }
    expect(validateEntries(data, period, [entry()], false)).toEqual([])
    expect(
      validateEntries(data, period, [entry()], true).some(
        (item) => item.level === 'ERROR'
      )
    ).toBe(true)
  })
  it.each([0, -1, NaN, 1.5])('bloqueia duração inválida %s', (seconds) => {
    expect(
      validateEntries(analysis(), period, [entry(seconds)]).some(
        (item) => item.level === 'ERROR'
      )
    ).toBe(true)
  })
  it('bloqueia issue desconhecida e data fora do período', () => {
    const errors = validateEntries(analysis(), period, [
      { ...entry(), issueKey: 'no', date: '2026-10-25' },
    ])
    expect(errors.filter((item) => item.level === 'ERROR')).toHaveLength(2)
  })
  it('permite período independente das datas da Sprint', () => {
    expect(
      validateEntries(
        analysis(),
        { ...period, start: '2026-09-30', end: '2026-10-26' },
        [entry()]
      ).some((item) => item.message.includes('Sprint'))
    ).toBe(false)
  })
  it('excesso automático é erro, edição manual recebe aviso', () => {
    expect(
      validateEntries(analysis(), period, [entry(9 * h)]).filter(
        (item) => item.level === 'ERROR'
      )
    ).toHaveLength(2)
    expect(
      validateEntries(analysis(), period, [
        { ...entry(9 * h), edited: true },
      ]).filter((item) => item.level === 'WARNING')
    ).toHaveLength(2)
  })
  it('edição na confirmação recalcula totais e CSV sem corrigir valor', () => {
    const data = analysis()
    const edited = {
      ...entry(),
      seconds: 2 * h,
      edited: true,
      comment: 'Revisado',
    }
    expect(summarize(data.issues, [], 'me', period, [edited]).suggested).toBe(
      2 * h
    )
    const csv = exportCsv(data, period, [edited], 'confirmation')
    expect(csv).toContain('"7200"')
    expect(csv).toContain('"Revisado"')
    expect(csv).toContain('"true"')
  })
})
describe('timezone e CSV', () => {
  it('Fortaleza mantém dia local antes da meia-noite UTC', () => {
    expect(logicalDate('2026-10-02T01:00:00Z', period.timezone)).toBe(
      '2026-10-01'
    )
    expect(startedAt('2026-10-01', period.timezone)).toBe(
      '2026-10-01T12:00:00.000+0000'
    )
  })
  it('resolve DST e meia hora sem timezone do navegador', () => {
    expect(startedAt('2026-07-01', 'America/New_York')).toBe(
      '2026-07-01T13:00:00.000+0000'
    )
    expect(startedAt('2026-01-01', 'America/New_York')).toBe(
      '2026-01-01T14:00:00.000+0000'
    )
    expect(startedAt('2026-10-01', 'Asia/Kolkata')).toBe(
      '2026-10-01T03:30:00.000+0000'
    )
  })
  it('rejeita data impossível e período invertido', () => {
    expect(validDate('2026-02-30')).toBe(false)
    expect(() => periodDays({ ...period, end: '2026-10-01' })).toThrow()
  })
  it('CSV tem BOM e escapa vírgulas, aspas e novas linhas', () => {
    const csv = exportCsv(
      analysis(),
      period,
      [{ ...entry(), comment: 'um,"dois"\ntrês' }],
      'review'
    )
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"um,""dois""\ntrês"')
  })
  it('protege CSV de fórmulas Excel', () => {
    expect(csvCell(' =HYPERLINK("evil")')).toBe('"\' =HYPERLINK(""evil"")"')
  })
  it('CSV de resultado não duplica worklogs enviados na sessão', () => {
    const csv = exportCsv(
      analysis([issue()], [log(h, 'ABC-1')]),
      period,
      [{ ...entry(), worklogId: 'existing', result: 'success' }],
      'result'
    )
    expect(csv.split('\r\n')).toHaveLength(2)
  })
})
describe('envio sequencial, resultado parcial e reenvio', () => {
  it('continua após uma falha e não reenvia sucessos', async () => {
    const entries = ['a', 'b', 'c', 'd'].map((id) => ({ ...entry(), id }))
    const create = vi.fn(async (item: Entry) => {
      if (item.id === 'b') throw new Error('Sem permissão')
      return { id: `worklog-${item.id}` }
    })
    const results = await submitSequential(entries, create, () => {})
    expect(results.filter((item) => item.result === 'success')).toHaveLength(3)
    expect(results.filter((item) => item.result === 'error')).toHaveLength(1)
    create.mockClear()
    await submitSequential(results, create, () => {})
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].id).toBe('b')
  })
  it('não reenvia resultados incertos', async () => {
    const create = vi.fn(async () => {
      throw new ApiError('timeout', true)
    })
    const results = await submitSequential([entry()], create, () => {})
    await submitSequential(results, create, () => {})
    expect(create).toHaveBeenCalledTimes(1)
  })
  it('429 adia os demais sem violar Retry-After', async () => {
    const create = vi.fn(async () => {
      throw new ApiError('limite', false, 30)
    })
    const results = await submitSequential(
      [entry(), { ...entry(), id: 'two' }],
      create,
      () => {}
    )
    expect(create).toHaveBeenCalledTimes(1)
    expect(results[1].error).toContain('30s')
  })
})

it('não inclui itens que falharam na validação dos envios seguintes', async () => {
  const calls: string[][] = []
  await submitSequential(
    ['a', 'b', 'c'].map((id) => ({ ...entry(), id })),
    async (current, pending) => {
      calls.push(pending.map((item) => item.id))
      if (current.id === 'b') throw new Error('Sem permissão')
      return { id: current.id }
    },
    () => {}
  )
  expect(calls).toEqual([['a', 'b', 'c'], ['b', 'c'], ['c']])
})
