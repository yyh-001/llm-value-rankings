# LLM Value Rankings / 大模型性价比排行榜

🏆 AI Model Value Rankings - Compare price/performance of LLMs

基于综合能力评分和价格，计算每美元获得的AI智能分数，帮助你找到最具性价比的AI模型。

## ✨ 特性

- 📊 **智能排名** - 基于 Intelligence Index 和价格计算性价比
- 🌍 **中英双语** - 支持中文/英文切换
- 🌙 **暗色模式** - 支持亮色/暗色主题
- 💬 **评论系统** - 基于 GitHub Issues 的用户评论
- 🤖 **自动更新** - GitHub Actions 每日自动更新数据
- 📱 **响应式** - 完美适配桌面和移动端

## 🚀 快速开始

### 1. Fork 或 Clone 仓库

```bash
git clone https://github.com/YOUR_USERNAME/llm-value-rankings.git
cd llm-value-rankings
```

### 2. 启用 GitHub Pages

1. 进入仓库 Settings → Pages
2. Source 选择 `Deploy from a branch`
3. Branch 选择 `main` 和 `/ (root)`
4. 点击 Save

### 3. 配置评论系统（可选）

在 `js/app.js` 中修改 `CONFIG.GITHUB_REPO` 为你的仓库名：

```javascript
const CONFIG = {
    GITHUB_REPO: 'YOUR_USERNAME/llm-value-rankings',
    // ...
};
```

### 4. 手动更新数据

```bash
pip install requests beautifulsoup4
python scripts/fetch_data.py
git add data/models.json
git commit -m "chore: update model data"
git push
```

## 📁 项目结构

```
llm-value-rankings/
├── index.html              # 主页面
├── css/
│   └── style.css           # 样式（含暗色模式）
├── js/
│   ├── i18n.js            # 国际化
│   ├── app.js             # 主逻辑
│   └── github-comments.js # 评论系统
├── data/
│   └── models.json        # 模型数据（自动更新）
├── scripts/
│   ├── fetch_data.py      # 数据抓取脚本
│   └── requirements.txt   # Python 依赖
└── .github/
    └── workflows/
        └── update-data.yml # GitHub Actions 配置
```

## 🔧 自动更新

项目配置了 GitHub Actions，每天自动：

1. 从 OpenRouter 获取最新模型价格
2. 从 Artificial Analysis 获取能力评分
3. 计算性价比排名
4. 更新 `data/models.json`

## 📊 数据来源

| 数据 | 来源 |
|------|------|
| 模型价格 | [OpenRouter API](https://openrouter.ai) |
| 能力评分 | [Artificial Analysis](https://artificialanalysis.ai) |

## 🧮 计算方法

```
性价比分数 = 能力评分 / (每百万Token价格)
```

- **能力评分**: Artificial Analysis Intelligence Index (0-100)
- **价格**: 输入和输出价格的平均值 (Blended Price)
- **分数越高**: 每美元获得的AI能力越多

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License
