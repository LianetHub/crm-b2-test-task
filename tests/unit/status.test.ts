import { describe, expect, it } from 'vitest'
import { availableActions } from '../../src/features/tasks/status'

describe('available task actions', () => {
  it('only lets the assigned executor start or submit work', () => {
    expect(availableActions('executor', 'new', true).map((a) => a.target)).toEqual(['in_progress'])
    expect(availableActions('executor', 'in_progress', true).map((a) => a.target)).toEqual(['review'])
    expect(availableActions('executor', 'rework', true).map((a) => a.target)).toEqual(['in_progress'])
    expect(availableActions('executor', 'new', false)).toEqual([])
    expect(availableActions('executor', 'review', true)).toEqual([])
  })
  it('only lets dispatchers review and requires a rework comment', () => {
    expect(availableActions('dispatcher', 'review', false)).toEqual([
      { target: 'accepted', label: 'Принять задачу', requiresComment: false },
      { target: 'rework', label: 'На доработку', requiresComment: true },
    ])
    for (const status of ['new', 'in_progress', 'rework', 'accepted'] as const) {
      expect(availableActions('dispatcher', status, false)).toEqual([])
    }
  })
})
