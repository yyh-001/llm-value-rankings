/**
 * Internationalization (i18n) module
 * Supports Chinese (zh) and English (en)
 */

const translations = {
    zh: {
        // Header
        title: "大模型性价比排行榜",
        logo_sub: "能力均分² × 速度^0.8 / 价格",
        
        // Hero
        hero_badge: "实时数据 · 每日自动更新",
        hero_title: "找到最具性价比的 AI 模型",
        hero_desc: "基于 AA 综合能力指数、输出速度与价格，计算每美元获得的 AI 性价比",
        total_models: "收录模型",
        ranked_models: "已排名",
        last_updated: "更新时间",
        top_models: "🏅 性价比 Top 3",
        
        // Filters
        search_placeholder: "搜索模型...",
        results_count: "共 {count} 个模型",
        no_results: "没有找到匹配的模型",
        
        // Table
        th_rank: "排名",
        th_change: "较昨日",
        th_model: "模型",
        th_provider: "厂商",
        th_intelligence: "能力",
        th_speed: "速度",
        th_ttft: "首字延迟",
        th_price: "价格",
        th_value: "性价比",
        th_detail: "详情",
        loading: "加载中...",
        github_star: "Star",
        rank_new: "新",
        rank_change_hint: "较昨日排名变化",
        
        // Podium
        podium_intelligence: "能力",
        podium_speed: "速度",
        podium_price: "价格",
        
        // Methodology
        methodology_title: "计算方法",
        formula_label: "核心公式",
        formula: "性价比 = f(能力) × 速度^0.8 / 价格",
        formula_note: "f(x)=均分+(x-均分)²（x≥均分）；f(x)=均分-(均分-x)²（x<均分，低分惩罚更重）",
        score_scale: "最终分数按百分制显示，榜首模型为 100 分",
        penalty_desc: "原始能力分低于 25，或变换后 ≤0 的模型不参与排名",
        method_1_title: "能力评分",
        method_1: "Artificial Analysis Intelligence Index（OpenRouter）",
        method_2_title: "输出速度",
        method_2: "OpenRouter 实测吞吐量 (tokens/s)，Endpoints API + RSC 爬取",
        method_3_title: "Token 价格",
        method_3: "OpenRouter 有效价：uptime 加权，输入:输出 3:1，缓存命中 70%",
        
        // Comments
        comments_title: "用户评论",
        login_hint: "登录GitHub后即可评论",
        login_github: "使用GitHub登录",
        comment_placeholder: "分享你对这个模型的使用体验...",
        submit_comment: "发表评论",
        rating_label: "评分",
        no_comments: "暂无评论，来发表第一条吧",
        
        // Footer
        footer_text: "数据来源：OpenRouter",
        footer_auto: "本页面数据由GitHub Actions自动更新，无需人工维护",
        version_label: "版本",
        card_tap_hint: "点击查看详情",
        
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
        cache_read_price: "缓存命中价",
        list_price: "挂牌综合价",
        blended_price: "有效综合价",
        cache_hit_note: "缓存命中率按 70% 估算（Agent/RAG 典型场景）",
        value_rank: "性价比排名",
        detail_metrics: "核心指标",
        detail_about: "模型简介",
        openrouter_link: "在 OpenRouter 查看",
        openrouter_link_aria: "在 OpenRouter 打开此模型页面",
        tokens_unit: "tokens",
        per_million: "每百万",
    },
    en: {
        // Header
        title: "LLM Value Rankings",
        logo_sub: "Intel f(x) × Speed^0.8 / Price",
        
        // Hero
        hero_badge: "Live Data · Updated Daily",
        hero_title: "Find the Best Value AI Models",
        hero_desc: "AI value per dollar from AA Intelligence Index, speed, and OpenRouter pricing",
        total_models: "Total Models",
        ranked_models: "Ranked",
        last_updated: "Last Updated",
        top_models: "🏅 Top 3 Value Models",
        
        // Filters
        search_placeholder: "Search models...",
        results_count: "{count} models found",
        no_results: "No matching models found",
        
        // Table
        th_rank: "Rank",
        th_change: "Δ Day",
        th_model: "Model",
        th_provider: "Provider",
        th_intelligence: "Intel",
        th_speed: "Speed",
        th_ttft: "TTFT",
        th_price: "Price",
        th_value: "Value",
        th_detail: "Detail",
        loading: "Loading...",
        github_star: "Star",
        rank_new: "NEW",
        rank_change_hint: "Rank change vs yesterday",
        
        // Podium
        podium_intelligence: "Intel",
        podium_speed: "Speed",
        podium_price: "Price",
        
        // Methodology
        methodology_title: "Methodology",
        formula_label: "Core Formula",
        formula: "Value = f(Intel) × Speed^0.8 / Price",
        formula_note: "f(x)=avg+(x-avg)² if x≥avg; f(x)=avg-(avg-x)² if x<avg (steeper low-score penalty)",
        score_scale: "Scores use a 0–100 scale; the top model is 100",
        penalty_desc: "Excluded if raw intelligence < 25 or transformed score ≤ 0",
        method_1_title: "Intelligence",
        method_1: "Artificial Analysis Intelligence Index (via OpenRouter)",
        method_2_title: "Output Speed",
        method_2: "OpenRouter measured throughput (tokens/s) via API + RSC scrape",
        method_3_title: "Token Price",
        method_3: "OpenRouter effective price: uptime-weighted, 3:1 in/out, 70% cache hit",
        
        // Comments
        comments_title: "User Comments",
        login_hint: "Login with GitHub to comment",
        login_github: "Login with GitHub",
        comment_placeholder: "Share your experience with this model...",
        submit_comment: "Submit Comment",
        rating_label: "Rating",
        no_comments: "No comments yet. Be the first!",
        
        // Footer
        footer_text: "Data sources: OpenRouter",
        footer_auto: "This page is automatically updated by GitHub Actions",
        version_label: "Version",
        card_tap_hint: "Tap for details",
        
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
        cache_read_price: "Cache Read Price",
        list_price: "List Blended Price",
        blended_price: "Effective Blended Price",
        cache_hit_note: "Cache hit rate assumed at 70% (typical agent/RAG workload)",
        value_rank: "Value Rank",
        detail_metrics: "Key Metrics",
        detail_about: "About",
        openrouter_link: "View on OpenRouter",
        openrouter_link_aria: "Open this model on OpenRouter",
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
