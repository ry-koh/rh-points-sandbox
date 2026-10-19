import { describe, expect, it } from 'vitest'
import { fnv1a32 } from '../hash'

describe('fnv1a32', () => {
  it('matches the published FNV-1a 32-bit values', () => {
    expect(fnv1a32('')).toBe('811c9dc5')
    expect(fnv1a32('a')).toBe('e40c292c')
    expect(fnv1a32('foobar')).toBe('bf9cf968')
  })

  it('is 8 lowercase hex characters, zero-padded', () => {
    const texts = ['', 'a', 'points', 'ccaID,matric\nC1,A9900001Z\n', 'é']
    for (const text of texts) expect(fnv1a32(text)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('tells CRLF and LF texts apart', () => {
    expect(fnv1a32('a,b\r\n1,2\r\n')).not.toBe(fnv1a32('a,b\n1,2\n'))
  })
})
