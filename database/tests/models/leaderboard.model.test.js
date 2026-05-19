import { describe, it, expect } from 'vitest'
import Leaderboard from '../../models/leaderboard.model.js'

describe('Leaderboard model', () => {
  it('creates a leaderboard with required fields', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard' })
    expect(ld.host).toBe('user1')
    expect(ld.name).toBe('myboard')
  })

  it('defaults description to "No Description Provided"', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard' })
    expect(ld.description).toBe('No Description Provided')
  })

  it('defaults locked to false', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard' })
    expect(ld.locked).toBe(false)
  })

  it('defaults submissions to empty object', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard' })
    expect(ld.submissions).toEqual({})
  })

  it('defaults required to empty array', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard' })
    expect(ld.required).toEqual([])
  })

  it('stores a custom description', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard', description: 'My custom desc' })
    expect(ld.description).toBe('My custom desc')
  })

  it('stores required fields schema', async () => {
    const required = [{ name: 'title', type: 'text', list: 'no', amount: '1', important: 'yes' }]
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard', required })
    expect(ld.required).toHaveLength(1)
    expect(ld.required[0].name).toBe('title')
  })

  it('stores locked: true when specified', async () => {
    const ld = await Leaderboard.create({ host: 'user1', name: 'myboard', locked: true })
    expect(ld.locked).toBe(true)
  })

  it('fails without host', async () => {
    await expect(Leaderboard.create({ name: 'myboard' })).rejects.toThrow()
  })

  it('fails without name', async () => {
    await expect(Leaderboard.create({ host: 'user1' })).rejects.toThrow()
  })
})
