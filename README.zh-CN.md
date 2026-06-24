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
- **速度** — 输出 Token 速度（tokens/s）
- **价格** — [OpenRouter](https://openrouter.ai) 输入/输出混合均价

每日自动更新，帮你快速找到**每美元能买到最多 AI 能力**的模型。

> 纯静态站点 · 零后端 · Fork 后开启 GitHub Pages 即可部署。

---

## 功能特性

| | 功能 | 说明 |
|:---:|------|------|
| 📊 | **智能排名** | `f(能力) × 速度^0.8 / 价格`，低于 25 分或变换后 ≤0 不参与排名 |
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
| 速度 | OpenRouter Endpoints API + RSC 页面爬取 | 各 Provider 峰值吞吐（30 分钟 p99 最高，tokens/s） |
| 首字延迟 | OpenRouter Endpoints API | TTFT p50（秒），无数据时显示 — |
| 价格 | OpenRouter | uptime 加权有效价：输入:输出按 3:1 混合，输入侧 70% 缓存命中 ($/1M tokens) |

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

## 项目结构

```
llm-value-rankings/
├── index.html                  # 主页面
├── css/style.css               # 样式（含暗色模式）
├── js/
│   ├── app.js                  # 主逻辑
│   └── i18n.js                 # 国际化
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
| 模型列表 & 价格 | [OpenRouter API](https://openrouter.ai/docs/api-reference/models/list-models) | REST API |
| 能力评分 | OpenRouter 内嵌 AA 基准 | 模型对象中的 `intelligence_index` 字段 |
| 速度 & 首字延迟 | [OpenRouter](https://openrouter.ai) | Endpoints API + RSC 页面爬取 |

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
