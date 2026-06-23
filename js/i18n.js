/**
 * Internationalization (i18n) module
 * Supports Chinese (zh) and English (en)
 */

const translations = {
    zh: {
        // Header
        title: "大模型性价比排行榜",
        
        // Hero
        hero_title: "找到最具性价比的AI模型",
        hero_desc: "基于综合能力评分和价格，计算每美元获得的AI智能分数",
        total_models: "收录模型",
        ranked_models: "已排名",
        last_updated: "更新时间",
        
        // Filters
        search_placeholder: "搜索模型...",
        
        // Table
        th_rank: "排名",
        th_model: "模型",
        th_provider: "厂商",
        th_intelligence: "能力评分",
        th_price: "价格 ($/1M tokens)",
        th_value: "性价比分数",
        th_detail: "详情",
        loading: "加载中...",
        
        // Methodology
        methodology_title: "计算方法",
        formula: "性价比 = 能力评分² / 价格",
        penalty_desc: "低于平均分(41分)的模型会受到惩罚：乘以 (评分/平均分)²",
        method_1: "能力评分：Artificial Analysis Intelligence Index",
        method_2: "价格：OpenRouter 输入输出平均价 ($/1M tokens)",
        method_3: "仅展示有benchmark评分的主流模型",
        
        // Comments
        comments_title: "用户评论",
        login_hint: "登录GitHub后即可评论",
        login_github: "使用GitHub登录",
        comment_placeholder: "分享你对这个模型的使用体验...",
        submit_comment: "发表评论",
        rating_label: "评分",
        no_comments: "暂无评论，来发表第一条吧",
        
        // Footer
        footer_text: "数据来源：OpenRouter & Artificial Analysis",
        footer_auto: "本页面数据由GitHub Actions自动更新，无需人工维护",
        
        // Messages
        data_error: "数据加载失败，请稍后再试",
        comment_success: "评论发表成功",
        comment_error: "评论发表失败，请重试",
        login_required: "请先登录GitHub",
        
        // Model details
        model_detail: "模型详情",
        context_window: "上下文窗口",
        input_price: "输入价格",
        output_price: "输出价格",
        blended_price: "综合价格",
        value_rank: "性价比排名",
        tokens_unit: "tokens",
        per_million: "每百万",
    },
    en: {
        // Header
        title: "LLM Value Rankings",
        
        // Hero
        hero_title: "Find the Best Value AI Models",
        hero_desc: "Calculate AI intelligence per dollar based on capability scores and pricing",
        total_models: "Total Models",
        ranked_models: "Ranked",
        last_updated: "Last Updated",
        
        // Filters
        search_placeholder: "Search models...",
        
        // Table
        th_rank: "Rank",
        th_model: "Model",
        th_provider: "Provider",
        th_intelligence: "Intelligence",
        th_price: "Price ($/1M tokens)",
        th_value: "Value Score",
        th_detail: "Detail",
        loading: "Loading...",
        
        // Methodology
        methodology_title: "Methodology",
        formula: "Value = Intelligence² / Price",
        penalty_desc: "Models below average (41) get penalized: multiply by (score/avg)²",
        method_1: "Intelligence: Artificial Analysis Intelligence Index",
        method_2: "Price: OpenRouter blended average ($/1M tokens)",
        method_3: "Only shows mainstream models with benchmark scores",
        
        // Comments
        comments_title: "User Comments",
        login_hint: "Login with GitHub to comment",
        login_github: "Login with GitHub",
        comment_placeholder: "Share your experience with this model...",
        submit_comment: "Submit Comment",
        rating_label: "Rating",
        no_comments: "No comments yet. Be the first!",
        
        // Footer
        footer_text: "Data sources: OpenRouter & Artificial Analysis",
        footer_auto: "This page is automatically updated by GitHub Actions",
        
        // Messages
        data_error: "Failed to load data. Please try again later.",
        comment_success: "Comment submitted successfully",
        comment_error: "Failed to submit comment. Please try again.",
        login_required: "Please login with GitHub first",
        
        // Model details
        model_detail: "Model Details",
        context_window: "Context Window",
        input_price: "Input Price",
        output_price: "Output Price",
        blended_price: "Blended Price",
        value_rank: "Value Rank",
        tokens_unit: "tokens",
        per_million: "per million",
    }
};

class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('lang') || 'zh';
        this.listeners = [];
    }

    t(key) {
        const lang = translations[this.currentLang];
        return lang[key] || key;
    }

    setLang(lang) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        this.updateDOM();
        this.listeners.forEach(cb => cb(lang));
    }

    toggleLang() {
        const newLang = this.currentLang === 'zh' ? 'en' : 'zh';
        this.setLang(newLang);
        return newLang;
    }

    onLangChange(callback) {
        this.listeners.push(callback);
    }

    updateDOM() {
        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLang === 'zh' ? 'zh-CN' : 'en';
    }

    init() {
        this.updateDOM();
        
        // Setup language toggle button
        const langToggle = document.getElementById('lang-toggle');
        const langLabel = document.getElementById('lang-label');
        
        if (langLabel) {
            langLabel.textContent = this.currentLang === 'zh' ? 'EN' : '中';
        }
        
        if (langToggle) {
            langToggle.addEventListener('click', () => {
                const newLang = this.toggleLang();
                langLabel.textContent = newLang === 'zh' ? 'EN' : '中';
            });
        }
    }
}

// Export singleton
window.i18n = new I18n();
