import React from 'react'
import { ChevronDown, ChevronRight, Download, ListPlus, Plus, RotateCcw, Shuffle, Trash2, Users } from 'lucide-react'
import { SprintDistributionData, SprintMemberType, SprintPlanningData, SprintTask } from '../types'
import { exportSprintPlanningXlsx } from '../lib/utils/exportSprintPlanning'
import { getColor } from '../lib/utils/colors'
import {
  SPRINT_MEMBER_TYPES,
  getSprintMemberTypeAccentClass,
  getSprintMemberTypeBadgeClass,
  getSprintMemberTypeLabel,
  getSprintMemberTypeShortLabel,
  getSprintSummary,
  getTaskTotal,
} from '../lib/utils/sprintPlanning'

type NewMemberForm = {
  name: string
  type: SprintMemberType
  capacity: string
}

type NewTaskForm = {
  code: string
  description: string
  arqPoints: string
  funcPoints: string
  devPoints: string
}

type TaskPointField = 'arqPoints' | 'funcPoints' | 'devPoints'

type SprintPlanningProps = {
  planning: SprintPlanningData
  setPlanning: React.Dispatch<React.SetStateAction<SprintPlanningData>>
  distribution: SprintDistributionData
  onDistributeTasks: (planning: SprintPlanningData) => void
  onSavePlanning: () => void
  isSavingPlanning: boolean
  savePlanningMessage: string
  hasPlanningChanges: boolean
}

const emptyMemberForm: NewMemberForm = { name: '', type: 'dev', capacity: '' }
const taskPointFields: Array<{ field: TaskPointField; label: string; placeholder: string }> = [
  { field: 'arqPoints', label: 'Arq', placeholder: '0' },
  { field: 'funcPoints', label: 'Func', placeholder: '0' },
  { field: 'devPoints', label: 'Dev', placeholder: '0' },
]

const emptyTaskForm: NewTaskForm = {
  code: '',
  description: '',
  arqPoints: '',
  funcPoints: '',
  devPoints: '',
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getInputNumberValue(value: number): string {
  return value > 0 ? String(value) : ''
}

function getUtilizationPercent(points: number, capacity: number): number {
  if (capacity <= 0) return points > 0 ? Infinity : 0

  return (points / capacity) * 100
}

function getBalanceColorClass(points: number, capacity: number): string {
  return getColor(getUtilizationPercent(points, capacity))
}

function getBalanceTextClass(backgroundClass: string): string {
  return backgroundClass === 'bg-yellow-400' || backgroundClass === 'bg-orange-400'
    ? 'text-gray-900'
    : 'text-white'
}

export default function SprintPlanning({
  planning,
  setPlanning,
  distribution,
  onDistributeTasks,
  onSavePlanning,
  isSavingPlanning,
  savePlanningMessage,
  hasPlanningChanges,
}: SprintPlanningProps) {
  const [newMember, setNewMember] = React.useState<NewMemberForm>(emptyMemberForm)
  const [newTask, setNewTask] = React.useState<NewTaskForm>(emptyTaskForm)
  const [isExporting, setIsExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState('')
  const [isMembersSectionOpen, setIsMembersSectionOpen] = React.useState(true)

  const summary = React.useMemo(() => getSprintSummary(planning), [planning])

  const updatePlanning = (updater: (current: SprintPlanningData) => SprintPlanningData) => {
    setPlanning(current => updater(current))
  }

  const addMember = () => {
    const name = newMember.name.trim()
    const capacity = parseNumber(newMember.capacity)

    if (!name || capacity <= 0) return

    updatePlanning(current => ({
      ...current,
      members: [
        ...current.members,
        {
          id: createId(),
          active: true,
          name,
          type: newMember.type,
          capacity,
          observation: '',
          observationStartDate: '',
          observationEndDate: '',
        },
      ],
    }))
  }

  const updateMember = (
    id: string,
    field: keyof Pick<
      SprintPlanningData['members'][number],
      'active' | 'name' | 'type' | 'capacity' | 'observation' | 'observationStartDate' | 'observationEndDate'
    >,
    value: string | boolean,
  ) => {
    updatePlanning(current => ({
      ...current,
      members: current.members.map(member => {
        if (member.id !== id) return member

        if (field === 'active') {
          return { ...member, active: Boolean(value) }
        }

        if (field === 'capacity') {
          return { ...member, capacity: typeof value === 'string' ? parseNumber(value) : 0 }
        }

        if (field === 'type') {
          return { ...member, type: value as SprintMemberType }
        }

        return { ...member, [field]: typeof value === 'string' ? value : '' }
      }),
    }))
  }

  const removeMember = (id: string) => {
    updatePlanning(current => ({
      ...current,
      members: current.members.filter(member => member.id !== id),
      tasks: current.tasks.map(task => (task.memberId === id ? { ...task, memberId: undefined } : task)),
    }))
  }

  const addTask = () => {
    const task: SprintTask = {
      id: createId(),
      active: true,
      code: newTask.code.trim(),
      description: newTask.description.trim(),
      arqPoints: parseNumber(newTask.arqPoints),
      funcPoints: parseNumber(newTask.funcPoints),
      devPoints: parseNumber(newTask.devPoints),
    }

    if (!task.code && !task.description) return

    updatePlanning(current => ({
      ...current,
      tasks: [...current.tasks, task],
    }))
  }

  const updateTask = (id: string, field: keyof SprintTask, value: string | boolean) => {
    updatePlanning(current => ({
      ...current,
      tasks: current.tasks.map(task => {
        if (task.id !== id) return task

        if (field === 'active') {
          return { ...task, active: Boolean(value) }
        }

        if (field === 'memberId') {
          return { ...task, memberId: typeof value === 'string' && value ? value : undefined }
        }

        if (field === 'arqPoints' || field === 'funcPoints' || field === 'devPoints') {
          return { ...task, [field]: typeof value === 'string' ? parseNumber(value) : 0 }
        }

        return { ...task, [field]: typeof value === 'string' ? value : '' }
      }),
    }))
  }

  const removeTask = (id: string) => {
    updatePlanning(current => ({
      ...current,
      tasks: current.tasks.filter(task => task.id !== id),
    }))
  }

  const clearMembers = () => {
    const confirmed = window.confirm('Limpar todos os membros da sprint?')
    if (!confirmed) return

    updatePlanning(current => ({
      ...current,
      members: [],
      tasks: current.tasks.map(task => ({ ...task, memberId: undefined })),
    }))
  }

  const clearTasks = () => {
    const confirmed = window.confirm('Limpar todas as estorias e tasks?')
    if (!confirmed) return

    updatePlanning(current => ({
      ...current,
      tasks: [],
    }))
  }

  const exportXlsx = async () => {
    setIsExporting(true)
    setExportError('')

    try {
      await exportSprintPlanningXlsx(planning, distribution)
    } catch {
      setExportError('Nao foi possivel exportar a planilha.')
    } finally {
      setIsExporting(false)
    }
  }

  const canExport = planning.members.length > 0 || planning.tasks.length > 0
  const canDistribute = planning.members.some(member => member.active && member.name.trim())
  const balanceClass = summary.balance < 0
    ? 'text-red-700 dark:text-red-300'
    : 'text-green-700 dark:text-green-300'

  return (
    <div className="space-y-6">
      <section className="p-4 bg-white dark:bg-gray-800 shadow rounded transition-colors space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_150px_auto] lg:items-end">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Sprint</span>
              <input
                id="sprint-name"
                placeholder="BRAVO - Planning Sprint 128"
                value={planning.sprintName}
                onChange={e => updatePlanning(current => ({ ...current, sprintName: e.target.value }))}
                className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Inicio</span>
              <input
                type="date"
                value={planning.startDate}
                onChange={e => updatePlanning(current => ({ ...current, startDate: e.target.value }))}
                className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">Fim</span>
              <input
                type="date"
                value={planning.endDate}
                onChange={e => updatePlanning(current => ({ ...current, endDate: e.target.value }))}
                className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              />
            </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onSavePlanning}
              disabled={isSavingPlanning || !planning.sprintName.trim()}
              className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingPlanning ? 'Salvando' : hasPlanningChanges ? 'Salvar' : 'Salvar'}
            </button>
            <button
              onClick={exportXlsx}
              disabled={!canExport || isExporting}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              {isExporting ? 'Exportando' : 'Exportar XLSX'}
            </button>
            <button
              onClick={() => onDistributeTasks(planning)}
              disabled={!canDistribute}
              className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shuffle size={18} />
              Distribuir tasks
            </button>
          </div>
        </div>

        {exportError && (
          <p className="text-sm text-red-600 dark:text-red-300">{exportError}</p>
        )}
        {savePlanningMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{savePlanningMessage}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Capacity total</p>
            <p className="text-xl font-semibold">{formatNumber(summary.totalCapacity)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total pontuado</p>
            <p className="text-xl font-semibold">{formatNumber(summary.totalPoints)}</p>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Saldo</p>
            <p className={`text-xl font-semibold ${balanceClass}`}>{formatNumber(summary.balance)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Totalizadores por tipo</h2>
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-2 font-medium">Tipo</th>
                <th className="py-2 px-2 font-medium">Membros</th>
                <th className="py-2 px-2 font-medium">Capacity</th>
                <th className="py-2 px-2 font-medium">Pontuado</th>
                <th className="py-2 pl-2 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {SPRINT_MEMBER_TYPES.map(type => {
                const total = summary.typeTotals[type]
                const balanceColorClass = getBalanceColorClass(total.points, total.capacity)
                return (
                  <tr key={type} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-2 font-medium">
                      <span
                        className={`inline-flex min-w-[64px] justify-center rounded border px-2 py-1 text-xs font-semibold ${getSprintMemberTypeBadgeClass(type)}`}
                      >
                        {getSprintMemberTypeShortLabel(type)}
                      </span>
                    </td>
                    <td className="py-2 px-2">{total.members}</td>
                    <td className="py-2 px-2">{formatNumber(total.capacity)}</td>
                    <td className="py-2 px-2">{formatNumber(total.points)}</td>
                    <td className="py-2 pl-2">
                      <span
                        className={`inline-flex min-w-[72px] justify-center rounded px-2 py-1 text-xs font-semibold ${balanceColorClass} ${getBalanceTextClass(balanceColorClass)}`}
                      >
                        {formatNumber(total.balance)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-4 bg-white dark:bg-gray-800 shadow rounded transition-colors space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMembersSectionOpen(current => !current)}
            aria-expanded={isMembersSectionOpen}
            className="inline-flex min-w-0 items-center gap-2 rounded p-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Users size={20} className="shrink-0 text-green-700 dark:text-green-300" />
            <h2 className="text-lg font-semibold">Membros da sprint</h2>
            {isMembersSectionOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          <button
            onClick={clearMembers}
            disabled={!planning.members.length}
            className="inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-2 text-sm text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            <RotateCcw size={16} />
            Limpar
          </button>
        </div>

        {isMembersSectionOpen && (
          <>
        <div className="grid gap-2 sm:grid-cols-[1fr_130px_160px_auto]">
          <input
            placeholder="Nome do membro"
            value={newMember.name}
            onChange={e => setNewMember(current => ({ ...current, name: e.target.value }))}
            className="border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
          />
          <select
            value={newMember.type}
            onChange={e => setNewMember(current => ({ ...current, type: e.target.value as SprintMemberType }))}
            className={`border p-2 rounded ${getSprintMemberTypeBadgeClass(newMember.type)}`}
          >
            {SPRINT_MEMBER_TYPES.map(type => (
              <option key={type} value={type}>{getSprintMemberTypeLabel(type)}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="Capacity"
            value={newMember.capacity}
            onChange={e => setNewMember(current => ({ ...current, capacity: e.target.value }))}
            className="border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={addMember}
            className="inline-flex items-center justify-center gap-2 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600"
          >
            <Plus size={18} />
            Adicionar
          </button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {planning.members.map(member => (
            <div
              key={member.id}
              data-testid="sprint-member-row"
              className={`border-l-4 py-4 pl-3 first:pt-0 last:pb-0 ${getSprintMemberTypeAccentClass(member.type)} ${member.active ? '' : 'opacity-70'}`}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[96px_minmax(150px,1fr)_112px_112px_minmax(150px,1fr)_140px_140px_40px] lg:items-end">
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Ativo</span>
                  <span className="flex h-10 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <input
                      type="checkbox"
                      checked={member.active}
                      onChange={e => updateMember(member.id, 'active', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {member.active ? 'Sim' : 'Nao'}
                    </span>
                  </span>
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Membro</span>
                  <input
                    value={member.name}
                    onChange={e => updateMember(member.id, 'name', e.target.value)}
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo</span>
                  <select
                    value={member.type}
                    onChange={e => updateMember(member.id, 'type', e.target.value)}
                    className={`h-10 w-full rounded border p-2 ${getSprintMemberTypeBadgeClass(member.type)}`}
                  >
                    {SPRINT_MEMBER_TYPES.map(type => (
                      <option key={type} value={type}>{getSprintMemberTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Capacity</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={getInputNumberValue(member.capacity)}
                    onChange={e => updateMember(member.id, 'capacity', e.target.value)}
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Observacao</span>
                  <input
                    value={member.observation}
                    onChange={e => updateMember(member.id, 'observation', e.target.value)}
                    placeholder="Ferias, atestado..."
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Inicio</span>
                  <input
                    type="date"
                    value={member.observationStartDate}
                    onChange={e => updateMember(member.id, 'observationStartDate', e.target.value)}
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Fim</span>
                  <input
                    type="date"
                    value={member.observationEndDate}
                    onChange={e => updateMember(member.id, 'observationEndDate', e.target.value)}
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                <button
                  onClick={() => removeMember(member.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  title="Remover membro"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {!planning.members.length && (
            <div className="py-4 text-sm text-gray-500 dark:text-gray-400">
              Nenhum membro cadastrado.
            </div>
          )}
        </div>
          </>
        )}
      </section>

      <section className="p-4 bg-white dark:bg-gray-800 shadow rounded transition-colors space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListPlus size={20} className="text-green-700 dark:text-green-300" />
            <h2 className="text-lg font-semibold">Estorias e tasks</h2>
          </div>
          <button
            onClick={clearTasks}
            disabled={!planning.tasks.length}
            className="inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-2 text-sm text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            <RotateCcw size={16} />
            Limpar
          </button>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[132px_minmax(240px,1fr)_64px_64px_64px_auto] lg:items-end">
            <label className="space-y-1">
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Estoria</span>
              <input
                placeholder="SQCRM-0000"
                value={newTask.code}
                onChange={e => setNewTask(current => ({ ...current, code: e.target.value }))}
                className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Descricao</span>
              <input
                placeholder="Descricao"
                value={newTask.description}
                onChange={e => setNewTask(current => ({ ...current, description: e.target.value }))}
                className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              />
            </label>
            {taskPointFields.map(({ field, label, placeholder }) => (
              <label key={field} className="space-y-1">
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={placeholder}
                  value={newTask[field]}
                  onChange={e => setNewTask(current => ({ ...current, [field]: e.target.value }))}
                  className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600 lg:px-1.5"
                />
              </label>
            ))}
            <button
              onClick={addTask}
              className="inline-flex h-10 items-center justify-center gap-2 bg-blue-500 text-white px-3 rounded hover:bg-blue-600 sm:col-span-2 lg:col-span-1"
            >
              <Plus size={18} />
              Adicionar
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {planning.tasks.map(task => (
            <div key={task.id} className={`py-4 first:pt-0 last:pb-0 ${task.active ? '' : 'opacity-70'}`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[74px_132px_minmax(220px,1fr)_64px_64px_64px_82px_40px] lg:items-end">
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Ativo</span>
                  <span className="flex h-10 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <input
                      type="checkbox"
                      checked={task.active}
                      onChange={e => updateTask(task.id, 'active', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                    />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {task.active ? 'Sim' : 'Nao'}
                    </span>
                  </span>
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Estoria</span>
                  <input
                    value={task.code}
                    onChange={e => updateTask(task.id, 'code', e.target.value)}
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Descricao</span>
                  <input
                    value={task.description}
                    onChange={e => updateTask(task.id, 'description', e.target.value)}
                    className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                  />
                </label>
                {taskPointFields.map(({ field, label }) => (
                  <label key={field} className="space-y-1">
                    <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={getInputNumberValue(task[field])}
                      onChange={e => updateTask(task.id, field, e.target.value)}
                      className="h-10 w-full border p-2 rounded bg-white dark:bg-gray-700 dark:border-gray-600 lg:px-1.5"
                    />
                  </label>
                ))}
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Soma</span>
                  <div className="flex h-10 items-center justify-center rounded border border-gray-200 bg-gray-50 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900/40">
                    {formatNumber(getTaskTotal(task))}
                  </div>
                </div>
                <button
                  onClick={() => removeTask(task.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  title="Remover estoria"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {!planning.tasks.length && (
            <div className="py-4 text-sm text-gray-500 dark:text-gray-400">
              Nenhuma estoria cadastrada.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
