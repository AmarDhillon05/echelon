import { vi, describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../config/db.config.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}))

const { default: authRouter } = await import('../../routes/authRoutes.js')

const app = express()
app.use(express.json())
app.use('/', authRouter)

describe('GET /', () => {
  it('returns a health check message', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Hello from the users api!')
  })
})

describe('POST /create', () => {
  it('creates a user successfully', async () => {
    const res = await request(app).post('/create').send({
      username: 'newuser',
      password: 'password123',
      email: 'newuser@test.com',
    })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.username).toBe('newuser')
    expect(res.body.data.user.email).toBe('newuser@test.com')
  })

  it('hashes the password — plaintext is not stored', async () => {
    const res = await request(app).post('/create').send({
      username: 'hashtest',
      password: 'plaintextpassword',
      email: 'hash@test.com',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.user.password).not.toBe('plaintextpassword')
    expect(res.body.data.user.password.length).toBeGreaterThan(20)
  })

  it('rejects a duplicate username with 409', async () => {
    await request(app).post('/create').send({ username: 'dupuser', password: 'pw1', email: 'dup1@test.com' })
    const res = await request(app).post('/create').send({ username: 'dupuser', password: 'pw2', email: 'dup2@test.com' })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/Username is already taken/i)
  })

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/create').send({ username: 'user1', password: 'pw', email: 'shared@test.com' })
    const res = await request(app).post('/create').send({ username: 'user2', password: 'pw', email: 'shared@test.com' })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/Email is already taken/i)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/create').send({ username: 'nopassword' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBeDefined()
  })
})

describe('POST /sign-in', () => {
  beforeEach(async () => {
    await request(app).post('/create').send({
      username: 'loginuser',
      password: 'correctpassword',
      email: 'login@test.com',
    })
  })

  it('signs in with correct credentials', async () => {
    const res = await request(app).post('/sign-in').send({
      username: 'loginuser',
      password: 'correctpassword',
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.username).toBe('loginuser')
  })

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/sign-in').send({
      username: 'loginuser',
      password: 'wrongpassword',
    })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/Incorrect Password/i)
  })

  it('rejects an unknown username with 401', async () => {
    const res = await request(app).post('/sign-in').send({ username: 'doesnotexist', password: 'whatever' })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/Invalid Username/i)
  })

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/sign-in').send({ username: 'loginuser' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('POST /get-user-data', () => {
  beforeEach(async () => {
    await request(app).post('/create').send({ username: 'findme', password: 'pw', email: 'findme@test.com' })
  })

  it('finds a user by email', async () => {
    const res = await request(app).post('/get-user-data').send({ email: 'findme@test.com' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.username).toBe('findme')
  })

  it('finds a user by username', async () => {
    const res = await request(app).post('/get-user-data').send({ username: 'findme' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.email).toBe('findme@test.com')
  })

  it('returns 404 when no user matches the email', async () => {
    const res = await request(app).post('/get-user-data').send({ email: 'ghost@test.com' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('returns 404 when no user matches the username', async () => {
    const res = await request(app).post('/get-user-data').send({ username: 'ghost' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when neither email nor username is provided', async () => {
    const res = await request(app).post('/get-user-data').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})
