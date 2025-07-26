export const colors = [
  { max: 20, color: 'bg-blue-500' },
  { max: 75, color: 'bg-yellow-400' },
  { max: 99, color: 'bg-orange-400' },
  { max: 100, color: 'bg-green-500' },
  { max: Infinity, color: 'bg-red-500' },
]

export function getColor(percent: number): string {
  return colors.find(c => percent <= c.max)!.color
}
