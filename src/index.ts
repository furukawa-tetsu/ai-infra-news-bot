/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from "hono";
import { XMLParser } from "fast-xml-parser";
import OpenAI from "openai";

type Env = {
  OPENAI_API_KEY: string;
  DB: D1Database;
};

type Article = {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
};

type Analysis = {
  index: number;
  relevance_score: number;
  category: string;
  summary_ja: string[];
  implication: string;
};

const app = new Hono<{ Bindings: Env }>();

const FEEDS = [
    // Cloud / Edge
  "https://blog.cloudflare.com/rss/",
  "https://aws.amazon.com/blogs/machine-learning/feed/",
  "https://cloud.google.com/blog/products/ai-machine-learning/rss/",
  "https://azure.microsoft.com/en-us/blog/feed/",

  // GPU / AI Factory
  "https://blogs.nvidia.com/feed/",
  "https://developer.nvidia.com/blog/feed/",
  "https://www.amd.com/en/rss.xml",

  // AI Labs / Models
  "https://openai.com/news/rss.xml",
  "https://www.anthropic.com/news/rss.xml",
  "https://huggingface.co/blog/feed.xml",

  // HPC / Infra News
  "https://www.hpcwire.com/feed/",
  "https://www.theregister.com/software/ai_ml/headlines.atom",

  // Security / Infrastructure
  "https://blog.cloudflare.com/tag/security/rss/",
];

app.get("/", (c) => {
  return c.text("AI Infra News Bot is running. See /feed.xml");
});

app.get("/run", async (c) => {
  const result = await runPipeline(c.env);
  return c.json(result);
});

app.get("/feed.xml", async (c) => {
  const xml = await generateFeedXml(c.env, new URL(c.req.url).origin);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

export default {
  fetch: app.fetch,

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log("Cron fired:", {
      cron: _event.cron,
      scheduledTime: new Date(_event.scheduledTime).toISOString(),
      now: new Date().toISOString(),
  });
    await runPipeline(env);
  },
};

async function runPipeline(env: Env) {
  const articles = await collectFeeds();

  let inserted = 0;
  let skipped = 0;

  const candidates: Article[] = [];

  for (const article of articles) {
    if (!article.url || !article.title) {
      skipped++;
      continue;
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM articles WHERE url = ?"
    ).bind(article.url).first();

    if (existing) {
      skipped++;
      continue;
    }

    candidates.push(article);

    if (candidates.length >= 20) {
      break;
    }
  }

  if (candidates.length === 0) {
    return {
      ok: true,
      collected: articles.length,
      candidates: 0,
      inserted,
      skipped,
    };
  }

  const analyses = await analyzeBatchWithOpenAI(env, candidates);

  for (const analysis of analyses) {
    const article = candidates[analysis.index];

    if (!article) {
      skipped++;
      continue;
    }

    if (analysis.relevance_score < 3) {
      skipped++;
      continue;
    }

  console.log("Insert article:", {
    titleType: typeof article.title,
    urlType: typeof article.url,
    sourceType: typeof article.source,
    publishedAtType: typeof article.publishedAt,
    categoryType: typeof analysis.category,
    implicationType: typeof analysis.implication,

    title: article.title,
    url: article.url,
    source: article.source,
  });

    await env.DB.prepare(`
      INSERT OR IGNORE INTO articles (
        id, title, url, source, published_at,
        summary, category, relevance_score, implication
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      toDbText(article.title),
      toDbText(article.url),
      toDbText(article.source),
      article.publishedAt ? toDbText(article.publishedAt) : null,
      JSON.stringify(analysis.summary_ja ?? []),
      toDbText(analysis.category),
      Number(analysis.relevance_score ?? 1),
      toDbText(analysis.implication)
    ).run();

    inserted++;
  }

  return {
    ok: true,
    collected: articles.length,
    candidates: candidates.length,
    analyzed: analyses.length,
    inserted,
    skipped,
  };
}

async function collectFeeds(): Promise<Article[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  const articles: Article[] = [];

  for (const feedUrl of FEEDS) {
    const res = await fetch(feedUrl);
    if (!res.ok) continue;

    const xml = await res.text();
    const parsed = parser.parse(xml);

    // RSS
    if (parsed.rss?.channel) {
      const channel = parsed.rss.channel;
      const items = Array.isArray(channel.item)
        ? channel.item
        : channel.item
          ? [channel.item]
          : [];

      for (const item of items) {
        articles.push({
          source: channel.title ?? feedUrl,
          title: normalizeText(item.title),
          url: normalizeText(item.link),
          publishedAt: normalizeText(item.pubDate),
        });
      }
    }

    // Atom
    if (parsed.feed?.entry) {
      const feed = parsed.feed;
      const entries = Array.isArray(feed.entry)
        ? feed.entry
        : [feed.entry];

      for (const entry of entries) {
        const link = Array.isArray(entry.link)
          ? entry.link[0]?.["@_href"]
          : entry.link?.["@_href"] ?? entry.link;

        articles.push({
          source: feed.title ?? feedUrl,
          title: normalizeText(entry.title),
          url: normalizeText(link),
          publishedAt: normalizeText(entry.updated ?? entry.published),
        });
      }
    }
  }

  return articles;
}

/*
async function analyzeWithOpenAI(env: Env, article: Article): Promise<Analysis> {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `
あなたはAIインフラ専門のリサーチアシスタントです。
記事タイトルとURLから、AIインフラ観点での関連性を判定してください。
ABCI、GPUクラスタ、AI Factory、HPC、クラウド、ネットワーク、ストレージ、セキュリティ、Sovereign AI、ロボティクス基盤の観点を重視してください。
`,
      },
      {
        role: "user",
        content: `
title: ${article.title}
source: ${article.source}
url: ${article.url}
publishedAt: ${article.publishedAt ?? ""}
`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_infra_news_analysis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            relevance_score: {
              type: "integer",
              minimum: 1,
              maximum: 5,
            },
            category: {
              type: "string",
              enum: [
                "GPU",
                "HPC",
                "Cloud",
                "Edge",
                "Networking",
                "Storage",
                "Security",
                "Policy",
                "Robotics",
                "AI Factory",
                "Other"
              ],
            },
            summary_ja: {
              type: "array",
              items: { type: "string" },
              minItems: 3,
              maxItems: 3,
            },
            implication: {
              type: "string",
            },
          },
          required: [
            "relevance_score",
            "category",
            "summary_ja",
            "implication"
          ],
        },
        strict: true,
      },
    },
  });

  return JSON.parse(response.output_text) as Analysis;
}
*/

async function analyzeBatchWithOpenAI(
  env: Env,
  articles: Article[]
): Promise<Analysis[]> {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const articleList = articles.map((article, index) => ({
    index,
    title: article.title,
    source: article.source,
    url: article.url,
    publishedAt: article.publishedAt ?? "",
  }));

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `
あなたはAIインフラ専門のリサーチアシスタントです。

記事リストを読み、各記事についてAIインフラ観点での関連性を判定してください。

重視する観点:
- ABCI
- GPUクラスタ
- AI Factory
- HPC
- クラウド
- Edge
- ネットワーク
- ストレージ
- セキュリティ
- Sovereign AI
- ロボティクス基盤

必ず入力された各記事に対して1件ずつ分析結果を返してください。
indexは入力記事のindexをそのまま使ってください。
`,
      },
      {
        role: "user",
        content: JSON.stringify(articleList, null, 2),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_infra_news_batch_analysis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            analyses: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  index: {
                    type: "integer",
                  },
                  relevance_score: {
                    type: "integer",
                    minimum: 1,
                    maximum: 5,
                  },
                  category: {
                    type: "string",
                    enum: [
                      "GPU",
                      "HPC",
                      "Cloud",
                      "Edge",
                      "Networking",
                      "Storage",
                      "Security",
                      "Policy",
                      "Robotics",
                      "AI Factory",
                      "Other"
                    ],
                  },
                  summary_ja: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                  implication: {
                    type: "string",
                  },
                },
                required: [
                  "index",
                  "relevance_score",
                  "category",
                  "summary_ja",
                  "implication"
                ],
              },
            },
          },
          required: ["analyses"],
        },
        strict: true,
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as {
    analyses: Analysis[];
  };

  return parsed.analyses;
}

async function generateFeedXml(env: Env, origin: string): Promise<string> {
  const rows = await env.DB.prepare(`
    SELECT title, url, source, published_at, summary, category,
           relevance_score, implication, created_at
    FROM articles
    WHERE relevance_score >= 3
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  const items = rows.results.map((article: any) => {
    const summary = safeJsonArray(article.summary);

    return `
    <item>
      <title>${escapeXml(`[${article.category}] ${article.title}`)}</title>
      <link>${escapeXml(article.url)}</link>
      <guid isPermaLink="false">${escapeXml(article.url)}</guid>
      <pubDate>${new Date(article.created_at || Date.now()).toUTCString()}</pubDate>

      <description><![CDATA[
重要度: ${article.relevance_score}/5

要約:
${summary.map((x) => `- ${x}`).join("\n")}

示唆:
${article.implication}

Source: ${article.source}
      ]]></description>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>AI Infra News Digest</title>
    <link>${escapeXml(`${origin}/feed.xml`)}</link>
    <description>AI infrastructure news summarized by OpenAI</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

function normalizeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && "#text" in value) {
    return String((value as any)["#text"]).trim();
  }
  return String(value).trim();
}

function escapeXml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDbText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}