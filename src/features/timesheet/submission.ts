import type { CreationResult, Entry } from './types'
import { ApiError } from './api'
export async function submitSequential(
  entries: Entry[],
  create: (entry: Entry, pending: Entry[]) => Promise<CreationResult>,
  onProgress: (completed: number, total: number, results: Entry[]) => void
): Promise<Entry[]> {
  const results: Entry[] = entries.map((entry) => ({
    ...entry,
    ...(entry.result === 'error'
      ? { result: undefined, error: undefined }
      : {}),
  }))
  const targets = results.filter(
    (entry) => !entry.worklogId && entry.result !== 'uncertain'
  )
  let completed = 0
  for (const target of targets) {
    const index = results.findIndex((entry) => entry.id === target.id)
    try {
      const result = await create(
        target,
        results.filter(
          (entry) =>
            !entry.worklogId &&
            entry.result !== 'uncertain' &&
            entry.result !== 'error'
        )
      )
      results[index] = {
        ...target,
        worklogId: result.id,
        result: 'success',
        error: undefined,
      }
    } catch (error) {
      results[index] = {
        ...target,
        result:
          error instanceof ApiError && error.uncertain ? 'uncertain' : 'error',
        error: error instanceof Error ? error.message : 'Falha no registro.',
      }
      if (error instanceof ApiError && error.retryAfter) {
        // Do not violate Retry-After or automatically retry a write.
        for (const remaining of targets.slice(completed + 1)) {
          const remainingIndex = results.findIndex(
            (entry) => entry.id === remaining.id
          )
          results[remainingIndex] = {
            ...remaining,
            result: 'error',
            error: `Envio adiado pelo limite Jira. Aguarde ${error.retryAfter}s antes de tentar novamente.`,
          }
        }
        onProgress(targets.length, targets.length, [...results])
        return results
      }
    }
    completed++
    onProgress(completed, targets.length, [...results])
  }
  return results
}
