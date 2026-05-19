import { describe, it, expect } from 'vitest'
import {
  encodeString,
  decodeString,
  dummyEmbed,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../../utils/slug.js'

describe('encodeString / decodeString', () => {
  it('round-trips a simple string', () => {
    const original = 'hello world'
    expect(decodeString(encodeString(original))).toBe(original)
  })

  it('round-trips strings with special characters', () => {
    const original = 'Test Leaderboard #1 & more! (special)'
    expect(decodeString(encodeString(original))).toBe(original)
  })

  it('round-trips a JSON string', () => {
    const original = JSON.stringify({ name: 'sub1', leaderboard: 'board1' })
    expect(decodeString(encodeString(original))).toBe(original)
  })

  it('round-trips an empty string', () => {
    expect(decodeString(encodeString(''))).toBe('')
  })

  it('round-trips a long string', () => {
    const original = 'a'.repeat(1000)
    expect(decodeString(encodeString(original))).toBe(original)
  })

  it('produces URL-safe output (no +, /, or = characters)', () => {
    const encoded = encodeString('some string to test URL safety with various characters!')
    expect(encoded).not.toMatch(/[+/=]/)
  })

  it('same input always produces same output', () => {
    const str = 'deterministic test'
    expect(encodeString(str)).toBe(encodeString(str))
  })
})

describe('dummyEmbed', () => {
  it('returns a 1024-dimension array', () => {
    expect(dummyEmbed()).toHaveLength(1024)
  })

  it('all values are numbers in the range [-1, 1]', () => {
    for (const val of dummyEmbed()) {
      expect(typeof val).toBe('number')
      expect(val).toBeGreaterThanOrEqual(-1)
      expect(val).toBeLessThanOrEqual(1)
    }
  })

  it('produces different embeddings on successive calls', () => {
    expect(dummyEmbed()).not.toEqual(dummyEmbed())
  })
})

describe('uint8ArrayToBase64 / base64ToUint8Array', () => {
  it('round-trips a byte array', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const recovered = base64ToUint8Array(uint8ArrayToBase64(original))
    expect(Array.from(recovered)).toEqual(Array.from(original))
  })

  it('round-trips a large byte array without call stack overflow', () => {
    const original = new Uint8Array(100_000).fill(42)
    const recovered = base64ToUint8Array(uint8ArrayToBase64(original))
    expect(recovered.length).toBe(original.length)
    expect(recovered[0]).toBe(42)
  })
})
