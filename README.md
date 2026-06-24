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

- **Intelligence** — [Artificial Analysis](https://artificialanalysis.ai) benchmark scores
- **Speed** — output tokens per second
- **Price** — blended input/output cost from [OpenRouter](https://openrouter.ai)

The result is a daily-updated leaderboard that answers one question: **how much AI capability do you get per dollar?**

> Static site · zero backend · deploy with GitHub Pages in one minute.

Social preview image: [`assets/og-preview.png`](assets/og-preview.png) (1280×640). Upload the same file under **Settings → General → Social preview** for GitHub link cards.

---

## Features

| | Feature | Description |
|:---:|---------|-------------|
| 📊 | **Smart ranking** | `Intelligence³ × Speed / Price`, min score 25 |
| 📈 | **Day-over-day delta** | See rank changes vs yesterday (`↑2` / `↓1` / `NEW`) |
| 🏅 | **Top 3 podium** | Highlight the best value models on the homepage |
| 🔍 | **Live search** | Filter by model name or ID |
| 🌍 | **Bilingual UI** | Chinese / English toggle |
| 🌙 | **Dark mode** | System-aware theme with manual override |
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
git add data/models.json data/rank_history.json
git commit -m "chore: update model data"
git push
```

Or trigger the **Update Model Data** workflow from the Actions tab.

---

## Methodology

### Value score

```
Value = Intelligence³ × Speed / Price
```

| Metric | Source | Notes |
|--------|--------|-------|
| Intelligence | Artificial Analysis | Index score 0–100 |
| Speed | OpenRouter Endpoints API | Measured throughput p50 (tokens/s; default 80 if missing) |
| TTFT | OpenRouter Endpoints API | Time-to-first-token p50 in seconds |
| Price | OpenRouter | Effective blended price with 50% cache-hit weighting ($/1M tokens) |

### Score scale (0–100)

After computing the raw value above, scores are **normalized to a 0–100 scale**. The top-ranked model is always **100**; others are proportional.

### Minimum intelligence threshold

Models scoring **below 25** are excluded from ranking — cheap but low-capability models won't clutter the leaderboard.

### Ranking rules

- Text-output LLMs only (image-generation models excluded via OpenRouter `output_modalities`)
- Requires both intelligence score and pricing data
- Models with `distill` in the name are excluded
- Sorted by value score descending

---

## Project Structure

```
llm-value-rankings/
├── index.html                  # Entry page
├── css/style.css               # Styles (light / dark)
├── js/
│   ├── app.js                  # Core logic
│   ├── i18n.js                 # Internationalization
│   └── github-comments.js      # GitHub Issues comments (optional)
├── data/
│   ├── models.json             # Model data (auto-updated)
│   └── rank_history.json       # Daily rank snapshots
├── scripts/
│   ├── fetch_data.py           # Data fetcher & rank calculator
│   └── requirements.txt
└── .github/workflows/
    └── update-data.yml         # Daily cron job
```

---

## Data Sources

| Data | Provider | Method |
|------|----------|--------|
| Pricing | [OpenRouter API](https://openrouter.ai/docs/api-reference/models/list-models) | REST |
| Intelligence & Speed | [Artificial Analysis](https://artificialanalysis.ai/leaderboards/models) | Scraping + mapping table |

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
