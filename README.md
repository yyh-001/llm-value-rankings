# LLM Value Rankings / 大模型性价比排行榜

[![GitHub Actions](https://img.shields.io/badge/data-auto--updated-brightgreen)](.github/workflows/update-data.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

基于 **Artificial Analysis 能力评分**、**输出速度** 与 **OpenRouter 价格**，计算大模型性价比排名，帮你快速找到「每美元能买到多少 AI 能力」。

> 纯静态站点，零后端依赖，Fork 后开启 GitHub Pages 即可部署。

---

## ✨ 特性

| 功能 | 说明 |
|------|------|
| 📊 智能排名 | 综合能力² × 速度 / 价格，低分模型有惩罚系数 |
| 🏅 Top 3 展示 | 首页突出显示性价比最高的三个模型 |
| 🔍 实时搜索 | 按模型名称或 ID 过滤 |
| 🌍 中英双语 | 一键切换中文 / English |
| 🌙 暗色模式 | 跟随系统偏好，支持手动切换 |
| 💬 GitHub 评论 | 基于 Issues 的模型讨论（可选配置） |
| 🤖 自动更新 | GitHub Actions 每日抓取最新数据 |
| 📱 响应式布局 | 桌面与移动端均可流畅浏览 |

---

## 🚀 快速开始

### 本地预览

```bash
git clone https://github.com/YOUR_USERNAME/llm-value-rankings.git
cd llm-value-rankings

# 任选一种方式启动本地服务
python -m http.server 8080
# 或: npx serve .
# 或: npx live-server
```

浏览器访问 `http://localhost:8080` 即可。

### 部署到 GitHub Pages

> GitHub 创建仓库时，Repository name 填 `llm-value-rankings`，Description 可填 **LLM Value Rankings**。

1. Fork 本仓库
2. 进入 **Settings → Pages**
3. Source 选择 **Deploy from a branch**
4. Branch 选 `main`，目录选 **/ (root)**
5. 保存后等待几分钟，访问 `https://YOUR_USERNAME.github.io/llm-value-rankings/`

### 配置评论系统（可选）

在 `js/app.js` 中设置你的 GitHub 仓库：

```javascript
const CONFIG = {
    GITHUB_REPO: 'YOUR_USERNAME/llm-value-rankings',
    // ...
};
```

### 手动更新数据

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_data.py
git add data/models.json
git commit -m "chore: update model data"
git push
```

也可在 GitHub Actions 页面手动触发 **Update Model Data** 工作流。

---

## 📁 项目结构

```
llm-value-rankings/
├── index.html                 # 主页面
├── css/
│   └── style.css              # 样式（含暗色模式）
├── js/
│   ├── i18n.js                # 国际化
│   ├── app.js                 # 主逻辑
│   └── github-comments.js     # GitHub Issues 评论
├── data/
│   └── models.json            # 模型数据（自动更新）
├── scripts/
│   ├── fetch_data.py          # 数据抓取与排名计算
│   └── requirements.txt       # Python 依赖
└── .github/
    └── workflows/
        └── update-data.yml    # 每日自动更新
```

---

## 🧮 计算方法

### 性价比公式

```
性价比 = 能力² × 速度 / 价格
```

| 指标 | 来源 | 说明 |
|------|------|------|
| **能力评分** | [Artificial Analysis](https://artificialanalysis.ai) | Intelligence Index，0–100 分 |
| **速度** | Artificial Analysis | 输出速度 (tokens/s)，缺失时默认 80 |
| **价格** | [OpenRouter](https://openrouter.ai) | 输入与输出 Token 价格的平均值 ($/1M tokens) |

### 低分惩罚

能力评分低于平均分（40 分）的模型会额外乘以惩罚系数：

```
惩罚系数 = (评分 / 40)²
最终分数 = 基础分数 × 惩罚系数
```

### 排名规则

- 仅收录 **文本输出** 的大语言模型（OpenRouter `output_modalities` 含 `image` 的生图模型会被排除）
- 仅对同时拥有能力评分与价格数据的模型排名
- 名称含 `distill` 的蒸馏模型不参与排名
- 按性价比分数降序排列

---

## 🔧 自动更新

GitHub Actions 工作流（`.github/workflows/update-data.yml`）会在以下情况运行：

- 每天 UTC 00:00 定时执行
- `scripts/` 目录有变更时 push 触发
- 在 Actions 页面手动触发

流程：抓取 OpenRouter 价格 → 匹配 Artificial Analysis 评分 → 计算排名 → 提交 `data/models.json`。

---

## 📊 数据来源

| 数据 | 来源 | 获取方式 |
|------|------|----------|
| 模型价格 | [OpenRouter API](https://openrouter.ai/docs/api-reference/models/list-models) | REST API |
| 能力 & 速度 | [Artificial Analysis Leaderboard](https://artificialanalysis.ai/leaderboards/models) | 页面解析 + 内置映射表 |

---

## 🛠 技术栈

- **前端**：原生 HTML / CSS / JavaScript，无构建步骤
- **数据**：JSON 静态文件
- **更新**：Python 3.11 + GitHub Actions
- **部署**：GitHub Pages（或任意静态托管）

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！常见贡献方向：

- 补充 Artificial Analysis 模型映射（`scripts/fetch_data.py`）
- 改进 UI / 国际化文案
- 优化排名算法

---

## 📄 License

[MIT License](LICENSE)
