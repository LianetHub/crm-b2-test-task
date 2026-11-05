import { expect, it } from 'vitest'
import { readAll } from '../../src/lib/readAll'

it('loads records beyond the API page limit without truncating lists', async () => {
  const records = Array.from({ length: 1203 }, (_, id) => ({ id }))
  const ranges: number[][] = []
  const result = await readAll(async (from, to) => {
    ranges.push([from, to])
    return { data: records.slice(from, to + 1), error: null }
  })
  expect(result).toHaveLength(1203)
  expect(result.at(-1)).toEqual({ id: 1202 })
  expect(ranges).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ])
})

it('does not present a partially loaded list as complete when a page fails', async () => {
  await expect(
    readAll(async (from) =>
      from === 0
        ? { data: Array.from({ length: 500 }, (_, id) => id), error: null }
        : { data: null, error: new Error('offline') },
    ),
  ).rejects.toThrow('offline')
})
