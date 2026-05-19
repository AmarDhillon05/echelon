import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'

vi.mock('../../config/db.config.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: class MockPinecone {
    Index() {
      return {
        fetch: async (ids) => {
          const records = {}
          for (const id of ids) records[id] = { values: Array(1024).fill(0.1) }
          return { records }
        },
        query: async () => ({ matches: [] }),
        upsert: async () => ({}),
        deleteAll: async () => ({}),
        deleteOne: async () => ({}),
      }
    }
  },
}))

vi.mock('../../utils/slug.js', async () => {
  const actual = await vi.importActual('../../utils/slug.js')
  return { ...actual, embed: async () => Array(1024).fill(0.1) }
})

const { default: rankRouter } = await import('../../routes/rankRoutes.js')

const app = express()
app.use(express.json())
app.use('/', rankRouter)

async function seedRankFixture({ winnerElo = 100, loserElo = 100 } = {}) {
  const { encodeString } = await import('../../utils/slug.js')
  const Leaderboard = (await import('../../models/leaderboard.model.js')).default
  const Submission = (await import('../../models/submission.model.js')).default

  const ldName = encodeString('Rank Board')
  const ld = await Leaderboard.create({ host: 'user1', name: ldName, required: [] })

  const winnerName = encodeString('Winner Sub')
  const loserName = encodeString('Loser Sub')

  const winner = await Submission.create({ leaderboard: ldName, name: winnerName, rank: 1, elo: winnerElo })
  const loser = await Submission.create({ leaderboard: ldName, name: loserName, rank: 2, elo: loserElo })

  await Leaderboard.updateOne({ _id: ld._id }, {
    $set: {
      submissions: {
        [winnerName]: { elo: winnerElo, rank: 1, subid: winner._id.toString() },
        [loserName]: { elo: loserElo, rank: 2, subid: loser._id.toString() },
      },
    },
  })

  return { ld, winner, loser }
}

describe('POST /rank', () => {
  it('returns 400 when winner or loser ID is missing', async () => {
    const res = await request(app).post('/rank').send({ winner: 'someid', similarity: 1 })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 404 when winner or loser cannot be found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const res = await request(app).post('/rank').send({ winner: fakeId, loser: fakeId, similarity: 1 })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('updates Elo correctly for equal-rated submissions with similarity=1', async () => {
    const { winner, loser } = await seedRankFixture()
    const res = await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 1,
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const Submission = (await import('../../models/submission.model.js')).default
    const updatedWinner = await Submission.findById(winner._id)
    const updatedLoser = await Submission.findById(loser._id)

    // Equal elos: e = 0.5, change = 40 * 1 * 0.5 = 20
    expect(updatedWinner.elo).toBeCloseTo(120, 1)
    // Loser drops to 80 but is clamped to 100
    expect(updatedLoser.elo).toBe(100)
  })

  it('applies no Elo change when similarity=0', async () => {
    const { winner, loser } = await seedRankFixture()
    await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 0,
    })

    const Submission = (await import('../../models/submission.model.js')).default
    expect((await Submission.findById(winner._id)).elo).toBeCloseTo(100, 1)
    expect((await Submission.findById(loser._id)).elo).toBeCloseTo(100, 1)
  })

  it('correctly computes Elo when winner has a much higher rating than the loser', async () => {
    const { winner, loser } = await seedRankFixture({ winnerElo: 300, loserElo: 100 })
    await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 1,
    })

    const Submission = (await import('../../models/submission.model.js')).default
    const updatedWinner = await Submission.findById(winner._id)

    // Non-standard Elo: e = 1/(1+10^((100-300)/400)) ≈ 0.76 → change ≈ 30.4
    expect(updatedWinner.elo).toBeGreaterThan(300)
    expect(updatedWinner.elo).toBeCloseTo(330, 0)
  })

  it('enforces an Elo floor of 100 for the loser', async () => {
    const { winner, loser } = await seedRankFixture({ winnerElo: 200, loserElo: 100 })
    await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 1,
    })

    const Submission = (await import('../../models/submission.model.js')).default
    expect((await Submission.findById(loser._id)).elo).toBeGreaterThanOrEqual(100)
  })

  it('re-sorts ranks in the leaderboard after voting', async () => {
    const { ld, winner, loser } = await seedRankFixture()
    await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 1,
    })

    const Leaderboard = (await import('../../models/leaderboard.model.js')).default
    const subs = (await Leaderboard.findById(ld._id)).submissions
    const winnerEntry = Object.values(subs).find((s) => s.subid === winner._id.toString())
    const loserEntry = Object.values(subs).find((s) => s.subid === loser._id.toString())
    expect(winnerEntry.rank).toBe(1)
    expect(loserEntry.rank).toBe(2)
  })

  it('scales Elo change proportionally with similarity', async () => {
    const { winner } = await seedRankFixture()
    const { loser } = await seedRankFixture()
    await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 0.5,
    })

    const Submission = (await import('../../models/submission.model.js')).default
    // similarity=0.5 → change = 40 * 0.5 * 0.5 = 10
    expect((await Submission.findById(winner._id)).elo).toBeCloseTo(110, 1)
  })

  it('increments n_votes on the leaderboard after a successful rank', async () => {
    const { ld, winner, loser } = await seedRankFixture()
    await request(app).post('/rank').send({
      winner: winner._id.toString(),
      loser: loser._id.toString(),
      similarity: 1,
    })

    const Leaderboard = (await import('../../models/leaderboard.model.js')).default
    const updatedLd = await Leaderboard.findById(ld._id)
    expect(updatedLd.n_votes).toBe(1)
  })
})
