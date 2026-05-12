import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

/**
 * Gemini embedding wrapper with in-memory LRU cache.
 *
 * Phase 1: process-local Map (rebuilds per cold-start; fine for low traffic).
 * Phase 2: swap the cache for Redis (Upstash) — same interface.
 */

const MODEL = 'text-embedding-004';
const DIMENSIONS = 768;
const CACHE_MAX = 1000;

const cache = new Map<string, number[]>();

function cacheGet(key: string): number[] | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: number[]): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function keyFor(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  client = new GoogleGenAI({ apiKey });
  return client;
}

export async function embed(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return Array(DIMENSIONS).fill(0);

  const k = keyFor(trimmed);
  const hit = cacheGet(k);
  if (hit) return hit;

  const genAI = getClient();
  const res = await genAI.models.embedContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: trimmed }] }],
  });

  const vec = res.embeddings?.[0]?.values ?? [];
  if (vec.length === 0) {
    throw new Error(`Empty embedding returned for text (length=${trimmed.length})`);
  }

  cacheSet(k, vec);
  return vec;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map((t) => embed(t)));
}

export const EMBED_MODEL = MODEL;
export const EMBED_DIMENSIONS = DIMENSIONS;
