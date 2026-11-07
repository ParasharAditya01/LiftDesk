import { requireSupabase } from './supabase'

const databaseName = 'liftdesk-chat-device-keys'
const storeName = 'devices'
const messagePrefix = 'LD-E2EE1:'
const maxRecipientDevices = 500
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type ChatDeviceKeys = {
  id: string
  publicKey: JsonWebKey
  publicKeyJson: string
  privateKey: CryptoKey
}

export type ChatEncryptionDevice = { id: string; public_key: string }
export type ChatMessageEncryptionStatus = 'encrypted' | 'legacy' | 'unavailable'

type StoredDeviceKeys = ChatDeviceKeys & { storageKey: string }
type MessageEnvelope = {
  version: 1
  ephemeralPublicKey: JsonWebKey
  salt: string
  iv: string
  ciphertext: string
  wrappedKeys: Record<string, { iv: string; ciphertext: string }>
}

const pendingDeviceKeys = new Map<string, Promise<ChatDeviceKeys>>()
const pendingRegistrations = new Map<string, Promise<ChatDeviceKeys>>()

function openKeyDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: 'storageKey' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open encrypted chat key storage.'))
    request.onblocked = () => reject(new Error('Encrypted chat key storage is busy. Close other LiftDesk tabs and try again.'))
  })
}

function readStoredKeys(storageKey: string) {
  return openKeyDatabase().then(database => new Promise<StoredDeviceKeys | undefined>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(storageKey)
    request.onsuccess = () => resolve(request.result as StoredDeviceKeys | undefined)
    request.onerror = () => reject(request.error ?? new Error('Could not read this device’s chat key.'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not read this device’s chat key.')) }
  }))
}

function writeStoredKeys(keys: StoredDeviceKeys) {
  return openKeyDatabase().then(database => new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(keys)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not save this device’s chat key.')) }
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Could not save this device’s chat key.')) }
  }))
}

async function createOrReadDeviceKeys(gymId: string, userId: string): Promise<ChatDeviceKeys> {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error('This browser cannot securely store an encrypted chat key. Update your browser and try again.')
  }
  const storageKey = `${gymId}:${userId}`
  const stored = await readStoredKeys(storageKey)
  if (stored) return stored
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) as CryptoKeyPair
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const keys: StoredDeviceKeys = {
    storageKey,
    id: crypto.randomUUID(),
    publicKey,
    publicKeyJson: JSON.stringify(publicKey),
    privateKey: pair.privateKey,
  }
  await writeStoredKeys(keys)
  return keys
}

export function getOrCreateChatDeviceKeys(gymId: string, userId: string) {
  const storageKey = `${gymId}:${userId}`
  const pending = pendingDeviceKeys.get(storageKey)
  if (pending) return pending
  const lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks
  const created = lockManager
    ? lockManager.request(`liftdesk-chat-key-${storageKey}`, { mode: 'exclusive' }, () => createOrReadDeviceKeys(gymId, userId))
    : createOrReadDeviceKeys(gymId, userId)
  pendingDeviceKeys.set(storageKey, created)
  void created.catch(() => pendingDeviceKeys.delete(storageKey))
  return created
}

async function registerChatDevice(gymId: string, userId: string) {
  const keys = await getOrCreateChatDeviceKeys(gymId, userId)
  const client = requireSupabase()
  const { data: existing, error: lookupError } = await client.from('gym_chat_devices')
    .select('id, gym_id, user_id, public_key')
    .eq('id', keys.id)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing) {
    if (existing.public_key !== keys.publicKeyJson || existing.gym_id !== gymId || existing.user_id !== userId) {
      throw new Error('This device key does not match the registered key.')
    }
    return keys
  }

  const { error: insertError } = await client.from('gym_chat_devices').insert({
    id: keys.id,
    gym_id: gymId,
    user_id: userId,
    public_key: keys.publicKeyJson,
  })
  if (!insertError) return keys
  const { data: racedDevice } = await client.from('gym_chat_devices')
    .select('id, gym_id, user_id, public_key')
    .eq('id', keys.id)
    .maybeSingle()
  if (!racedDevice || racedDevice.public_key !== keys.publicKeyJson || racedDevice.gym_id !== gymId || racedDevice.user_id !== userId) {
    throw insertError
  }
  return keys
}

export function ensureRegisteredChatDevice(gymId: string, userId: string) {
  const key = `${gymId}:${userId}`
  const pending = pendingRegistrations.get(key)
  if (pending) return pending
  const registration = registerChatDevice(gymId, userId)
  pendingRegistrations.set(key, registration)
  void registration.catch(() => pendingRegistrations.delete(key))
  return registration
}

function encodeBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length))
}

function keyContext(gymId: string, deviceId: string) {
  return `liftdesk-chat-key-v1:${gymId}:${deviceId}`
}

async function deriveWrappingKey(sharedSecret: ArrayBuffer, salt: Uint8Array, context: string, usage: KeyUsage[]) {
  const material = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(context) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  )
}

export async function encryptChatMessage(plaintext: string, gymId: string, devices: ChatEncryptionDevice[]) {
  const uniqueDevices = [...new Map(devices.map(device => [device.id, device])).values()]
  if (uniqueDevices.length === 0) throw new Error('No active gym chat devices are registered yet. Refresh chat and try again.')
  if (uniqueDevices.length > maxRecipientDevices) throw new Error('This gym has too many registered chat devices for one encrypted message. Ask LiftDesk support for help.')

  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawContentKey = await crypto.subtle.exportKey('raw', contentKey)
  const contentIv = randomBytes(12)
  const contentCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: contentIv, additionalData: encoder.encode(`liftdesk-chat-message-v1:${gymId}`) },
    contentKey,
    encoder.encode(plaintext),
  )
  const ephemeralPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) as CryptoKeyPair
  const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeralPair.publicKey)
  const salt = randomBytes(16)
  const wrappedKeyEntries = await Promise.all(uniqueDevices.map(async device => {
    const publicJwk = JSON.parse(device.public_key) as JsonWebKey
    const recipientPublicKey = await crypto.subtle.importKey('jwk', publicJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPublicKey }, ephemeralPair.privateKey, 256)
    const context = keyContext(gymId, device.id)
    const wrappingKey = await deriveWrappingKey(sharedSecret, salt, context, ['encrypt'])
    const iv = randomBytes(12)
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, wrappingKey, rawContentKey,
    )
    return [device.id, { iv: encodeBase64(iv), ciphertext: encodeBase64(new Uint8Array(ciphertext)) }] as const
  }))
  const envelope: MessageEnvelope = {
    version: 1,
    ephemeralPublicKey,
    salt: encodeBase64(salt),
    iv: encodeBase64(contentIv),
    ciphertext: encodeBase64(new Uint8Array(contentCiphertext)),
    wrappedKeys: Object.fromEntries(wrappedKeyEntries),
  }
  return messagePrefix + encodeBase64(encoder.encode(JSON.stringify(envelope)))
}

export async function decryptChatMessage(
  storedBody: string,
  gymId: string,
  device: Pick<ChatDeviceKeys, 'id' | 'privateKey'>,
): Promise<{ body: string; encryptionStatus: ChatMessageEncryptionStatus }> {
  if (!storedBody.startsWith(messagePrefix)) return { body: storedBody, encryptionStatus: 'legacy' }
  try {
    const envelope = JSON.parse(decoder.decode(decodeBase64(storedBody.slice(messagePrefix.length)))) as MessageEnvelope
    if (envelope.version !== 1 || !envelope.wrappedKeys?.[device.id]) {
      return { body: 'This message is not available on this device.', encryptionStatus: 'unavailable' }
    }
    const wrappedKey = envelope.wrappedKeys[device.id]
    const ephemeralPublicKey = await crypto.subtle.importKey('jwk', envelope.ephemeralPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeralPublicKey }, device.privateKey, 256)
    const context = keyContext(gymId, device.id)
    const wrappingKey = await deriveWrappingKey(sharedSecret, decodeBase64(envelope.salt), context, ['decrypt'])
    const rawContentKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodeBase64(wrappedKey.iv), additionalData: encoder.encode(context) },
      wrappingKey,
      decodeBase64(wrappedKey.ciphertext),
    )
    const contentKey = await crypto.subtle.importKey('raw', rawContentKey, { name: 'AES-GCM' }, false, ['decrypt'])
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodeBase64(envelope.iv), additionalData: encoder.encode(`liftdesk-chat-message-v1:${gymId}`) },
      contentKey,
      decodeBase64(envelope.ciphertext),
    )
    return { body: decoder.decode(plaintext), encryptionStatus: 'encrypted' }
  } catch {
    return { body: 'This message could not be decrypted on this device.', encryptionStatus: 'unavailable' }
  }
}
