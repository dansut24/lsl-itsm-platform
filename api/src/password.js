import { scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export async function verifyPassword(password, encodedHash) {
  const [scheme, nText, rText, pText, saltText, hashText] = String(encodedHash || '').split('$')
  if (scheme !== 'scrypt' || !nText || !rText || !pText || !saltText || !hashText) return false

  const expected = Buffer.from(hashText, 'base64url')
  const salt = Buffer.from(saltText, 'base64url')
  const N = Number(nText)
  const r = Number(rText)
  const p = Number(pText)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || expected.length !== 64) return false

  const derived = await scryptAsync(String(password || ''), salt, expected.length, {
    N,
    r,
    p,
    maxmem: 64 * 1024 * 1024,
  })

  const actual = Buffer.from(derived)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
