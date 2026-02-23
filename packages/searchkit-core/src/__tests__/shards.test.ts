import { describe, expect, it } from "vitest";

import {
  buildShardingMeta,
  buildShards,
  resolveShardPathForToken,
  shardKeyForToken
} from "../shards";

describe("shardKeyForToken", () => {
  it("uses first two alphanumeric characters", () => {
    expect(shardKeyForToken("abacus")).toBe("ab");
    expect(shardKeyForToken("zebra")).toBe("ze");
    expect(shardKeyForToken("a1pha")).toBe("a1");
  });

  it("falls back for non-conforming tokens", () => {
    expect(shardKeyForToken("a")).toBe("_other");
    expect(shardKeyForToken("@")).toBe("_other");
    expect(shardKeyForToken("a-1")).toBe("_other");
  });
});

describe("buildShards", () => {
  it("builds shard map and omits empty shards", () => {
    const result = buildShards({
      abacus: [[0, 3]],
      ability: [[1, 2]],
      zebra: [[1, 5]],
      "x?": [[2, 1]]
    });

    expect(Object.keys(result.shards).sort()).toEqual(["_other", "ab", "ze"]);
    expect(result.shards.ab?.terms.abacus).toEqual([[0, 3]]);
    expect(result.shards.ab?.terms.ability).toEqual([[1, 2]]);
    expect(result.shards.ze?.terms.zebra).toEqual([[1, 5]]);
    expect(result.shards._other?.terms["x?"]).toEqual([[2, 1]]);

    expect(result.shardCount).toBe(3);
    expect(result.totalTerms).toBe(4);
    expect(result.largestShardTerms).toBe(2);

    const shardMap = Object.fromEntries(
      Object.keys(result.shards).map((shardKey) => [shardKey, `inv/${shardKey}.json`])
    );
    expect(buildShardingMeta(shardMap)).toEqual({
      strategy: "prefix2",
      shardPrefixLen: 2,
      fallbackShard: "_other",
      map: {
        _other: "inv/_other.json",
        ab: "inv/ab.json",
        ze: "inv/ze.json"
      }
    });
  });

  it("resolves shard path using sharding map", () => {
    const sharding = {
      strategy: "prefix2" as const,
      shardPrefixLen: 2,
      fallbackShard: "_other",
      map: {
        ab: "inv/ab.json",
        _other: "inv/_other.json"
      }
    };

    expect(resolveShardPathForToken("abacus", sharding)).toBe("inv/ab.json");
    expect(resolveShardPathForToken("zebra", sharding)).toBe("inv/_other.json");
  });
});
