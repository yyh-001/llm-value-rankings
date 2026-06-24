<div align="center">

# 大模型性价比排行榜

**每日更新的大模型性价比排名 —— 帮你看清每美元能买到多少 AI 能力**

🌐 **在线访问：** [https://yyh-001.github.io/llm-value-rankings/](https://yyh-001.github.io/llm-value-rankings/)

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md)

[![Live Demo](https://img.shields.io/badge/在线演示-live-6366f1?style=for-the-badge)](https://yyh-001.github.io/llm-value-rankings/)
[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/yyh-001/llm-value-rankings/update-data.yml?style=for-the-badge&label=数据更新)](.github/workflows/update-data.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

[🌐 在线访问](https://yyh-001.github.io/llm-value-rankings/) · [🐛 反馈问题](https://github.com/yyh-001/llm-value-rankings/issues) · [✨ 功能建议](https://github.com/yyh-001/llm-value-rankings/issues)

</div>

---

## 项目简介

LLM Value Rankings 综合以下三项指标，对 **300+ 大模型** 进行性价比排名：

- **能力** — [Artificial Analysis](https://artificialanalysis.ai) 基准评分
- **速度** — 输出 Token 速度（tokens/s）
- **价格** — [OpenRouter](https://openrouter.ai) 输入/输出混合均价

每日自动更新，帮你快速找到**每美元能买到最多 AI 能力**的模型。

> 纯静态站点 · 零后端 · Fork 后开启 GitHub Pages 即可部署。

---

## 功能特性

| | 功能 | 说明 |
|:---:|------|------|
| 📊 | **智能排名** | `能力³ × 速度 / 价格`，低于 25 分不参与排名 |
| 📈 | **较昨日变化** | 显示排名升降（`↑2` / `↓1` / `新`） |
| 🏅 | **Top 3 展示** | 首页突出性价比最高的三个模型 |
| 🔍 | **实时搜索** | 按模型名称或 ID 过滤 |
| 🌍 | **中英双语** | 界面一键切换中文 / English |
| 🌙 | **暗色模式** | 跟随系统偏好，支持手动切换 |
| ⭐ | **GitHub Star** | 右上角一键 Star |
| 📱 | **响应式布局** | 移动端卡片视图，桌面端表格视图 |
| 🤖 | **自动更新** | GitHub Actions 每日抓取最新数据 |

---

## 快速开始

### 本地预览

```bash
git clone https://github.com/yyh-001/llm-value-rankings.git
cd llm-value-rankings

python -m http.server 8080
# 或: npx serve .
```

浏览器访问 [http://localhost:8080](http://localhost:8080)。

### 部署到 GitHub Pages

1. Fork 本仓库
2. 进入 **Settings → Pages**
3. Source 选择 **Deploy from a branch**
4. Branch 选 `main`，目录选 **/ (root)**
5. 保存后访问 `https://<你的用户名>.github.io/llm-value-rankings/`

### 手动更新数据

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_data.py
git add data/models.json data/rank_history.json
git commit -m "chore: update model data"
git push
```

也可在 GitHub Actions 页面手动触发 **Update Model Data** 工作流。

---

## 计算方法

### 性价比公式

```
性价比 = 能力³ × 速度 / 价格
```

能力采用 **三次方**，让能力差距在排名中占主导地位（能力 50 比 40 的权重约为 1.95 倍）。

| 指标 | 来源 | 说明 |
|------|------|------|
| 能力评分 | Artificial Analysis | Intelligence Index，0–100 分 |
| 速度 | OpenRouter Endpoints API | 各 Provider 实测吞吐量 p50 (tokens/s)，缺失时默认 80 |
| 首字延迟 | OpenRouter Endpoints API | TTFT p50（秒），无数据时显示 — |
| 价格 | OpenRouter | uptime 加权有效价：输入:输出按 3:1 混合，输入侧 70% 缓存命中 ($/1M tokens) |

### 百分制换算

先按上式计算原始分数，再**归一化到 0–100 分**：榜首模型固定为 **100 分**，其余模型按相对比例显示。

### 能力下限

能力评分 **低于 25 分** 的模型不参与排名，避免「极低价但几乎不可用」的模型占据榜单。

### 排名规则

- 仅收录**文本输出**的大语言模型（OpenRouter `output_modalities` 含 `image` 的生图模型会被排除）
- 仅对同时拥有能力评分与价格数据的模型排名
- 名称含 `distill` 的蒸馏模型不参与排名
- 按性价比分数降序排列

---

## GitHub 仓库 About 配置

在线演示地址：[https://yyh-001.github.io/llm-value-rankings/](https://yyh-001.github.io/llm-value-rankings/)

仓库 About（网站链接、描述、Topics）由 [`.github/about.json`](.github/about.json) 定义，推送后由 **Sync Repository About** 工作流自动同步。

> **注意**：Actions 的 **Read and write permissions** 只够推送代码，**不能**改仓库 About 的 description 和 topics。需要额外配置 PAT，或在本地用已登录的 `gh` 同步。

### 方式 A：GitHub Actions 自动同步（推荐）

1. 创建 [Fine-grained PAT](https://github.com/settings/tokens?type=beta)，仅授权本仓库，勾选 **Administration → Read and write**
2. 在仓库 **Settings → Secrets and variables → Actions** 添加 secret：`REPO_SETTINGS_TOKEN`
3. 手动运行 **Sync Repository About** 工作流，或再次推送 `.github/about.json`

### 方式 B：本地一键同步

```bash
gh auth login
python scripts/sync_repo_about.py
```

### 方式 C：手动填写 About

在仓库首页右侧齿轮 → About，填入：

- **Website**：`https://yyh-001.github.io/llm-value-rankings/`
- **Description**：`Daily LLM value rankings - compare 300+ models by intelligence, speed and price. OpenRouter + Artificial Analysis. 大模型性价比排行榜`
- **Topics**：`llm`, `large-language-models`, `ai-ranking`, `openrouter`, `artificial-intelligence`, `model-comparison`, `benchmark`, `token-pricing`, `price-comparison`, `generative-ai`, `machine-learning`, `github-pages`, `static-site`, `deepseek`, `gpt`, `claude`, `gemini`, `value-for-money`, `llm-benchmark`, `ai-tools`

### 社交预览图

分享链接时的 Open Graph / Twitter 卡片图位于 [`assets/og-preview.png`](assets/og-preview.png)（1280×640）。

若希望 GitHub 仓库首页分享也显示配图，可在 **Settings → General → Social preview** 上传同一张图。

---

## 项目结构

```
llm-value-rankings/
├── index.html                  # 主页面
├── css/style.css               # 样式（含暗色模式）
├── js/
│   ├── app.js                  # 主逻辑
│   ├── i18n.js                 # 国际化
│   └── github-comments.js      # GitHub Issues 评论（可选）
├── data/
│   ├── models.json             # 模型数据（自动更新）
│   └── rank_history.json       # 每日排名快照
├── scripts/
│   ├── fetch_data.py           # 数据抓取与排名计算
│   └── requirements.txt
└── .github/workflows/
    └── update-data.yml         # 每日自动更新
```

---

## 数据来源

| 数据 | 来源 | 获取方式 |
|------|------|----------|
| 模型价格 | [OpenRouter API](https://openrouter.ai/docs/api-reference/models/list-models) | REST API |
| 能力 & 速度 | [Artificial Analysis Leaderboard](https://artificialanalysis.ai/leaderboards/models) | 页面解析 + 内置映射表 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML · CSS · 原生 JavaScript |
| 数据 | 静态 JSON |
| 更新 | Python 3.11 · GitHub Actions |
| 部署 | GitHub Pages |

无需构建步骤，无框架依赖，无数据库。

---

## 参与贡献

欢迎提交 Issue 和 Pull Request！常见贡献方向：

1. 补充 `scripts/fetch_data.py` 中的模型映射
2. 改进 UI / 国际化文案
3. 优化排名算法
4. 通过 [Issues](https://github.com/yyh-001/llm-value-rankings/issues) 反馈 Bug

```bash
# Fork → 创建分支 → 提交 → 发起 Pull Request
git checkout -b feat/your-feature
```

---

## 开源协议

[MIT](./LICENSE) © 2026
