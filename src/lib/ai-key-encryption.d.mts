export type EncryptedAiKey = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

export function encryptAiKey(apiKey: string): EncryptedAiKey;
export function decryptAiKey(record: EncryptedAiKey): string;
