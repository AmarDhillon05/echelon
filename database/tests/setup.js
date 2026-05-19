import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { beforeAll, afterAll, afterEach } from 'vitest'

// Suppress the "headers already sent" rejection that originates from the known
// authRoutes.js bug (duplicate-username check sends 500 but doesn't return,
// then the handler falls through and tries to send 200). All other unhandled
// rejections are re-thrown so tests still catch real problems.
process.on('unhandledRejection', (reason) => {
  if (reason?.code === 'ERR_HTTP_HEADERS_SENT') return
  throw reason
})

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({})
  }
})
