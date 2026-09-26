# PrisNames — Encryption Envelope Specification

> **Status**: Defined (Phase 2)  
> **Implementation**: Phase 4+ (packages/security)

---

## 1. Purpose

This document defines the **canonical encryption envelope format** used for all sensitive encrypted payloads stored in the PrisNames database.

All encrypted fields — regardless of module — use this single format. There are no module-specific encryption formats.

---

## 2. Applicable Database Fields

| Table | Column | Type | Content |
|---|---|---|---|
| `webhook_events` | `raw_payload` | TEXT | Encrypted webhook body |
| `payments` | `gateway_response` | TEXT | Encrypted payment gateway response |
| `registrar_operations` | `provider_response_raw` | TEXT | Encrypted registrar API response |

Each of these TEXT columns stores a **Base64-encoded encrypted envelope** (not raw binary, not hex).

A companion column `encryption_key_id` (VARCHAR(50)) identifies which key was used, enabling key rotation without re-reading ciphertext.

---

## 3. Envelope Format

All encrypted values are stored as a single TEXT string in the following format:

```
v1:{key_id}:{nonce_b64}:{ciphertext_and_tag_b64}
```

### Field Definitions

| Field | Description |
|---|---|
| `v1` | Envelope version. Enables future format changes without ambiguity. |
| `{key_id}` | Identifier of the encryption key used. Maps to a key in the external key store. Never the key material itself. Example: `k-2024-001` |
| `{nonce_b64}` | Base64-encoded nonce / initialization vector. For AES-256-GCM, this is 12 bytes (16 chars Base64). |
| `{ciphertext_and_tag_b64}` | Base64-encoded ciphertext concatenated with the authentication tag. For AES-256-GCM, the last 16 bytes of the decoded value are the authentication tag. |

### Example

```
v1:k-2024-001:dGhpcyBpcyBhIG5v:Y2lwaGVydGV4dCB3aXRoIHRhZw==
```

---

## 4. Algorithm

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key size | 256 bits (32 bytes) |
| Nonce size | 96 bits (12 bytes) — randomly generated per encryption |
| Authentication tag | 128 bits (16 bytes) — appended to ciphertext before Base64 encoding |
| Encoding | Base64 (standard, with padding) |

AES-256-GCM provides both confidentiality and integrity. The authentication tag prevents tampering.

---

## 5. Key Management

### Key Storage

- Encryption keys are **never stored in the database**.
- Keys are provided via environment variables or an external key management service (KMS).
- The `encryption_key_id` column identifies which key to use for decryption.

### Key Rotation

Key rotation is performed by:

1. Adding a new key to the key store with a new `key_id`.
2. New encryptions use the new key.
3. Existing ciphertexts remain readable using the old key (identified by `key_id` in the envelope).
4. Optional: Background re-encryption job updates old ciphertexts to the new key.

The envelope format makes rotation transparent — the `key_id` field tells the decryption layer which key to fetch.

### Environment Variables

```env
# Primary encryption key (for new encryptions)
ENCRYPTION_KEY_ID=k-2024-001
ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Previous keys (for decrypting old data during rotation)
ENCRYPTION_KEY_k_2024_001=<base64-encoded-32-byte-key>
```

---

## 6. Implementation Contract

The `packages/security` package will implement:

```typescript
interface EncryptionService {
  /**
   * Encrypt plaintext using the current active key.
   * Returns the full envelope string: "v1:{key_id}:{nonce_b64}:{ct_b64}"
   */
  encrypt(plaintext: string | Buffer): string;

  /**
   * Decrypt an envelope string.
   * Extracts key_id from the envelope and fetches the corresponding key.
   * Throws if the key is unknown, the tag is invalid, or the format is wrong.
   */
  decrypt(envelope: string): Buffer;

  /**
   * Extract the key_id from an envelope without decrypting.
   * Useful for audit and rotation tracking.
   */
  extractKeyId(envelope: string): string;
}
```

---

## 7. Database Schema Implications

- **Column type**: TEXT — stores the Base64-encoded envelope string.
- **Companion column**: `encryption_key_id` VARCHAR(50) — denormalized key ID for query convenience (e.g., finding all rows encrypted with a specific key during rotation).
- **No raw binary**: All encrypted values are Base64-encoded text, not BYTEA. This simplifies debugging, logging (of envelopes, not plaintext), and cross-system transport.
- **Retention**: `webhook_events.raw_payload_expires_at` enables scheduled cleanup of encrypted payloads after the retention period.

---

## 8. Security Properties

| Property | Guarantee |
|---|---|
| Confidentiality | AES-256-GCM encryption |
| Integrity | GCM authentication tag prevents tampering |
| Key identification | `key_id` in envelope enables rotation |
| Forward compatibility | Version prefix (`v1:`) enables future format changes |
| No key material in DB | Keys are in environment / KMS only |
| Unique nonces | Random 12-byte nonce per encryption — collision probability negligible |
