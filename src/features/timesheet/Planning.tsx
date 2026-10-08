import React, { useState } from 'react'
import { CalendarDays, Wand2, PencilLine } from 'lucide-react'
import { Button, Field, inputClass, panelClass } from './ui'
import type { useTimesheet } from './useTimesheet'

export default function Planning({
  controller,
}: {
  controller: ReturnType<typeof useTimesheet>
}) {
  const { period, prepare, busy, entries, succeeded } = controller
  const [draft, setDraft] = useState(period)
  const locked =
    busy ||
    succeeded.length > 0 ||
    entries.some((entry) => entry.result === 'uncertain')
  return (
    <section className={panelClass}>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <CalendarDays size={20} aria-hidden="true" />
        Quando você quer registrar as horas?
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Escolha os dias e a jornada para distribuir o saldo das tasks. As datas
        não filtram as tasks da Sprint. Ao gerar, conferimos as horas já
        registradas nesses dias.
      </p>
      <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Período dos apontamentos</legend>
        <Field label="Data inicial">
          <input
            className={inputClass}
            type="date"
            value={draft.start}
            onChange={(event) =>
              setDraft({ ...draft, start: event.target.value })
            }
          />
        </Field>
        <Field label="Data final">
          <input
            className={inputClass}
            type="date"
            value={draft.end}
            onChange={(event) =>
              setDraft({ ...draft, end: event.target.value })
            }
          />
        </Field>
        <Field label="Jornada diária (horas)">
          <input
            className={inputClass}
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={draft.dailySeconds / 3600}
            onChange={(event) =>
              setDraft({
                ...draft,
                dailySeconds: Number(event.target.value) * 3600,
              })
            }
          />
        </Field>
      </fieldset>
      <p className="text-xs text-gray-500">
        Fuso dos apontamentos: {draft.timezone}. A sugestão automática usa os
        dias úteis.
      </p>
      {entries.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Gerar novamente substitui os lançamentos e as edições atuais.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={locked || !draft.start || !draft.end}
          onClick={() => prepare(draft)}
          title="Atualiza os dados do Jira e distribui as horas nos dias escolhidos"
        >
          <Wand2 size={17} aria-hidden="true" />
          {entries.length ? 'Gerar nova sugestão' : 'Gerar sugestão'}
        </Button>
        <Button
          variant="secondary"
          disabled={locked || !draft.start || !draft.end}
          onClick={() => prepare(draft, false)}
        >
          <PencilLine size={17} aria-hidden="true" />
          Preparar lançamento manual
        </Button>
      </div>
    </section>
  )
}
