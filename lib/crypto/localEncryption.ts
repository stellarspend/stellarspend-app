/**
 * Local encryption utility using WebCrypto API
 * Uses PBKDF2 for key derivation and AES-GCM for encryption
 */

export interface EncryptionConfig {
  passphrase: string;
  salt?: string;
}

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ITERATIONS = 100000;

const STORAGE_KEYS = {
  ENCRYPTED_PREFIX: 'stellarspend_encrypted_',
  SALT_KEY: 'stellarspend_encryption_salt',
  PASSPHRASE_SET: 'stellarspend_passphrase_set',
} as const;

/**
 * Generates a cryptographically secure random salt for key derivation.
 * Uses the WebCrypto API to generate 16 bytes of random data.
 * @returns A hex-encoded string representing the random salt.
 */
export function generateSalt(): string {
  const array = new Uint8Array(SALT_LENGTH);
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
 * Encrypts arbitrary data using AES-256-GCM with a passphrase-derived key.
 * Key derivation uses PBKDF2 with 100,000 iterations and SHA-256.
 * The output format is base64-encoded: salt (16 bytes) + IV (12 bytes) + ciphertext.
 * @param data - The data to encrypt. Will be JSON-serialized before encryption.
 * @param passphrase - The user passphrase used to derive the encryption key.
 * @returns A base64-encoded string containing the encrypted data with embedded salt and IV.
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

  // Combine salt + iv + encrypted data, all as base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(new TextEncoder().encode(salt), 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

const SALT_HEX_LENGTH = SALT_LENGTH * 2;

/**
 * Decrypts data that was encrypted with {@link encryptData}.
 * Extracts the salt and IV from the base64-encoded input, derives the decryption key
 * using PBKDF2, and decrypts using AES-256-GCM.
 * @template T - The expected type of the decrypted data.
 * @param encryptedData - The base64-encoded encrypted string to decrypt.
 * @param passphrase - The passphrase used to derive the decryption key.
 * @returns The decrypted data, parsed from JSON into type T.
 * @throws Will throw if decryption fails (e.g., wrong passphrase or corrupted data).
 */
export async function decryptData<T>(encryptedData: string, passphrase: string): Promise<T> {
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // generateSalt() returns a hex string (2 chars per salt byte), which is what
  // encryptData() writes into the combined payload. SALT_LENGTH is the raw byte
  // count, so the hex representation occupies SALT_LENGTH * 2 UTF-8 bytes.
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
 * Encrypts data and stores it in the browser's localStorage.
 * Uses {@link encryptData} to encrypt before storage.
 * @param key - The storage key under which the encrypted data will be saved.
 * @param data - The data to encrypt and store. Will be JSON-serialized.
 * @param passphrase - The passphrase used to derive the encryption key.
 * @returns A promise that resolves when storage is complete. No-op on server-side.
 */
export async function saveEncrypted(key: string, data: unknown, passphrase: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const encrypted = await encryptData(data, passphrase);
  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PREFIX + key, encrypted);
}

/**
 * Loads and decrypts data from localStorage.
 * Retrieves the base64-encoded encrypted string and decrypts it using {@link decryptData}.
 * @template T - The expected type of the decrypted data.
 * @param key - The storage key from which to load the encrypted data.
 * @param passphrase - The passphrase used to derive the decryption key.
 * @returns The decrypted data of type T, or null if not found or decryption fails.
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
 * Checks whether data stored under the given key is encrypted.
 * Identifies encrypted data by verifying it's a valid base64 string longer than 50 characters.
 * @param key - The localStorage key to inspect.
 * @returns True if the data appears to be encrypted (base64-encoded), false otherwise.
 */
export function isEncrypted(key: string): boolean {
  if (typeof window === 'undefined') return false;

  const data = localStorage.getItem(key);
  if (!data) return false;
  // Encrypted data starts with base64 characters and has length > 50
  return data.length > 50 && /^[A-Za-z0-9+/=]+$/.test(data);
}

/**
 * Saves plaintext data to localStorage (migration helper).
 * Stores data as JSON without encryption. Intended for legacy data migration only.
 * @param key - The localStorage key under which to store the data.
 * @param data - The data to store. Will be JSON-serialized.
 */
export function savePlaintext(key: string, data: unknown): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Loads plaintext data from localStorage (migration helper).
 * Retrieves and parses JSON data without decryption. Intended for legacy data migration only.
 * @template T - The expected type of the stored data.
 * @param key - The localStorage key from which to load the data.
 * @returns The parsed data of type T, or null if not found or parsing fails.
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
 * Removes stored data from localStorage.
 * Deletes both the plaintext and encrypted versions of the data for the given key.
 * @param key - The storage key identifying the data to remove.
 */
export function removeStoredData(key: string): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(key);
  localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_PREFIX + key);
}

/**
 * Checks whether an encryption passphrase has been configured.
 * Reads the passphrase-set flag from localStorage.
 * @returns True if the passphrase has been set, false otherwise.
 */
export function isPassphraseSet(): boolean {
  if (typeof window === 'undefined') return false;

  return localStorage.getItem(STORAGE_KEYS.PASSPHRASE_SET) === 'true';
}

/**
 * Sets the passphrase-configured flag in localStorage.
 * Called after the user successfully sets or verifies their encryption passphrase.
 */
export function setPassphraseSet(): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.PASSPHRASE_SET, 'true');
}

/**
 * Resets all encryption state for the application (forgot-passphrase recovery).
 * Removes all encrypted data entries, the stored salt, and the passphrase-set flag from localStorage.
 * This action is irreversible—encrypted data cannot be recovered without the passphrase.
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
 * Detects whether data under the given key is stored as plaintext (not encrypted).
 * Uses heuristic checks: if the data parses as valid JSON and doesn't start with a base64 pattern,
 * it's considered plaintext. Encrypted data will be a long base64 string.
 * @param key - The localStorage key to inspect.
 * @returns True if the data appears to be plaintext, false otherwise.
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
 * Migrates plaintext localStorage data to encrypted storage.
 * If data is provided, it encrypts and stores it directly. Otherwise, loads existing
 * plaintext data, encrypts it with the passphrase, and removes the plaintext entry.
 * Uses AES-256-GCM encryption via {@link encryptData}.
 * @param key - The storage key identifying the data to migrate.
 * @param passphrase - The passphrase used to derive the encryption key.
 * @param data - Optional explicit data to encrypt. If omitted, loads from localStorage.
 * @returns True if migration succeeded, false if no plaintext data was found.
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
