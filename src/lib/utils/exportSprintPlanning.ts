import type { CellValue, Row, Workbook, Worksheet } from 'exceljs'
import type { Dev, SprintDistributionData, SprintMemberType, SprintPlanningData } from '../../types'
import {
  SPRINT_MEMBER_TYPES,
  getSprintMemberTypeLabel,
  getSprintSummary,
  getTaskTotal,
} from './sprintPlanning'

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const POINT_TOTAL_COLUMNS: Record<SprintMemberType, string> = {
  arq: 'D',
  func: 'E',
  dev: 'F',
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : ''
}

function getSprintPeriodText(planning: SprintPlanningData): string {
  const startDate = formatDate(planning.startDate)
  const endDate = formatDate(planning.endDate)

  if (startDate && endDate) return `Periodo: ${startDate} a ${endDate}`
  if (startDate) return `Inicio: ${startDate}`
  if (endDate) return `Fim: ${endDate}`

  return 'Periodo nao informado'
}

function sanitizeFileName(value: string): string {
  const name = value.trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, ' ')
  return name || 'Planning Sprint'
}

function getUtilizationPercent(points: number, capacity: number): number {
  if (capacity <= 0) return points > 0 ? Infinity : 0

  return (points / capacity) * 100
}

function getBalanceFillArgb(points: number, capacity: number): string {
  const percent = getUtilizationPercent(points, capacity)

  if (percent <= 20) return 'FF3B82F6'
  if (percent <= 75) return 'FFFACC15'
  if (percent <= 99) return 'FFFB923C'
  if (percent <= 100) return 'FF22C55E'

  return 'FFEF4444'
}

function getBalanceFontArgb(fillArgb: string): string {
  return fillArgb === 'FFFACC15' || fillArgb === 'FFFB923C'
    ? 'FF111827'
    : 'FFFFFFFF'
}

function setRowValues(sheet: Worksheet, rowNumber: number, values: unknown[]) {
  values.forEach((value, index) => {
    sheet.getCell(rowNumber, index + 1).value = value as CellValue
  })
}

function styleHeader(row: Row, fromCol: number, toCol: number) {
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = row.getCell(col)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF274E13' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF555555' } },
      left: { style: 'thin', color: { argb: 'FF555555' } },
      bottom: { style: 'thin', color: { argb: 'FF555555' } },
      right: { style: 'thin', color: { argb: 'FF555555' } },
    }
  }
}

function styleDataRange(sheet: Worksheet, rowNumber: number, fromCol: number, toCol: number) {
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = sheet.getCell(rowNumber, col)
    cell.alignment = { vertical: 'middle', wrapText: col === 3 || col === 5 }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF999999' } },
      left: { style: 'thin', color: { argb: 'FF999999' } },
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
      right: { style: 'thin', color: { argb: 'FF999999' } },
    }
  }
}

function styleSectionTitle(sheet: Worksheet, rowNumber: number, fromCol: number, toCol: number) {
  sheet.mergeCells(rowNumber, fromCol, rowNumber, toCol)
  const cell = sheet.getCell(rowNumber, fromCol)
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8D5' } }
  cell.font = { bold: true, color: { argb: 'FF1F3B16' } }
  cell.alignment = { horizontal: 'left', vertical: 'middle' }
}

function formatHistorySummary(dev: Dev): string {
  return dev.history
    .map(entry => {
      const text = entry.text ? ` - ${entry.text}` : ''
      return `${entry.value > 0 ? '+' : ''}${entry.value}${text}`
    })
    .join('\n')
}

function addDistributionWorksheet(workbook: Workbook, distribution: SprintDistributionData, now: Date): Worksheet {
  const sheet = workbook.addWorksheet('Distribuicao', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  sheet.columns = [
    { width: 28 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 42 },
  ]

  sheet.mergeCells('A1:F1')
  const title = sheet.getCell('A1')
  title.value = 'Distribuicao'
  title.font = { bold: true, size: 16, color: { argb: 'FF1F3B16' } }
  title.alignment = { horizontal: 'left', vertical: 'middle' }

  sheet.mergeCells('A2:F2')
  sheet.getCell('A2').value = `Unidade: ${distribution.pointsType} | Exportado em ${formatDateTime(now)}`
  sheet.getCell('A2').font = { color: { argb: 'FF555555' } }

  const headerRow = 4
  const startRow = headerRow + 1
  setRowValues(sheet, headerRow, ['Membro', 'Capacity', 'Alocado', 'Saldo', 'Utilizacao', 'Historico resumido'])
  styleHeader(sheet.getRow(headerRow), 1, 6)

  distribution.devs.forEach((dev, index) => {
    const rowNumber = startRow + index
    const percent = dev.capacity > 0 ? dev.points / dev.capacity : 0
    setRowValues(sheet, rowNumber, [
      dev.name,
      dev.capacity,
      dev.points,
      null,
      percent,
      formatHistorySummary(dev),
    ])
    sheet.getCell(rowNumber, 4).value = {
      formula: `B${rowNumber}-C${rowNumber}`,
      result: dev.capacity - dev.points,
    }
    sheet.getCell(rowNumber, 5).value = percent
    sheet.getCell(rowNumber, 5).numFmt = '0%'
    styleDataRange(sheet, rowNumber, 1, 6)
    sheet.getCell(rowNumber, 6).alignment = { vertical: 'top', wrapText: true }

    if (dev.capacity - dev.points < 0) {
      sheet.getCell(rowNumber, 4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD7D7' },
      }
    }
  })

  const lastDevRow = Math.max(startRow, startRow + distribution.devs.length - 1)
  if (!distribution.devs.length) {
    setRowValues(sheet, startRow, ['Nenhum membro distribuido', 0, 0, 0, 0, ''])
    styleDataRange(sheet, startRow, 1, 6)
  }

  const totalRow = lastDevRow + 1
  setRowValues(sheet, totalRow, ['Total', null, null, null, null, ''])
  sheet.getCell(totalRow, 2).value = {
    formula: `SUM(B${startRow}:B${lastDevRow})`,
    result: distribution.devs.reduce((sum, dev) => sum + dev.capacity, 0),
  }
  sheet.getCell(totalRow, 3).value = {
    formula: `SUM(C${startRow}:C${lastDevRow})`,
    result: distribution.devs.reduce((sum, dev) => sum + dev.points, 0),
  }
  sheet.getCell(totalRow, 4).value = {
    formula: `B${totalRow}-C${totalRow}`,
    result: distribution.devs.reduce((sum, dev) => sum + dev.capacity - dev.points, 0),
  }
  styleHeader(sheet.getRow(totalRow), 1, 6)

  const historyTitleRow = totalRow + 3
  styleSectionTitle(sheet, historyTitleRow, 1, 3)
  sheet.getCell(historyTitleRow, 1).value = 'Historico de lancamentos'

  const historyHeaderRow = historyTitleRow + 1
  setRowValues(sheet, historyHeaderRow, ['Membro', 'Valor', 'Texto'])
  styleHeader(sheet.getRow(historyHeaderRow), 1, 3)

  const historyRows = distribution.devs.flatMap(dev =>
    dev.history.map(entry => ({
      memberName: dev.name,
      value: entry.value,
      text: entry.text ?? '',
    }))
  )

  if (!historyRows.length) {
    setRowValues(sheet, historyHeaderRow + 1, ['Sem historico', '', ''])
    styleDataRange(sheet, historyHeaderRow + 1, 1, 3)
  } else {
    historyRows.forEach((entry, index) => {
      const rowNumber = historyHeaderRow + 1 + index
      setRowValues(sheet, rowNumber, [
        entry.memberName,
        entry.value,
        entry.text,
      ])
      styleDataRange(sheet, rowNumber, 1, 3)
    })
  }

  for (let row = 1; row <= historyHeaderRow + Math.max(historyRows.length, 1); row += 1) {
    sheet.getCell(row, 2).numFmt = '0.0'
  }

  sheet.eachRow(row => {
    row.height = 22
  })
  sheet.getRow(1).height = 28

  return sheet
}

async function downloadWorkbook(workbook: Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer as BlobPart], { type: XLSX_MIME_TYPE })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportSprintPlanningXlsx(
  planning: SprintPlanningData,
  distribution: SprintDistributionData,
) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.default.Workbook()
  const now = new Date()
  const summary = getSprintSummary(planning)
  const sheet = workbook.addWorksheet('Planning Sprint', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  workbook.creator = 'Dev-Tools'
  workbook.created = now

  sheet.columns = [
    { width: 10 },
    { width: 18 },
    { width: 64 },
    { width: 10 },
    { width: 22 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ]

  sheet.mergeCells('A1:M1')
  const title = sheet.getCell('A1')
  title.value = planning.sprintName.trim() || 'Planning Sprint'
  title.font = { bold: true, size: 16, color: { argb: 'FF1F3B16' } }
  title.alignment = { horizontal: 'left', vertical: 'middle' }

  sheet.mergeCells('A2:M2')
  sheet.getCell('A2').value = `${getSprintPeriodText(planning)} | Exportado em ${formatDateTime(now)}`
  sheet.getCell('A2').font = { color: { argb: 'FF555555' } }

  const taskHeaderRow = 4
  const taskStartRow = taskHeaderRow + 1
  setRowValues(sheet, taskHeaderRow, [
    'Ativo',
    'Estoria',
    'Descricao',
    'Arq/TL',
    'Func',
    'Dev',
    'Soma',
    'Transbordo',
  ])
  styleHeader(sheet.getRow(taskHeaderRow), 1, 8)

  planning.tasks.forEach((task, index) => {
    const rowNumber = taskStartRow + index
    setRowValues(sheet, rowNumber, [
      task.active ? 'Sim' : 'Nao',
      task.code,
      task.description,
      task.arqPoints || null,
      task.funcPoints || null,
      task.devPoints || null,
      null,
      '',
    ])
    sheet.getCell(rowNumber, 7).value = {
      formula: `SUM(D${rowNumber}:F${rowNumber})`,
      result: getTaskTotal(task),
    }
    styleDataRange(sheet, rowNumber, 1, 8)

    if (!task.active) {
      for (let col = 1; col <= 8; col += 1) {
        sheet.getCell(rowNumber, col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' },
        }
      }
    }
  })

  const lastTaskRow = Math.max(taskStartRow, taskStartRow + planning.tasks.length - 1)
  if (!planning.tasks.length) {
    setRowValues(sheet, taskStartRow, ['', '', '', null, null, null, 0, ''])
    styleDataRange(sheet, taskStartRow, 1, 8)
  }

  const taskTotalRow = lastTaskRow + 1
  setRowValues(sheet, taskTotalRow, ['', '', 'Total da sprint', null, null, null, null, ''])
  sheet.getCell(taskTotalRow, 4).value = {
    formula: `SUMIF($A$${taskStartRow}:$A$${lastTaskRow},"Sim",$D$${taskStartRow}:$D$${lastTaskRow})`,
    result: summary.categoryTotals.arqPoints,
  }
  sheet.getCell(taskTotalRow, 5).value = {
    formula: `SUMIF($A$${taskStartRow}:$A$${lastTaskRow},"Sim",$E$${taskStartRow}:$E$${lastTaskRow})`,
    result: summary.categoryTotals.funcPoints,
  }
  sheet.getCell(taskTotalRow, 6).value = {
    formula: `SUMIF($A$${taskStartRow}:$A$${lastTaskRow},"Sim",$F$${taskStartRow}:$F$${lastTaskRow})`,
    result: summary.categoryTotals.devPoints,
  }
  sheet.getCell(taskTotalRow, 7).value = {
    formula: `SUMIF($A$${taskStartRow}:$A$${lastTaskRow},"Sim",$G$${taskStartRow}:$G$${lastTaskRow})`,
    result: summary.totalPoints,
  }
  styleHeader(sheet.getRow(taskTotalRow), 1, 8)

  const resourceTitleRow = taskTotalRow + 3
  styleSectionTitle(sheet, resourceTitleRow, 1, 7)
  sheet.getCell(resourceTitleRow, 1).value = 'Membros - Sprint atual'

  const resourceHeaderRow = resourceTitleRow + 1
  setRowValues(sheet, resourceHeaderRow, ['Ativo', 'Membro', 'Tipo', 'Capacity', 'Observacao', 'Inicio', 'Fim'])
  styleHeader(sheet.getRow(resourceHeaderRow), 1, 7)

  planning.members.forEach((member, index) => {
    const rowNumber = resourceHeaderRow + 1 + index
    setRowValues(sheet, rowNumber, [
      member.active ? 'Sim' : 'Nao',
      member.name,
      getSprintMemberTypeLabel(member.type),
      member.capacity,
      member.observation,
      formatDate(member.observationStartDate),
      formatDate(member.observationEndDate),
    ])
    styleDataRange(sheet, rowNumber, 1, 7)

    if (!member.active) {
      for (let col = 1; col <= 7; col += 1) {
        sheet.getCell(rowNumber, col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' },
        }
      }
    }
  })

  const resourceTotalRow = resourceHeaderRow + 1 + Math.max(planning.members.length, 1)
  if (!planning.members.length) {
    setRowValues(sheet, resourceHeaderRow + 1, ['', '', '', 0, '', '', ''])
    styleDataRange(sheet, resourceHeaderRow + 1, 1, 7)
  }
  setRowValues(sheet, resourceTotalRow, ['Total', '', '', null, '', '', ''])
  sheet.getCell(resourceTotalRow, 4).value = {
    formula: `SUMIF($A$${resourceHeaderRow + 1}:$A$${resourceTotalRow - 1},"Sim",$D$${resourceHeaderRow + 1}:$D$${resourceTotalRow - 1})`,
    result: summary.totalCapacity,
  }
  styleHeader(sheet.getRow(resourceTotalRow), 1, 7)

  const summaryTitleRow = resourceTitleRow
  styleSectionTitle(sheet, summaryTitleRow, 9, 13)
  sheet.getCell(summaryTitleRow, 9).value = 'Resumo'

  const summaryHeaderRow = summaryTitleRow + 1
  setRowValues(sheet, summaryHeaderRow, ['', '', '', '', '', '', '', '', 'Indicador', 'Valor'])
  styleHeader(sheet.getRow(summaryHeaderRow), 9, 10)
  const summaryRows = [
    ['Capacity total', summary.totalCapacity],
    ['Total pontuado', summary.totalPoints],
    ['Saldo', summary.balance],
  ]
  summaryRows.forEach(([label, value], index) => {
    const rowNumber = summaryHeaderRow + 1 + index
    sheet.getCell(rowNumber, 9).value = label
    sheet.getCell(rowNumber, 10).value = value
    styleDataRange(sheet, rowNumber, 9, 10)
    if (label === 'Saldo' && Number(value) < 0) {
      sheet.getCell(rowNumber, 10).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD7D7' },
      }
    }
  })

  const typeTitleRow = summaryHeaderRow + 6
  styleSectionTitle(sheet, typeTitleRow, 9, 13)
  sheet.getCell(typeTitleRow, 9).value = 'Totalizadores por tipo'

  const typeHeaderRow = typeTitleRow + 1
  setRowValues(sheet, typeHeaderRow, ['', '', '', '', '', '', '', '', 'Tipo', 'Membros', 'Capacity', 'Pontuado', 'Saldo'])
  styleHeader(sheet.getRow(typeHeaderRow), 9, 13)

  SPRINT_MEMBER_TYPES.forEach((type, index) => {
    const rowNumber = typeHeaderRow + 1 + index
    const total = summary.typeTotals[type]
    sheet.getCell(rowNumber, 9).value = getSprintMemberTypeLabel(type)
    sheet.getCell(rowNumber, 10).value = {
      formula: `COUNTIFS($A$${resourceHeaderRow + 1}:$A$${resourceTotalRow - 1},"Sim",$C$${resourceHeaderRow + 1}:$C$${resourceTotalRow - 1},I${rowNumber})`,
      result: total.members,
    }
    sheet.getCell(rowNumber, 11).value = {
      formula: `SUMIFS($D$${resourceHeaderRow + 1}:$D$${resourceTotalRow - 1},$A$${resourceHeaderRow + 1}:$A$${resourceTotalRow - 1},"Sim",$C$${resourceHeaderRow + 1}:$C$${resourceTotalRow - 1},I${rowNumber})`,
      result: total.capacity,
    }
    sheet.getCell(rowNumber, 12).value = {
      formula: `${POINT_TOTAL_COLUMNS[type]}${taskTotalRow}`,
      result: total.points,
    }
    sheet.getCell(rowNumber, 13).value = {
      formula: `K${rowNumber}-L${rowNumber}`,
      result: total.balance,
    }
    styleDataRange(sheet, rowNumber, 9, 13)
    const balanceFillArgb = getBalanceFillArgb(total.points, total.capacity)
    const balanceCell = sheet.getCell(rowNumber, 13)
    balanceCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: balanceFillArgb },
    }
    balanceCell.font = {
      bold: true,
      color: { argb: getBalanceFontArgb(balanceFillArgb) },
    }
  })

  for (let row = 1; row <= typeHeaderRow + SPRINT_MEMBER_TYPES.length; row += 1) {
    for (let col = 3; col <= 13; col += 1) {
      sheet.getCell(row, col).numFmt = '0.0'
    }
  }

  sheet.eachRow(row => {
    row.height = 22
  })
  sheet.getRow(1).height = 28
  addDistributionWorksheet(workbook, distribution, now)

  await downloadWorkbook(workbook, `${sanitizeFileName(planning.sprintName)}.xlsx`)
}
