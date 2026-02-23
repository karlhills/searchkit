import type {
  BuildShardResult,
  BuildShardsOptions,
  InvertedIndex,
  Posting,
  ShardingConfig
} from "./types";

const TOKEN_CHARS = /^[a-z0-9]+$/;

export function shardKeyForToken(
  token: string,
  shardPrefixLen = 2,
  fallbackShard = "_other"
): string {
  const normalized = token.toLowerCase();
  if (normalized.length < shardPrefixLen) {
    return fallbackShard;
  }

  const prefix = normalized.slice(0, shardPrefixLen);
  if (!TOKEN_CHARS.test(prefix)) {
    return fallbackShard;
  }

  return prefix;
}

function sortedTerms(terms: Record<string, Posting[]>): Record<string, Posting[]> {
  return Object.fromEntries(
    Object.entries(terms)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([token, postings]) => [token, postings.sort((a, b) => a[0] - b[0])])
  );
}

export function buildShards(
  terms: Record<string, Posting[]>,
  options: BuildShardsOptions = {}
): BuildShardResult {
  const shardPrefixLen = options.shardPrefixLen ?? 2;
  const fallbackShard = options.fallbackShard ?? "_other";

  const shardTerms: Record<string, Record<string, Posting[]>> = {};
  for (const [token, postings] of Object.entries(terms)) {
    const key = shardKeyForToken(token, shardPrefixLen, fallbackShard);
    const target = shardTerms[key] ?? (shardTerms[key] = {});
    target[token] = postings;
  }

  const shards = Object.fromEntries(
    Object.entries(shardTerms)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, { terms: sortedTerms(value) } satisfies InvertedIndex])
  );

  const shardSizes = Object.values(shards).map((shard) => Object.keys(shard.terms).length);
  return {
    shards,
    totalTerms: Object.keys(terms).length,
    shardCount: Object.keys(shards).length,
    largestShardTerms: shardSizes.length ? Math.max(...shardSizes) : 0
  };
}

export function buildShardingMeta(
  shardMap: Record<string, string>,
  options: BuildShardsOptions = {}
): ShardingConfig {
  return {
    strategy: "prefix2",
    shardPrefixLen: options.shardPrefixLen ?? 2,
    fallbackShard: options.fallbackShard ?? "_other",
    map: shardMap
  };
}

export function resolveShardPathForToken(token: string, sharding: ShardingConfig): string | null {
  const key = shardKeyForToken(token, sharding.shardPrefixLen, sharding.fallbackShard);
  return sharding.map[key] ?? sharding.map[sharding.fallbackShard] ?? null;
}
