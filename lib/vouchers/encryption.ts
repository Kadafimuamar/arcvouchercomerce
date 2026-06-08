import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveLegacyKey(secret: string) {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function getVoucherKeyHex(secret: string) {
  const normalized = secret.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      "VOUCHER_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)."
    );
  }

  return normalized.toLowerCase();
}

export function getVoucherEncryptionKeyBuffer(secret = process.env.VOUCHER_ENCRYPTION_KEY) {
  if (!secret) {
    throw new Error("VOUCHER_ENCRYPTION_KEY is not configured.");
  }

  const keyHex = getVoucherKeyHex(secret);
  return Buffer.from(keyHex, "hex");
}

export function isVoucherEncryptionConfigured() {
  return Boolean(process.env.VOUCHER_ENCRYPTION_KEY);
}

export function encryptVoucherCode(plainText: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getVoucherEncryptionKeyBuffer();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    ALGORITHM,
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptVoucherCode(cipherText: string) {
  const secret = process.env.VOUCHER_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("VOUCHER_ENCRYPTION_KEY is not configured.");
  }

  if (!cipherText.startsWith(`${ENCRYPTION_VERSION}:${ALGORITHM}:`)) {
    const payload = Buffer.from(cipherText, "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const legacyKey = deriveLegacyKey(secret);
    const legacyDecipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv);
    legacyDecipher.setAuthTag(tag);

    return Buffer.concat([
      legacyDecipher.update(encrypted),
      legacyDecipher.final(),
    ]).toString("utf8");
  }

  const [, algorithm, ivHex, tagHex, cipherHex] = cipherText.split(":");
  if (algorithm !== ALGORITHM || !ivHex || !tagHex || !cipherHex) {
    throw new Error("Voucher ciphertext format is invalid.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const key = getVoucherEncryptionKeyBuffer(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

export function hashVoucherCode(plainText: string) {
  return crypto.createHash("sha256").update(plainText, "utf8").digest("hex");
}
