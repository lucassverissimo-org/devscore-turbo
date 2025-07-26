export function getPointValues(type) {
  return type === 'hrs'
    ? [2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40]
    : [1, 2, 3, 5, 8, 13]
}
