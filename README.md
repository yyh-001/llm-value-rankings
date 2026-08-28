<div align="center">

# LLM Value Rankings

**Find the best value AI models — intelligence per dollar, ranked daily.**

🌐 **Live site:** [https://yyh-001.github.io/llm-value-rankings/](https://yyh-001.github.io/llm-value-rankings/)

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md)

[![Live Demo](https://img.shields.io/badge/demo-live-6366f1?style=for-the-badge)](https://yyh-001.github.io/llm-value-rankings/)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/yyh-001/llm-value-rankings/update-data.yml?style=for-the-badge&label=data%20update)](.github/workflows/update-data.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

[🌐 Live Site](https://yyh-001.github.io/llm-value-rankings/) · [🐛 Report Bug](https://github.com/yyh-001/llm-value-rankings/issues) · [✨ Request Feature](https://github.com/yyh-001/llm-value-rankings/issues)

</div>

---

## Overview

LLM Value Rankings compares **300+ LLMs** by combining:

- **Intelligence** — [Artificial Analysis](https://artificialanalysis.ai) Intelligence Index (OpenRouter embedded benchmarks)
- **Speed** — output tokens per second (uptime-weighted average across providers)
- **Price** — blended input/output cost from [OpenRouter](https://openrouter.ai), plus **6 channel** price sources for comparison

Beyond OpenRouter pay-as-you-go rates, the site ingests **OpenCode Go**, **Command Code GOAT**, **DeepSeek official API**, **GPT Plus**, and **MiniMax Token Plan** pricing. Model detail pages show all channels side by side. **Rank by lowest channel price** is off by default; turn it on to recompute value scores and sort order from each model’s best available rate.

The result is a daily-updated leaderboard that answers one question: **how much AI capability do you get per dollar?**

> Static site · zero backend · deploy with GitHub Pages in one minute.

---

## Features

| | Feature | Description |
|:---:|---------|-------------|
| 📊 | **Smart ranking** | `f(Intelligence) × Speed^0.8 / Price`, min score 25 |
| 💰 | **Multi-channel pricing** | OpenCode, Command Code, DeepSeek API, GPT Plus, MiniMax Token Plan + OpenRouter; detail modal sorted by lowest price |
| 🔄 | **Lowest-channel ranking** | Off by default: turn on to recompute value score, price column, and sort from each model’s cheapest channel (toggle persists) |
| 📋 | **Channel summary** | Collapsible panel next to filters: channel count, plan count, models covered |
| 📉 | **Pareto chart** | Top 30 intelligence vs price; hover shows which channel supplied the displayed price |
| 📈 | **Day-over-day delta** | See rank changes vs yesterday (`↑2` / `↓1` / `NEW`) |
| 🏅 | **Top 3 podium** | Highlight the best value models on the homepage |
| 🔍 | **Live search** | Filter by model name or ID |
| 🌍 | **Bilingual UI** | Chinese / English toggle |
| 🌙 | **Dark mode** | System-aware theme with manual override |
| 🎨 | **Theme variants** | Classic, SpaceX, Apple, EVA, Minimal, and more |
| ⭐ | **GitHub Star** | One-click star from the header |
| 📱 | **Responsive** | Card layout on mobile, table on desktop |
| 🤖 | **Auto-updated** | GitHub Actions fetches fresh data daily |

---

## Quick Start

### Preview locally

```bash
git clone https://github.com/yyh-001/llm-value-rankings.git
cd llm-value-rankings

python -m http.server 8080
# or: npx serve .
```

Open [http://localhost:8080](http://localhost:8080).

### Deploy to GitHub Pages

1. Fork this repository
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` · Folder: `/ (root)`
5. Visit `https://<your-username>.github.io/llm-value-rankings/`

### Update data manually

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_data.py
git add data/models.json data/rank_history.json data/coding_plans.json
git commit -m "chore: update model data"
git push
```

Or trigger the **Update Model Data** workflow from the Actions tab.

---

## Methodology

### Value score

```
Value = f(Intelligence) × Speed^0.8 / Price
```

`f(x)` is a **nested square transform** around the mean intelligence score:

```
f(x) = (avg + (x - avg)²)²          if x ≥ avg
f(x) = (avg - (avg - x)²)²          if x < avg  (excluded when inner ≤ 0)
```

This rewards models above the average more than a plain square, without the harsh spread of a pure 4th power. The UI shows the **raw** intelligence score; ranking uses the transformed value.

| Metric | Source | Notes |
|--------|--------|-------|
| Intelligence | OpenRouter embedded AA `intelligence_index` | Artificial Analysis Intelligence Index, 0–100 |
| Speed | OpenRouter Endpoints API + RSC page scrape | Uptime-weighted average of provider p50 throughput |
| TTFT | OpenRouter Endpoints API | Time-to-first-token p50 in seconds |
| Price | OpenRouter | Uptime-weighted effective price: 3:1 input/output token mix, 95% cache-hit on input ($/1M) |

### Score scale (0–100)

After computing the raw value above, scores are **normalized to a 0–100 scale**. The top-ranked model is always **100**; others are proportional.

### Exclusion rules

Models are excluded from ranking when:

- Raw intelligence score is **below 25**
- The transformed capability score is **≤ 0** (inner term below zero for below-average models)
- The model name contains `distill`

### Ranking rules

- Text-output LLMs only (image-generation models excluded via OpenRouter `output_modalities`)
- Requires both intelligence score and pricing data
- Models with `distill` in the name are excluded
- Sorted by value score descending

---

## Channel pricing

By default the leaderboard ranks by **OpenRouter blended price**. Turn on **Rank by lowest channel price** beside the search bar to use each model’s cheapest channel.

### Channels (6)

| Channel | Type | Notes |
|---------|------|-------|
| **OpenRouter** | Pay-as-you-go API | Uptime-weighted blended price from `models.json` |
| **OpenCode Go** | $10/mo subscription | Full catalog from official docs, matched to ranked models by slug |
| **Command Code GOAT** | $10/mo subscription | GOAT plan table parsed and matched by label/slug |
| **DeepSeek official API** | Pay-as-you-go | 24h peak/off-peak weighted average (7h peak + 17h off-peak CST) |
| **GPT Plus** | Codex subscription | Estimated $/M from OpenAI Codex pricing and weekly quotas |
| **MiniMax Token Plan** | MiniMax subscription | Individual monthly Plus ¥49 / Max ¥119 / Ultra ¥469, official M3 token pool; M3 and M2.7 share quota |

All channel rates are normalized to **¥/M tokens** (95% cache hit, 3:1 input/output) and shown in the model detail modal, **sorted cheapest first**.

### Matching & scope

- Channel prices attach only to **ranked** models (`rank` set); vendor slugs/labels are matched strictly to OpenRouter model IDs
- Zhipu GLM Coding Plan and Kimi official membership/API plans are **not** included (credit/membership billing differs from per-token leaderboard pricing)
- Generated by `scripts/fetch_coding_plans.py` into `data/coding_plans.json`

---

## Project Structure

```
llm-value-rankings/
├── index.html                  # Main page (classic theme)
├── spacex.html / apple.html …  # Alternate theme entry points
├── css/style.css               # Styles (light/dark, multi-theme)
├── js/
│   ├── app.js                  # Core logic (rankings, channels, modal)
│   ├── pareto-chart.js         # Pareto frontier chart
│   └── i18n.js                 # Internationalization
├── data/
│   ├── models.json             # Model data (auto-updated)
│   ├── coding_plans.json       # Channel plans & per-model index (auto-updated)
│   └── rank_history.json       # Daily rank snapshots
├── scripts/
│   ├── fetch_data.py           # Model fetch & ranking
│   ├── fetch_coding_plans.py   # Channel plan scrape & matching
│   ├── recalc_scores.py        # Offline value-score recalc (keeps speed as-is)
│   └── requirements.txt
└── .github/workflows/
    └── update-data.yml         # Daily cron job
```

---

## Data Sources

| Data | Provider | Method |
|------|----------|--------|
| Pricing & model list | [OpenRouter API](https://openrouter.ai/docs/api-reference/models/list-models) | REST |
| Intelligence | OpenRouter embedded AA benchmarks | `intelligence_index` field on model objects |
| Speed & TTFT | [OpenRouter](https://openrouter.ai) | Endpoints API + RSC page scrape |
| Channel plan pricing | OpenCode / Command Code / OpenAI / DeepSeek docs | `fetch_coding_plans.py` scrape & estimates |

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | HTML · CSS · Vanilla JS |
| Data | Static JSON |
| Pipeline | Python 3.11 · GitHub Actions |
| Hosting | GitHub Pages |

No build step. No framework. No database.

---

## Contributing

Contributions are welcome! Here are good starting points:

1. Add model mappings in `scripts/fetch_data.py`
2. Improve UI / i18n copy
3. Refine the ranking algorithm
4. Fix bugs via [Issues](https://github.com/yyh-001/llm-value-rankings/issues)

```bash
# Fork → branch → commit → pull request
git checkout -b feat/your-feature
```

---

## License

[MIT](./LICENSE) © 2026
