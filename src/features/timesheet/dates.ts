import type { Period } from './types'
export const DEFAULT_TIMEZONE = 'America/Fortaleza'
export const EDIT_INCREMENT_SECONDS = 15 * 60
export function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  )
}
export function logicalDate(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}
export function dates(start: string, end: string): string[] {
  if (!validDate(start) || !validDate(end) || start > end)
    throw new Error('Informe um período válido, com data inicial até a final.')
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 366)
    throw new Error('O período máximo é de 367 dias.')
  const result: string[] = []
  for (
    let cursor = Date.parse(`${start}T12:00:00Z`);
    cursor <= Date.parse(`${end}T12:00:00Z`);
    cursor += 86400000
  )
    result.push(new Date(cursor).toISOString().slice(0, 10))
  return result
}
// Calendar policy is injectable, allowing holidays, leave and special schedules.
export type CalendarPolicy = (date: string, dailySeconds: number) => number
export const weekdayCapacity: CalendarPolicy = (date, seconds) =>
  [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 0 : seconds
export function periodDays(period: Period, calendar = weekdayCapacity) {
  if (
    !Number.isSafeInteger(period.dailySeconds) ||
    period.dailySeconds <= 0 ||
    period.dailySeconds > 86400
  )
    throw new Error('Jornada deve ser maior que zero e até 24h.')
  if (!validTimezone(period.timezone)) throw new Error('Timezone inválido.')
  return dates(period.start, period.end).map((date) => ({
    date,
    capacity: calendar(date, period.dailySeconds),
  }))
}
export function startedAt(date: string, timezone: string): string {
  if (!validDate(date) || !validTimezone(timezone))
    throw new Error('Data ou timezone inválido.')
  // Resolve 09:00 local using the zone offset, including DST. No browser timezone dependency.
  const desired = Date.parse(`${date}T09:00:00Z`)
  let instant = desired
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant))
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value
    const local = Date.parse(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
    )
    const correction = desired - local
    instant += correction
    if (!correction) break
  }
  if (logicalDate(new Date(instant).toISOString(), timezone) !== date)
    throw new Error('Não foi possível resolver a data nesse timezone.')
  return new Date(instant).toISOString().replace('Z', '+0000')
}
export function displayDate(date: string): string {
  return validDate(date) ? date.split('-').reverse().join('/') : date
}
export function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  return (
    [
      hours ? `${hours}h` : '',
      minutes ? `${minutes}m` : '',
      remainder ? `${remainder}s` : '',
    ]
      .filter(Boolean)
      .join(' ') || '0h'
  )
}
