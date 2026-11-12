import "server-only";
import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

const policies = {
  runCreateIp: { limit: 15, window: "1 m" },
  benchmarkCreateIp: { limit: 8, window: "1 m" },
  submitCreateIp: { limit: 30, window: "1 m" },
  submitCreateUser: { limit: 5, window: "1 m" },
  pollIp: { limit: 600, window: "1 m" },
  pollUser: { limit: 300, window: "1 m" },
  groqAssistantIp: { limit: 12, window: "1 m" },
  groqAssistantUser: { limit: 5, window: "1 m" },
} as const;

export type PolicyName = keyof typeof policies;
type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  unavailable?: boolean;
};

let redis: Redis | null = null;
const limiters = new Map<PolicyName, Ratelimit>();

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

function getLimiter(name: PolicyName, client: Redis): Ratelimit {
  const cached = limiters.get(name);
  if (cached) return cached;
  const policy = policies[name];
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: `yexcode:ratelimit:${name}`,
    analytics: false,
  });
  limiters.set(name, limiter);
  return limiter;
}

export function getClientIp(request: NextRequest): string {
  const headers = request.headers;
  const address = headers.get("cf-connecting-ip")
    || headers.get("x-real-ip")
    || headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return address || "unknown";
}

export function rateLimitIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkRateLimit(name: PolicyName, identifier: string): Promise<LimitResult> {
  const policy = policies[name];
  const client = getRedis();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      return { success: true, limit: policy.limit, remaining: policy.limit, reset: Date.now() + 60_000 };
    }
    return { success: false, limit: policy.limit, remaining: 0, reset: Date.now() + 60_000, unavailable: true };
  }

  try {
    const result = await getLimiter(name, client).limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Upstash rate-limit check failed", { policy: name, error });
    return { success: false, limit: policy.limit, remaining: 0, reset: Date.now() + 60_000, unavailable: true };
  }
}
