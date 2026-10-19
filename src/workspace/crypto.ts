import {
  WORKSPACE_ENCRYPTED_FORMAT,
  ENVELOPE_VERSION,
  type EncryptedEnvelope,
} from './types'

// Web Crypto only (globalThis.crypto.subtle): no dependency, nothing leaves the machine.
export const KDF_ITERATIONS = 310_000
const KEY_BITS = 256
const SALT_BYTES = 16
const IV_BYTES = 12
const VERIFIER_LABEL = 'rhps-workspace-verifier:'

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const CHUNK = 0x8000

export const isBase64 = (value: unknown): value is string => typeof value === 'string' && BASE64.test(value)

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto as Crypto | undefined
  if (!api?.subtle) throw new Error('Encryption is not available here (it needs a secure page).')
  return api.subtle
}

const utf8 = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text)

/** The 256-bit key bytes from the password (PBKDF2, SHA-256). */
async function deriveKeyBytes(password: string, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const base = await subtle().importKey('raw', utf8(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: KDF_ITERATIONS },
    base,
    KEY_BITS,
  )
  return new Uint8Array(bits)
}

async function verifierOf(keyBytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const label = utf8(VERIFIER_LABEL)
  const joined = new Uint8Array(label.length + keyBytes.length)
  joined.set(label)
  joined.set(keyBytes, label.length)
  return toBase64(new Uint8Array(await subtle().digest('SHA-256', joined)))
}

const aesKey = (keyBytes: Uint8Array<ArrayBuffer>, usage: KeyUsage): Promise<CryptoKey> =>
  subtle().importKey('raw', keyBytes, 'AES-GCM', false, [usage])

/** Encrypts a serialised workspace under a password. A fresh salt and iv every time. */
export async function encryptWorkspace(json: string, password: string): Promise<string> {
  if (password === '') throw new Error('A password is needed to encrypt a workspace.')
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const keyBytes = await deriveKeyBytes(password, salt)
  const data = await subtle().encrypt({ name: 'AES-GCM', iv }, await aesKey(keyBytes, 'encrypt'), utf8(json))
  const envelope: EncryptedEnvelope = {
    format: WORKSPACE_ENCRYPTED_FORMAT,
    version: ENVELOPE_VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: KDF_ITERATIONS,
      salt: toBase64(salt),
      verifier: await verifierOf(keyBytes),
    },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data)),
  }
  return JSON.stringify(envelope)
}

export type DecryptResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly code: 'WRONG_PASSWORD' | 'CORRUPT' }

/** Decrypts a checked envelope: a wrong password and a damaged file give different codes. */
export async function decryptEnvelope(envelope: EncryptedEnvelope, password: string): Promise<DecryptResult> {
  const keyBytes = await deriveKeyBytes(password, fromBase64(envelope.kdf.salt))
  if ((await verifierOf(keyBytes)) !== envelope.kdf.verifier) return { ok: false, code: 'WRONG_PASSWORD' }
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) },
      await aesKey(keyBytes, 'decrypt'),
      fromBase64(envelope.data),
    )
    return { ok: true, json: new TextDecoder().decode(plain) }
  } catch {
    return { ok: false, code: 'CORRUPT' }
  }
}
