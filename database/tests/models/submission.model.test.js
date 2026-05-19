import { describe, it, expect } from 'vitest'
import Submission from '../../models/submission.model.js'

describe('Submission model', () => {
  it('creates a submission with all required fields', async () => {
    const sub = await Submission.create({ leaderboard: 'ld1', name: 'sub1', rank: 1 })
    expect(sub.leaderboard).toBe('ld1')
    expect(sub.name).toBe('sub1')
    expect(sub.rank).toBe(1)
  })

  it('defaults elo to 100', async () => {
    const sub = await Submission.create({ leaderboard: 'ld1', name: 'sub1', rank: 1 })
    expect(sub.elo).toBe(100)
  })

  it('defaults likes to 0', async () => {
    const sub = await Submission.create({ leaderboard: 'ld1', name: 'sub1', rank: 1 })
    expect(sub.likes).toBe(0)
  })

  it('defaults data to empty object', async () => {
    const sub = await Submission.create({ leaderboard: 'ld1', name: 'sub1', rank: 1 })
    expect(sub.data).toEqual({})
  })

  it('stores arbitrary data payload', async () => {
    const data = { title: 'My Entry', description: 'some text' }
    const sub = await Submission.create({ leaderboard: 'ld1', name: 'sub1', rank: 1, data })
    expect(sub.data.title).toBe('My Entry')
  })

  it('stores contributors list', async () => {
    const sub = await Submission.create({
      leaderboard: 'ld1',
      name: 'sub1',
      rank: 1,
      contributors: ['user1', 'user2'],
    })
    expect(sub.contributors).toEqual(['user1', 'user2'])
  })

  it('fails without leaderboard', async () => {
    await expect(Submission.create({ name: 'sub1', rank: 1 })).rejects.toThrow()
  })

  it('fails without name', async () => {
    await expect(Submission.create({ leaderboard: 'ld1', rank: 1 })).rejects.toThrow()
  })

  it('fails without rank', async () => {
    await expect(Submission.create({ leaderboard: 'ld1', name: 'sub1' })).rejects.toThrow()
  })
})
