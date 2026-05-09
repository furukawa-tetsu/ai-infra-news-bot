# AI Infra News Bot

AI infrastructure news aggregation and summarization bot built with Cloudflare Workers, D1, OpenAI API, and Slack RSS integration.

This bot periodically collects AI infrastructure related news from various RSS/Atom feeds, analyzes and categorizes them using OpenAI, stores them into Cloudflare D1, and exposes a summarized RSS feed that can be subscribed to from Slack RSS App or other RSS readers.

---

# Architecture

```text
External RSS / Atom feeds
↓
Cloudflare Workers Cron Trigger
↓
OpenAI API (Batch Analysis)
↓
Cloudflare D1
↓
feed.xml generation
↓
Slack RSS App / RSS Reader
```

---

# Features

* AI infrastructure news aggregation
* OpenAI-based article categorization and summarization
* Batch analysis (20 articles per API request)
* Cloudflare Workers serverless architecture
* Cloudflare D1 persistence
* RSS feed generation
* Slack RSS App integration
* Duplicate article prevention
* Scheduled execution using Cloudflare Cron Triggers

---

# Tech Stack

* Cloudflare Workers
* Cloudflare D1
* Cloudflare R2 (optional)
* OpenAI API
* Hono
* TypeScript
* Slack RSS App
* RSS / Atom feeds

---

# Categories

The bot classifies articles into categories such as:

* GPU
* HPC
* Cloud
* Networking
* Storage
* Security
* Robotics
* AI Factory
* Policy
* Edge

---

# RSS Sources

Example feeds:

## Cloud / Edge

* Cloudflare Blog
* AWS Machine Learning Blog
* Google Cloud AI Blog
* Microsoft Azure Blog

## GPU / AI Factory

* NVIDIA Blog
* NVIDIA Developer Blog
* AMD

## AI Labs

* OpenAI
* Anthropic
* Hugging Face

## HPC / Infrastructure

* HPCwire
* The Register AI/ML

---

# Scheduling

The Worker is triggered periodically using Cloudflare Cron Triggers.

Current schedule (JST):

* 07:00
* 12:00
* 17:00
* 17:30

Cron expressions are configured in UTC.

---

# Batch Processing

To reduce OpenAI API cost and avoid RPM limits, articles are analyzed in batches.

## Before

```text
20 articles → 20 API requests
```

## After

```text
20 articles → 1 API request
```

This significantly reduces:

* API cost
* OpenAI RPM pressure
* Worker execution time

---

# Project Structure

```text
.
├── src/
│   └── index.ts
├── migrations/
│   ├── 0001_create_articles.sql
│   └── 0002_add_implication.sql
├── wrangler.jsonc
├── package.json
└── README.md
```

---

# Local Development

## Install dependencies

```bash
npm install
```

## Run locally

```bash
npm run dev
```

## Run scheduled event locally

```bash
npx wrangler dev --test-scheduled
```

Trigger scheduled event:

```bash
curl "http://localhost:8787/__scheduled?cron=0+3+*+*+*"
```

---

# Environment Variables

Create `.dev.vars`:

```env
OPENAI_API_KEY=sk-xxxxxxxx
```

---

# D1 Setup

Create D1 database:

```bash
npx wrangler d1 create ai_infra_news
```

Apply migrations locally:

```bash
npx wrangler d1 migrations apply ai_infra_news --local
```

Apply migrations remotely:

```bash
npx wrangler d1 migrations apply ai_infra_news --remote
```

---

# Deploy

```bash
npx wrangler deploy
```

---

# RSS Feed

Example endpoint:

```text
https://<your-worker>.workers.dev/feed.xml
```

This RSS feed can be subscribed to from Slack RSS App.

Example:

```text
/feed subscribe https://<your-worker>.workers.dev/feed.xml
```

---

# API Endpoints

## Run pipeline manually

```text
GET /run
```

## RSS feed

```text
GET /feed.xml
```

---

# Logging

Realtime logs:

```bash
npx wrangler tail
```

---

# Known Challenges

* RSS format inconsistencies
* Slack RSS App new-item detection
* Duplicate URL normalization
* OpenAI API RPM limits
* RSS `guid` / `pubDate` behavior

---

# Future Improvements

* Embedding-based deduplication
* Article full-text fetching
* Obsidian markdown export
* Weekly AI infrastructure report generation
* GitHub release monitoring
* arXiv integration
* Personalized weighting for topics such as:

  * ABCI
  * Sovereign AI
  * AI Factory
  * GPU cluster operations

---

# License

MIT
