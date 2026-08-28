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

- **能力** — [Artificial Analysis](https://artificialanalysis.ai) Intelligence Index（OpenRouter 内嵌基准）
- **速度** — 输出 Token 速度（tokens/s，各 Provider 按 uptime 加权平均）
- **价格** — [OpenRouter](https://openrouter.ai) 输入/输出混合均价，并支持 **7 个渠道** 的套餐/API 比价

除 OpenRouter 按量价外，站点还会爬取 **OpenCode Go**、**Command Code GOAT**、**DeepSeek 官方 API**、**GPT Plus**、**MiniMax Token Plan**、**MiMo Token Plan** 等渠道价，在模型详情中并排展示；可开启 **「按最低渠道价排名」**，用各模型可获得的最低价重算性价比与排序。

每日自动更新，帮你快速找到**每美元能买到最多 AI 能力**的模型。

> 纯静态站点 · 零后端 · Fork 后开启 GitHub Pages 即可部署。

---

## 功能特性

| | 功能 | 说明 |
|:---:|------|------|
| 📊 | **智能排名** | `f(能力) × 速度^0.8 / 价格`，低于 25 分或变换后 ≤0 不参与排名 |
| 💰 | **多渠道比价** | OpenCode Go、Command Code、DeepSeek 官方 API、GPT Plus、MiniMax Token Plan、MiMo Token Plan + OpenRouter，详情弹窗按最低价排序 |
| 🔄 | **最低渠道价排名** | 默认关闭：开启后用各模型最低渠道价重算性价比、价格列与排序（偏好会记住） |
| 📋 | **渠道一览** | 搜索栏旁可折叠查看当前收录的渠道数、套餐数与覆盖模型数 |
| 📉 | **帕累托前沿图** | Top 30 能力 vs 价格散点图；悬停显示该价格对应的渠道商 |
| 📈 | **较昨日变化** | 显示排名升降（`↑2` / `↓1` / `新`） |
| 🏅 | **Top 3 展示** | 首页突出性价比最高的三个模型 |
| 🔍 | **实时搜索** | 按模型名称或 ID 过滤 |
| 🌍 | **中英双语** | 界面一键切换中文 / English |
| 🌙 | **暗色模式** | 跟随系统偏好，支持手动切换 |
| 🎨 | **多套主题** | 经典 / SpaceX / Apple / EVA / 极简等风格页 |
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
git add data/models.json data/rank_history.json data/coding_plans.json
git commit -m "chore: update model data"
git push
```

也可在 GitHub Actions 页面手动触发 **Update Model Data** 工作流。

---

## 计算方法

### 性价比公式

```
性价比 = f(能力) × 速度^0.8 / 价格
```

`f(x)` 是以能力均分为基准的**嵌套平方变换**：

```
f(x) = (均分 + (x - 均分)²)²          当 x ≥ 均分
f(x) = (均分 - (均分 - x)²)²          当 x < 均分（内层 ≤ 0 时排除）
```

相比单层平方，高分模型奖励更大；相比纯 4 次方更温和。页面展示**原始**能力分，排名使用变换后的值。

| 指标 | 来源 | 说明 |
|------|------|------|
| 能力评分 | OpenRouter 内嵌 AA `intelligence_index` | Artificial Analysis Intelligence Index，0–100 分 |
| 速度 | OpenRouter Endpoints API + RSC 页面爬取 | 各 Provider p50 吞吐（tok/s），按 uptime 加权平均 |
| 首字延迟 | OpenRouter Endpoints API | TTFT p50（秒），无数据时显示 — |
| 价格 | OpenRouter | uptime 加权有效价：输入:输出按 3:1 混合，输入侧 95% 缓存命中 ($/1M tokens) |

### 百分制换算

先按上式计算原始分数，再**归一化到 0–100 分**：榜首模型固定为 **100 分**，其余模型按相对比例显示。

### 排除规则

以下模型不参与排名：

- 原始能力分 **低于 25 分**
- 变换后能力分 **≤ 0**（低于均分且内层为负）
- 名称含 `distill` 的蒸馏模型

### 排名规则

- 仅收录**文本输出**的大语言模型（OpenRouter `output_modalities` 含 `image` 的生图模型会被排除）
- 仅对同时拥有能力评分与价格数据的模型排名
- 名称含 `distill` 的蒸馏模型不参与排名
- 按性价比分数降序排列

---

## 多渠道比价

主榜默认按 **OpenRouter 混合价** 计算性价比（可在搜索栏旁开启「按最低渠道价排名」）。

### 收录渠道（7 个）

| 渠道 | 类型 | 说明 |
|------|------|------|
| **OpenRouter** | 按量 API | 来自 `models.json` 的 uptime 加权混合价 |
| **OpenCode Go** | $10/月 订阅 | 解析官方文档全量套餐，按 slug 匹配上榜模型 |
| **Command Code GOAT** | $10/月 订阅 | 解析 GOAT 套餐表，按模型名/slug 匹配 |
| **DeepSeek 官方 API** | 按量 API | 峰谷加权均价（7h 高峰 + 17h 低谷，CST） |
| **GPT Plus** | Codex 订阅 | 按 OpenAI Codex 定价与周额度估算等效 $/M |
| **MiniMax Token Plan** | MiniMax 订阅摊薄 | 个人月付 Plus ¥49 / Max ¥119 / Ultra ¥469，按官方 M3 token 池摊薄；M3 与 M2.7 共用额度 |
| **MiMo Token Plan** | 小米订阅摊薄 | 月付 Lite ¥39 / Standard ¥99 / Pro ¥329 / Max ¥659；按官方 Credits/token 与 Agent mix 折算（Credit ≠ token） |

渠道价统一折算为 **¥/M tokens**（95% 缓存命中、输入:输出 3:1），在模型详情中与 OpenRouter 价一并展示，**按最低价排序**。

### 匹配与范围

- 仅对 **已上榜**（有 `rank`）的模型挂载渠道价；套餐内模型通过 vendor slug / 名称与 OpenRouter 模型 ID 严格匹配
- 智谱 GLM Coding Plan、Kimi 官方会员/API 等积分制或会员制套餐**未纳入**渠道比价（与主榜按量计价口径不一致）
- 数据由 `scripts/fetch_coding_plans.py` 生成，写入 `data/coding_plans.json`

---

## 项目结构

```
llm-value-rankings/
├── index.html                  # 主页面（经典主题）
├── spacex.html / apple.html …  # 其他主题入口
├── css/style.css               # 样式（含暗色模式、多主题）
├── js/
│   ├── app.js                  # 主逻辑（排名、渠道价、详情弹窗）
│   ├── pareto-chart.js         # 帕累托前沿图
│   └── i18n.js                 # 国际化
├── data/
│   ├── models.json             # 模型数据（自动更新）
│   ├── coding_plans.json       # 渠道套餐与按模型索引（自动更新）
│   └── rank_history.json       # 每日排名快照
├── scripts/
│   ├── fetch_data.py           # 模型数据抓取与排名计算
│   ├── fetch_coding_plans.py   # 渠道套餐爬取与匹配
│   ├── recalc_scores.py        # 离线重算性价比（不改速度）
│   └── requirements.txt
└── .github/workflows/
    └── update-data.yml         # 每日自动更新
```

---

## 数据来源

| 数据 | 来源 | 获取方式 |
|------|------|----------|
| 模型列表 & 价格 | [OpenRouter API](https://openrouter.ai/docs/api-reference/models/list-models) | REST API |
| 能力评分 | OpenRouter 内嵌 AA 基准 | 模型对象中的 `intelligence_index` 字段 |
| 速度 & 首字延迟 | [OpenRouter](https://openrouter.ai) | Endpoints API + RSC 页面爬取 |
| 渠道套餐价 | OpenCode / Command Code / OpenAI / DeepSeek 官方文档 | `fetch_coding_plans.py` 爬取与估算 |

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
