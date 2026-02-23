#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildShards,
  buildShardingMeta,
  buildInvertedIndex,
  extractDocumentFromHtml,
  normalizeBaseUrl,
  type IndexMetaV1,
  type IndexMetaV2,
  type IndexableDocument,
  type UrlMode
} from "@searchkit/core/node";
import { Command } from "commander";
import fg from "fast-glob";

interface BuildOptions {
  input: string;
  output: string;
  baseUrl: string;
  urlMode: UrlMode;
  shard: boolean;
  shardPrefixLen: number;
  maxShardTerms: number;
  include: string;
  exclude: string;
  verbose?: boolean;
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}

async function runBuild(options: BuildOptions): Promise<void> {
  const inputDir = path.resolve(process.cwd(), options.input);
  const outputDir = path.resolve(process.cwd(), options.output);
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const urlMode = options.urlMode;
  const shardPrefixLen = options.shardPrefixLen;

  if (urlMode !== "pretty" && urlMode !== "html") {
    throw new Error(`Invalid --urlMode value: ${urlMode}. Use "pretty" or "html".`);
  }
  if (shardPrefixLen !== 2) {
    throw new Error(`Invalid --shardPrefixLen value: ${shardPrefixLen}. Only 2 is supported.`);
  }

  const htmlFiles = await fg(options.include, {
    cwd: inputDir,
    absolute: true,
    onlyFiles: true,
    ignore: [options.exclude]
  });

  const documents: IndexableDocument[] = [];

  for (const filePath of htmlFiles.sort()) {
    const html = await fs.readFile(filePath, "utf8");
    const extracted = extractDocumentFromHtml({
      filePath,
      html,
      inputRoot: inputDir,
      baseUrl,
      urlMode
    });

    if (!extracted) {
      if (options.verbose) {
        // Extraction can skip empty/404-like pages.
        console.log(`- skipped ${path.relative(inputDir, filePath)}`);
      }
      continue;
    }

    documents.push({
      id: documents.length,
      url: extracted.url,
      title: extracted.title,
      headings: extracted.headings,
      bodyText: extracted.bodyText,
      excerpt: extracted.excerpt
    });
  }

  const { docs, inv } = buildInvertedIndex(documents);

  await fs.mkdir(outputDir, { recursive: true });

  const metaPath = path.join(outputDir, "index.meta.json");
  const docsPath = path.join(outputDir, "docs.json");
  const termCount = Object.keys(inv.terms).length;
  let shardCount = 1;
  let largestShardTerms = termCount;

  if (options.shard) {
    const shardResult = buildShards(inv.terms, { shardPrefixLen, fallbackShard: "_other" });
    shardCount = shardResult.shardCount;
    largestShardTerms = shardResult.largestShardTerms;

    const invDir = path.join(outputDir, "inv");
    await fs.mkdir(invDir, { recursive: true });

    const shardMap = Object.fromEntries(
      Object.keys(shardResult.shards).map((shardKey) => [shardKey, `inv/${shardKey}.json`])
    );

    const writeShards = Object.entries(shardResult.shards).map(([shardKey, shardData]) =>
      fs.writeFile(path.join(invDir, `${shardKey}.json`), JSON.stringify(shardData))
    );

    const meta: IndexMetaV2 = {
      version: 2,
      generatedAt: new Date().toISOString(),
      baseUrl,
      docCount: docs.length,
      docs: { path: "docs.json" },
      inv: {
        sharding: buildShardingMeta(shardMap, { shardPrefixLen, fallbackShard: "_other" })
      }
    };

    await Promise.all([
      fs.writeFile(metaPath, JSON.stringify(meta, null, 2)),
      fs.writeFile(docsPath, JSON.stringify(docs)),
      ...writeShards
    ]);
  } else {
    const invPath = path.join(outputDir, "index.inv.json");
    const meta: IndexMetaV1 = {
      version: 1,
      generatedAt: new Date().toISOString(),
      baseUrl,
      docCount: docs.length,
      inv: { path: "index.inv.json" },
      docs: { path: "docs.json" }
    };

    await Promise.all([
      fs.writeFile(metaPath, JSON.stringify(meta, null, 2)),
      fs.writeFile(docsPath, JSON.stringify(docs)),
      fs.writeFile(invPath, JSON.stringify(inv))
    ]);
  }

  console.log(`Indexed ${docs.length} documents`);
  console.log(`Indexed ${termCount} terms`);
  console.log(`Shards ${shardCount} (largest ${largestShardTerms} terms)`);
  if (options.maxShardTerms > 0 && largestShardTerms > options.maxShardTerms) {
    console.log(
      `Warning: largest shard exceeds --maxShardTerms (${options.maxShardTerms}). ` +
        `Term chunking is not enabled in this version.`
    );
  }
  console.log(`Wrote ${metaPath}`);
  console.log(`Wrote ${docsPath}`);
  if (options.shard) {
    console.log(`Wrote ${path.join(outputDir, "inv")}`);
  } else {
    console.log(`Wrote ${path.join(outputDir, "index.inv.json")}`);
  }
}

const program = new Command();

program.name("searchkit").description("Build-time indexer for static-site search").version("0.1.0");

program
  .command("build")
  .description("Generate search index files")
  .requiredOption("--input <dir>", "Input HTML directory")
  .requiredOption("--output <dir>", "Output index directory")
  .option("--baseUrl <url>", "Base URL prefix", "/")
  .option("--shard", "Enable sharded index output", true)
  .option("--no-shard", "Disable sharded index output")
  .option("--urlMode <mode>", "URL output mode: pretty | html", "pretty")
  .option("--shardPrefixLen <n>", "Shard prefix length (currently supports 2)", parseInteger, 2)
  .option(
    "--maxShardTerms <n>",
    "Soft limit for shard term count before warning",
    parseInteger,
    50000
  )
  .option("--include <glob>", "Glob for included files", "**/*.html")
  .option("--exclude <glob>", "Glob for excluded files", "**/search/**")
  .option("--verbose", "Print skipped files")
  .action(async (options: BuildOptions) => {
    try {
      await runBuild(options);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });

void program.parseAsync(process.argv);
