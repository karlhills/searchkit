#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildInvertedIndex,
  extractDocumentFromHtml,
  normalizeBaseUrl,
  type IndexMeta,
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
  include: string;
  exclude: string;
  verbose?: boolean;
}

async function runBuild(options: BuildOptions): Promise<void> {
  const inputDir = path.resolve(process.cwd(), options.input);
  const outputDir = path.resolve(process.cwd(), options.output);
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const urlMode = options.urlMode;

  if (urlMode !== "pretty" && urlMode !== "html") {
    throw new Error(`Invalid --urlMode value: ${urlMode}. Use "pretty" or "html".`);
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

  const meta: IndexMeta = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    docCount: docs.length,
    inv: { path: "index.inv.json" },
    docs: { path: "docs.json" }
  };

  await fs.mkdir(outputDir, { recursive: true });

  const metaPath = path.join(outputDir, "index.meta.json");
  const docsPath = path.join(outputDir, "docs.json");
  const invPath = path.join(outputDir, "index.inv.json");

  await Promise.all([
    fs.writeFile(metaPath, JSON.stringify(meta, null, 2)),
    fs.writeFile(docsPath, JSON.stringify(docs)),
    fs.writeFile(invPath, JSON.stringify(inv))
  ]);

  const termCount = Object.keys(inv.terms).length;
  console.log(`Indexed ${docs.length} documents`);
  console.log(`Indexed ${termCount} terms`);
  console.log(`Wrote ${metaPath}`);
  console.log(`Wrote ${docsPath}`);
  console.log(`Wrote ${invPath}`);
}

const program = new Command();

program.name("searchkit").description("Build-time indexer for static-site search").version("0.1.0");

program
  .command("build")
  .description("Generate search index files")
  .requiredOption("--input <dir>", "Input HTML directory")
  .requiredOption("--output <dir>", "Output index directory")
  .option("--baseUrl <url>", "Base URL prefix", "/")
  .option("--urlMode <mode>", "URL output mode: pretty | html", "pretty")
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
