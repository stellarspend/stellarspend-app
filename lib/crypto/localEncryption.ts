/**
 * Local encryption utility using WebCrypto API
 * Uses PBKDF2 for key derivation and AES-GCM for encryption
 */

export interface EncryptionConfig {
  passphrase: string;
  salt?: string;
}

/** Raw byte-length of the salt (16 random bytes). */
const SALT_BYTES = 16;
/** String length of the salt after hex encoding (16 bytes → 32 hex chars). */
const SALT_HEX_LENGTH = SALT_BYTES * 2;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

const STORAGE_KEYS = {
  ENCRYPTED_PREFIX: 'stellarspend_encrypted_',
  SALT_KEY: 'stellarspend_encryption_salt',
  PASSPHRASE_SET: 'stellarspend_passphrase_set',
} as const;

/**
 * Generate a random salt
 */
export function generateSalt(): string {
  const array = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive an encryption key from a passphrase and salt
 */
async function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with a passphrase
 */
export async function encryptData(data: unknown, passphrase: string): Promise<string> {
  const salt = generateSalt();
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encodedData = encoder.encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  );

  // Combine salt + iv + encrypted data, all as base64.
  // The salt hex string is always SALT_HEX_LENGTH (32) chars, which encodes
  // to exactly 32 UTF-8 bytes. The decrypt path must match this with the
  // same constant rather than the raw byte count.
  const combined = new Uint8Array(SALT_HEX_LENGTH + iv.length + encrypted.byteLength);
  combined.set(new TextEncoder().encode(salt), 0);
  combined.set(iv, SALT_HEX_LENGTH);
  combined.set(new Uint8Array(encrypted), SALT_HEX_LENGTH + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with a passphrase
 */
export async function decryptData<T>(encryptedData: string, passphrase: string): Promise<T> {
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // The salt was stored as UTF-8 hex chars: SALT_HEX_LENGTH (32) bytes.
  const salt = new TextDecoder().decode(combined.slice(0, SALT_HEX_LENGTH));
  const iv = combined.slice(SALT_HEX_LENGTH, SALT_HEX_LENGTH + IV_LENGTH);
  const encrypted = combined.slice(SALT_HEX_LENGTH + IV_LENGTH);

  const key = await deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

/**
 * Save encrypted data to localStorage
 */
export async function saveEncrypted(key: string, data: unknown, passphrase: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const encrypted = await encryptData(data, passphrase);
  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PREFIX + key, encrypted);
}

/**
 * Load and decrypt data from localStorage
 */
export async function loadEncrypted<T>(key: string, passphrase: string): Promise<T | null> {
  if (typeof window === 'undefined') return null;

  const encrypted = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PREFIX + key);
  if (!encrypted) return null;
  try {
    return await decryptData<T>(encrypted, passphrase);
  } catch {
    return null;
  }
}

/**
 * Check if data is encrypted (vs plaintext)
 */
export function isEncrypted(key: string): boolean {
  if (typeof window === 'undefined') return false;

  const data = localStorage.getItem(key);
  if (!data) return false;
  // Encrypted data starts with base64 characters and has length > 50
  return data.length > 50 && /^[A-Za-z0-9+/=]+$/.test(data);
}

/**
 * Save plaintext data (migration helper)
 */
export function savePlaintext(key: string, data: unknown): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Load plaintext data (migration helper)
 */
export function loadPlaintext<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Remove stored data
 */
export function removeStoredData(key: string): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(key);
  localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_PREFIX + key);
}

/**
 * Check if passphrase is set
 */
export function isPassphraseSet(): boolean {
  if (typeof window === 'undefined') return false;

  return localStorage.getItem(STORAGE_KEYS.PASSPHRASE_SET) === 'true';
}

/**
 * Set passphrase flag
 */
export function setPassphraseSet(): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.PASSPHRASE_SET, 'true');
}

/**
 * Reset encryption (forgot passphrase recovery)
 */
export function resetEncryption(): void {
  if (typeof window === 'undefined') return;

  // Get all encrypted keys
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEYS.ENCRYPTED_PREFIX)) {
      keys.push(key);
    }
  }
  // Remove encrypted data
  keys.forEach(key => localStorage.removeItem(key));
  localStorage.removeItem(STORAGE_KEYS.SALT_KEY);
  localStorage.removeItem(STORAGE_KEYS.PASSPHRASE_SET);
}

/**
 * Check if data is encrypted vs plaintext by looking at the raw data
 */
export function detectPlaintextData(key: string): boolean {
  if (typeof window === 'undefined') return false;

  const data = localStorage.getItem(key);
  if (!data) return false;
  // If it's plaintext, it should be valid JSON
  try {
    JSON.parse(data);
    // If it parses as JSON and looks like our data structure (not encrypted)
    // Encrypted data will fail JSON.parse or be a long base64 string
    if (data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(data.substring(0, 100))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate plaintext data to encrypted
 */
export async function migrateToEncrypted(
  key: string,
  passphrase: string,
  data?: unknown
): Promise<boolean> {
  // If data is provided, just save it encrypted
  if (data !== undefined) {
    await saveEncrypted(key, data, passphrase);
    localStorage.removeItem(key);
    return true;
  }

  // Otherwise, try to load plaintext data
  const plaintext = loadPlaintext(key);
  if (plaintext === null) {
    return false;
  }

  await saveEncrypted(key, plaintext, passphrase);
  localStorage.removeItem(key);
  return true;
}
