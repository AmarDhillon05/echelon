import { describe, it, expect } from 'vitest'
import User from '../../models/user.model.js'

describe('User model', () => {
  it('creates a user with all required fields', async () => {
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpw',
    })
    expect(user.username).toBe('testuser')
    expect(user.email).toBe('test@example.com')
    expect(user.password).toBe('hashedpw')
  })

  it('defaults leaderboardIds and submissions to empty arrays', async () => {
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpw',
    })
    expect(user.leaderboardIds).toEqual([])
    expect(user.submissions).toEqual([])
  })

  it('stores values pushed into leaderboardIds and submissions', async () => {
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpw',
      leaderboardIds: ['ld1', 'ld2'],
      submissions: ['sub1'],
    })
    expect(user.leaderboardIds).toEqual(['ld1', 'ld2'])
    expect(user.submissions).toEqual(['sub1'])
  })

  it('fails without username', async () => {
    await expect(
      User.create({ email: 'test@example.com', password: 'pw' })
    ).rejects.toThrow()
  })

  it('fails without email', async () => {
    await expect(
      User.create({ username: 'testuser', password: 'pw' })
    ).rejects.toThrow()
  })

  it('fails without password', async () => {
    await expect(
      User.create({ username: 'testuser', email: 'test@example.com' })
    ).rejects.toThrow()
  })
})
