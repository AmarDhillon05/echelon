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
        fetch: async () => ({ records: {} }),
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

const { default: ldRouter } = await import('../../routes/ldRoutes.js')

const app = express()
app.use(express.json())
app.use('/', ldRouter)

describe('GET /', () => {
  it('returns a health check message', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Hello from the leaderboard API!')
  })
})

describe('POST /createLeaderboard', () => {
  it('creates a leaderboard successfully', async () => {
    const res = await request(app).post('/createLeaderboard').send({
      name: 'My Leaderboard',
      host: 'user1',
      description: 'Top films',
      required: [],
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.leaderboard).toBeDefined()
  })

  it('rejects a request missing name or host with 400', async () => {
    const res = await request(app).post('/createLeaderboard').send({ name: 'No Host' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBeDefined()
  })

  it('rejects a duplicate leaderboard name with 409', async () => {
    await request(app).post('/createLeaderboard').send({ name: 'Unique Board', host: 'user1' })
    const res = await request(app).post('/createLeaderboard').send({ name: 'Unique Board', host: 'user2' })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/already taken/i)
  })

  it('links the new leaderboard ID to the host user if they exist', async () => {
    const User = (await import('../../models/user.model.js')).default
    await User.create({ username: 'hostuser', email: 'host@test.com', password: 'pw' })

    const res = await request(app).post('/createLeaderboard').send({ name: 'Linked Board', host: 'hostuser' })
    expect(res.status).toBe(201)
    expect(res.body.data.user.leaderboardIds).toHaveLength(1)
  })
})

describe('POST /createSubmission', () => {
  let ldId

  beforeEach(async () => {
    const ldRes = await request(app).post('/createLeaderboard').send({
      name: 'Test Board',
      host: 'user1',
      required: [{ name: 'title', type: 'text', list: 'no', amount: '1', important: 'no' }],
    })
    ldId = ldRes.body.data.leaderboard._id
  })

  it('creates a submission successfully', async () => {
    const res = await request(app).post('/createSubmission').send({
      name: 'My Entry',
      leaderboard: 'Test Board',
      contributors: ['user1'],
      data: { title: 'My Entry text' },
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.submission.elo).toBe(100)
    expect(res.body.data.submission.rank).toBe(1)
  })

  it('rejects a request missing required top-level fields with 400', async () => {
    const res = await request(app).post('/createSubmission').send({
      name: 'Incomplete',
      leaderboard: 'Test Board',
    })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects submission to a non-existent leaderboard with 404', async () => {
    const res = await request(app).post('/createSubmission').send({
      name: 'Entry',
      leaderboard: 'Does Not Exist',
      contributors: ['user1'],
      data: {},
    })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('rejects a duplicate submission name with 409', async () => {
    const payload = { name: 'Dup Entry', leaderboard: 'Test Board', contributors: ['user1'], data: { title: 'text' } }
    await request(app).post('/createSubmission').send(payload)
    const res = await request(app).post('/createSubmission').send(payload)
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
  })

  it('rejects submission to a locked leaderboard with 403', async () => {
    const Ld = (await import('../../models/leaderboard.model.js')).default
    await Ld.findByIdAndUpdate(ldId, { locked: true })
    const res = await request(app).post('/createSubmission').send({
      name: 'Locked Entry',
      leaderboard: 'Test Board',
      contributors: ['user1'],
      data: { title: 'text' },
    })
    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })

  it('rejects submission missing a required data field with 400', async () => {
    await request(app).post('/createLeaderboard').send({
      name: 'Strict Board',
      host: 'user1',
      required: [{ name: 'score', type: 'text', list: 'no', amount: '1', important: 'no' }],
    })
    const res = await request(app).post('/createSubmission').send({
      name: 'Missing Field Entry',
      leaderboard: 'Strict Board',
      contributors: ['user1'],
      data: {},
    })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/Missing key/i)
  })

  it('assigns incremental ranks to submissions', async () => {
    const base = { leaderboard: 'Test Board', contributors: ['user1'], data: { title: 'x' } }
    const r1 = await request(app).post('/createSubmission').send({ ...base, name: 'First' })
    const r2 = await request(app).post('/createSubmission').send({ ...base, name: 'Second' })
    expect(r1.body.data.submission.rank).toBe(1)
    expect(r2.body.data.submission.rank).toBe(2)
  })
})

describe('POST /searchForLd', () => {
  beforeEach(async () => {
    await request(app).post('/createLeaderboard').send({ name: 'Alpha Board', host: 'user1' })
    await request(app).post('/createLeaderboard').send({ name: 'Beta Board', host: 'user1' })
  })

  it('returns matching leaderboards by name prefix', async () => {
    const res = await request(app).post('/searchForLd').send({ leaderboard: 'Alpha' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.results.some((r) => r.name === 'Alpha Board')).toBe(true)
  })

  it('falls back to all leaderboards when no name matches', async () => {
    const res = await request(app).post('/searchForLd').send({ leaderboard: 'ZZZ no match' })
    expect(res.status).toBe(200)
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(2)
  })

  it('returns 400 when leaderboard query is missing', async () => {
    const res = await request(app).post('/searchForLd').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /getLeaderboardById', () => {
  it('returns a leaderboard with decoded name and order array', async () => {
    const created = await request(app).post('/createLeaderboard').send({ name: 'Get By ID Board', host: 'user1' })
    const id = created.body.data.leaderboard._id

    const res = await request(app).post('/getLeaderboardById').send({ id })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.leaderboard.name).toBe('Get By ID Board')
    expect(Array.isArray(res.body.data.leaderboard.order)).toBe(true)
  })

  it('returns 404 for a non-existent ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const res = await request(app).post('/getLeaderboardById').send({ id: fakeId })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when id is missing', async () => {
    const res = await request(app).post('/getLeaderboardById').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /getSubmissionById', () => {
  it('returns a submission with decoded name', async () => {
    await request(app).post('/createLeaderboard').send({ name: 'Sub Fetch Board', host: 'user1' })
    const subRes = await request(app).post('/createSubmission').send({
      name: 'Fetchable Sub',
      leaderboard: 'Sub Fetch Board',
      contributors: ['user1'],
      data: {},
    })
    const id = subRes.body.data.submission._id

    const res = await request(app).post('/getSubmissionById').send({ id })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.submission.name).toBe('Fetchable Sub')
  })

  it('returns 404 for a non-existent ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString()
    const res = await request(app).post('/getSubmissionById').send({ id: fakeId })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /toggleLock', () => {
  it('locks a leaderboard', async () => {
    const created = await request(app).post('/createLeaderboard').send({ name: 'Lockable Board', host: 'user1' })
    const id = created.body.data.leaderboard._id

    const res = await request(app).post('/toggleLock').send({ id, lock: true })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const Ld = (await import('../../models/leaderboard.model.js')).default
    expect((await Ld.findById(id)).locked).toBe(true)
  })

  it('unlocks a leaderboard', async () => {
    const Ld = (await import('../../models/leaderboard.model.js')).default
    const created = await request(app).post('/createLeaderboard').send({ name: 'Unlock Board', host: 'user1' })
    const id = created.body.data.leaderboard._id
    await Ld.findByIdAndUpdate(id, { locked: true })

    const res = await request(app).post('/toggleLock').send({ id, lock: false })
    expect(res.status).toBe(200)
    expect((await Ld.findById(id)).locked).toBe(false)
  })

  it('returns 400 when id is missing', async () => {
    const res = await request(app).post('/toggleLock').send({ lock: true })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
