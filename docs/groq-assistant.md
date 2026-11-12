# Groq code assistant setup

The YexCode assistant uses each user's own Groq API key. Keys are encrypted before MongoDB storage using AES-256-GCM. The encryption key must remain outside MongoDB and source control.

## Required server configuration

Generate a 32-byte key encoded as 64 hexadecimal characters:

```sh
openssl rand -hex 32
```

Set the output as `AI_KEY_ENCRYPTION_KEY` in the local server environment and deployment secret manager. Never use the same value as a user's Groq API key. The same 32-byte encryption secret already used by an installation can be assigned under this environment variable name. Losing or changing the secret prevents decryption of existing Groq keys, so keep a secure backup and plan key rotation before rotating it.

Set `GROQ_MODEL` to a model identifier currently available to your Groq account. There is intentionally no hardcoded default because Groq's model catalog changes; the assistant returns a configuration error until this variable is set.

Production AI requests also rely on the existing Upstash rate limiter configuration. The assistant has per-IP and per-user request limits.

## User data and privacy

The plaintext Groq key is never returned by YexCode after saving. The server decrypts it only to call Groq's chat-completions API. When a user asks a question, the current source code, selected language, problem title (when applicable), and prompt are sent to Groq. YexCode does not persist submitted code or assistant conversations. Groq's API terms, limits, and any billing apply to the user's key.
