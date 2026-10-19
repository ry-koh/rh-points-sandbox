const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

/**
 * FNV-1a (32-bit) of the text's UTF-8 bytes, as 8 lowercase hex characters. Not a security
 * hash: it only tells whether a leader file changed since its CCA was vetted (spec 6.5).
 */
export function fnv1a32(text: string): string {
  let hash = FNV_OFFSET_BASIS
  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
