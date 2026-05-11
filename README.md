# AI Infra News Bot

AI infrastructure focused news aggregation and intelligence feed built on Cloudflare Workers.

This project collects RSS feeds related to:

* AI Infrastructure
* GPU clusters
* AI Factory
* HPC
* Cloud / Edge
* Networking
* Security
* Robotics infrastructure
* Sovereign AI

The system uses OpenAI to:

* classify articles
* summarize articles
* estimate strategic relevance
* generate AI infrastructure implications

Selected articles are then:

* stored into Cloudflare D1
* exposed as an RSS feed
* consumed by Slack RSS App

---

# Example RSS Output

```txt
🟥🏭 [AI Factory] NVIDIA launches ...

投稿日:
2026/05/09 14:22

Executive Summary:
NVIDIA announced ...

Technical Summary:
- ...
- ...
- ...

Implication:
AI Factory competition is shifting toward network architecture optimization.
```

# Architecture

```txt
External RSS Feeds
        ↓
Cloudflare Workers Cron
        ↓
RSS Collection
        ↓
OpenAI Batch Analysis
        ↓
Ranking / Filtering
        ↓
Cloudflare D1
        ↓
/feed.xml
        ↓
Slack RSS App
```

---

# Features

## RSS Aggregation

Collects RSS / Atom feeds from:

* NVIDIA
* Cloudflare
* AWS
* Google Cloud
* Azure
* OpenAI
* Anthropic
* Hugging Face
* HPCWire
* The Register
* Kubernetes
* arXiv
* etc.

---

## AI-based Classification

Each article is analyzed using OpenAI.

The system extracts:

* relevance score
* category
* executive summary
* technical summary
* strategic implication

Categories include:

* GPU
* AI Factory
* HPC
* Cloud
* Networking
* Security
* Robotics
* Policy
* Storage
* Edge

---

## Batch Processing

Instead of:

```txt
1 article = 1 API call
```

the system processes:

```txt
20 articles = 1 API call
```

Benefits:

* lower OpenAI cost
* avoids RPM limits
* faster execution
* lower Worker execution time

---

## Intelligent Ranking

Articles are ranked using:

* AI relevance score
* freshness
* category weight

The system then selects:

```txt
Top 5 most important articles
```

for RSS output.

---

## Freshness Visualization

Feed titles include freshness emojis.

| Emoji | Meaning       |
| ----- | ------------- |
| 🟥    | within 24h    |
| 🟨    | within 3 days |
| ⬜     | older         |

Example:

```txt
🟥🏭 [AI Factory] NVIDIA launches ...
```

---

# Tech Stack

| Layer          | Technology         |
| -------------- | ------------------ |
| Runtime        | Cloudflare Workers |
| Database       | Cloudflare D1      |
| Object Storage | Cloudflare R2      |
| AI             | OpenAI API         |
| Feed Parsing   | fast-xml-parser    |
| Framework      | Hono               |
| Deployment     | Wrangler           |
| Notification   | Slack RSS App      |

---

# Local Development

## Install dependencies

```bash
npm install
```

---

## Environment variables

Create `.dev.vars`

```env
OPENAI_API_KEY=sk-xxxxx
```

---

## Run locally

```bash
npm run dev
```

---

## Manual pipeline execution

```bash
curl http://localhost:8787/run
```

---

## Test RSS feed

```bash
curl http://localhost:8787/feed.xml
```

---

# Deployment

## Login to Cloudflare

```bash
npx wrangler login
```

---

## Deploy

```bash
npx wrangler deploy
```

---

## Production endpoints

```txt
https://ai-infra-news-bot.ai-infra-news.workers.dev/run
https://ai-infra-news-bot.ai-infra-news.workers.dev/feed.xml
```

---

# Cron Schedule

Configured for JST:

* 07:00
* 12:00
* 18:00

Example configuration:

```jsonc
"triggers": {
  "crons": [
    "0 22 * * *",
    "0 3 * * *",
    "0 9 * * *"
  ]
}
```

---

# Slack Integration

This project does NOT use Slack Incoming Webhooks.

Instead:

```txt
/feed.xml
```

is consumed by Slack RSS App.

Example:

```txt
/feed subscribe https://ai-infra-news-bot.ai-infra-news.workers.dev/feed.xml
```

Benefits:

* no Slack App approval required
* no OAuth
* no Bot token
* simple deployment

---

# D1 Migration

## Apply local migrations

```bash
npx wrangler d1 migrations apply ai_infra_news --local
```

---

## Apply remote migrations

```bash
npx wrangler d1 migrations apply ai_infra_news --remote
```

---

---

# Future Improvements

Planned improvements:

* article body extraction
* embedding-based deduplication
* Obsidian markdown export
* GitHub auto-sync
* weekly AI infra reports
* source trust scoring
* novelty detection
* personalized ranking
* ABCI relevance scoring
* AI Factory strategic radar

---

# License

MIT
