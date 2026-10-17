import { createHash } from 'node:crypto';
import { SIMHASH_BITS, SIMHASH_HEX_LENGTH, SIMHASH_MAX_DISTANCE } from '../ingestion.constants';

/** 64-bit simhash of the description, as 16 hex characters. */
export function simhash(text: string): string {
  const counts = new Array<number>(SIMHASH_BITS).fill(0);
  for (const token of tokensOf(text)) addToken(counts, token);
  return bitsToHex(counts);
}

/** Hamming distance of two simhash hex strings. */
export function hammingDistance(left: string, right: string): number {
  assertHash(left);
  assertHash(right);
  return popcount(BigInt(`0x${left}`) ^ BigInt(`0x${right}`));
}

/** True when two descriptions are close enough to confirm a fuzzy duplicate. */
export function descriptionsMatch(left: string, right: string): boolean {
  return hammingDistance(left, right) <= SIMHASH_MAX_DISTANCE;
}

/** 1 when the hashes match, less as the Hamming distance grows. */
export function fuzzySimilarity(left: string, right: string): number {
  return 1 - hammingDistance(left, right) / SIMHASH_BITS;
}

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

function addToken(counts: number[], token: string): void {
  const digest = createHash('sha256').update(token).digest();
  for (let bit = 0; bit < SIMHASH_BITS; bit += 1) {
    const byte = digest[Math.floor(bit / 8)] ?? 0;
    const set = (byte & (1 << (bit % 8))) !== 0;
    counts[bit] = (counts[bit] ?? 0) + (set ? 1 : -1);
  }
}

function bitsToHex(counts: number[]): string {
  let value = 0n;
  for (let bit = 0; bit < SIMHASH_BITS; bit += 1) {
    if ((counts[bit] ?? 0) > 0) value |= 1n << BigInt(bit);
  }
  return value.toString(16).padStart(SIMHASH_HEX_LENGTH, '0');
}

function assertHash(value: string): void {
  if (!/^[0-9a-f]{16}$/.test(value)) throw new Error(`simhash is not 16 hex chars: ${value}`);
}

function popcount(value: bigint): number {
  let count = 0;
  let rest = value;
  while (rest > 0n) {
    count += Number(rest & 1n);
    rest >>= 1n;
  }
  return count;
}
