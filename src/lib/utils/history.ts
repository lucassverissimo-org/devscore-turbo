export const HISTORY_TEXT_MAX_LENGTH = 15

export function normalizeHistoryText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const text = value.trim().slice(0, HISTORY_TEXT_MAX_LENGTH)
  return text || undefined
}
