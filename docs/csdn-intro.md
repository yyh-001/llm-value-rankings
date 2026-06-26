# 我做了个开源「大模型性价比排行榜」—— 300+ 模型每日自动更新，帮你看清每美元能买多少 AI 能力

> **在线访问：** https://yyh-001.github.io/llm-value-rankings/  
> **开源仓库：** https://github.com/yyh-001/llm-value-rankings  
> 如果觉得有用，欢迎去 GitHub **Star ⭐** 支持一下！

---

## 为什么做这个

平时选大模型，大家习惯看能力榜——谁分高用谁。但实际用起来，还有两个绕不开的问题：

1. **贵不贵？** 能力最强的往往也是最贵的  
2. **快不快？** 同样能力，推理速度差很多，Agent 场景体验完全不同  

而且 OpenRouter 上的转售价格，和 DeepSeek、MiMo 等**官方 API 定价**有时差不少。只看 OpenRouter 标价，容易高估某些模型的成本。

所以我做了 **[大模型性价比排行榜](https://yyh-001.github.io/llm-value-rankings/)**：把**能力、速度、价格**三个维度合在一起，每天自动更新，直接回答一个问题——

> **花同样的钱，能买到多少 AI 能力？**

---

## 站点能做什么

- 覆盖 **300+ 文本大模型**，筛选 **30 个**有完整数据的模型做排名
- **每日自动更新**（GitHub Actions 定时抓取，无需人工维护）
- 展示能力分、输出速度、首 Token 延迟、有效价格、排名日变化
- 模型详情页显示**价格渠道**（OpenRouter / DeepSeek 官方 / MiMo 官方等）
- 中英双语、暗色模式、移动端适配
- **完全开源**，公式和抓取逻辑可审计

![建议插入：首页 Top 3 + 排行榜截图]

---

## 怎么算「性价比」

核心公式：

```
性价比 = f(能力) × 速度^0.8 / 价格
```

- **能力**：Artificial Analysis Intelligence Index（0–100），来自 OpenRouter 内嵌 benchmark  
- **速度**：OpenRouter 各 Provider 的 p50 吞吐（tok/s），取最高值  
- **价格**：有效混合价（$/百万 tokens），输入:输出按 3:1，缓存命中按 70% 估算  

部分模型已接入**官方 API 定价**（比 OpenRouter 转售便宜时自动覆盖）：

| 模型 | 价格渠道 | 有效混合价（约） |
|------|----------|------------------|
| DeepSeek V4 Pro | DeepSeek 官方 API | $0.30/M |
| DeepSeek V4 Flash | DeepSeek 官方 API | $0.10/M |
| MiMo-V2.5-Pro | Xiaomi MiMo 官方 API | $0.30/M |

能力分还会做以当日均分为中心的嵌套平方变换，放大高于均分的模型优势。完整方法论见站点首页和 [GitHub README](https://github.com/yyh-001/llm-value-rankings)。

---

## 当前 Top 5 速览

> 数据每日变化，以站点实时榜单为准。

| 排名 | 模型 | 能力 | 速度 | 有效价 | 渠道 |
|:----:|------|:----:|:----:|:------:|------|
| 1 | GLM 5.2 | 51 | 115 tok/s | $1.58/M | OpenRouter |
| 2 | Gemini 3.5 Flash | 50 | 138 tok/s | $2.67/M | OpenRouter |
| 3 | DeepSeek V4 Pro | 44 | 60 tok/s | $0.30/M | DeepSeek 官方 |
| 4 | DeepSeek V4 Flash | 40 | 77 tok/s | $0.10/M | DeepSeek 官方 |
| 5 | Claude Opus 4.8 | 56 | 58 tok/s | $7.64/M | OpenRouter |

DeepSeek V4 系列走官方价后性价比非常突出；GLM 5.2 在能力、速度、价格三者平衡上目前排第一。

---

## 技术栈：极简、零后端

```
前端   HTML + CSS + Vanilla JS（无框架、无构建）
数据   静态 JSON，GitHub Actions 每日更新
托管   GitHub Pages
许可   MIT
```

Fork 后开启 Pages 即可自部署，本地预览：

```bash
git clone https://github.com/yyh-001/llm-value-rankings.git
cd llm-value-rankings
python -m http.server 8080
```

---

## 适合谁

- 在 **OpenRouter** 上选型、比价的开发者  
- 做 **Agent / RAG**，需要平衡成本与效果的团队  
- 想快速了解 DeepSeek、GLM、Gemini、Claude 等同档模型谁更值  

---

## 后续计划

当前榜单按 **按量 API 定价**（OpenRouter 有效价 + 官方 API 覆盖）计算性价比。很多开发者实际用的是 **Coding Plan**（包月订阅、固定额度内无限或限速调用），和按 token 计费完全是两套逻辑。

后续会接入 **Coding Plan 价格计算**，计划包括：

- 收录各厂商 Coding Plan / 编程订阅方案的定价与额度规则  
- 折算成可对比的「有效 $/M tokens」或「$/能力分」参与排名  
- 考虑单独做 **Coding Plan 专项榜单**，与现有 API 按量榜并列，方便写代码场景选型  

如果你在用某家 Coding Plan、有定价资料或折算思路，欢迎到 GitHub 提 Issue 一起完善。

---

## 求 Star ⭐

这是一个个人开源 side project，数据管道、UI、官方渠道定价覆盖、Coding Plan 榜单都在持续迭代。

如果对你选型有帮助，或者觉得这种「能力 × 速度 ÷ 价格」的思路有意思，欢迎：

1. **Star 仓库** → https://github.com/yyh-001/llm-value-rankings  
2. **在线体验** → https://yyh-001.github.io/llm-value-rankings/  
3. 有模型渠道定价、公式建议或 bug，欢迎提 Issue  

Star 是对独立开发者最好的鼓励，感谢支持 🙏

---

## 链接汇总

| | 地址 |
|---|------|
| 🌐 在线站点 | https://yyh-001.github.io/llm-value-rankings/ |
| ⭐ GitHub | https://github.com/yyh-001/llm-value-rankings |
| 📊 原始数据 | https://yyh-001.github.io/llm-value-rankings/data/models.json |

---

**CSDN 发布建议**

- 文章类型：原创 · 人工智能 / 项目实践  
- 标签：`大模型` `OpenRouter` `DeepSeek` `LLM` `开源项目`  
- 封面：截首页 Top 3 或排行榜表格  
