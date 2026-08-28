/**
 * LLM Value Rankings - Main Application
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
    SUPPLIER_PLANS_URL: 'data/coding_plans.json',
    ITEMS_PER_PAGE: 20,
    GITHUB_REPO: 'yyh-001/llm-value-rankings',
    MOBILE_BREAKPOINT: 768,
    USD_TO_CNY: 7.25,
};

// State
const state = {
    models: [],
    filteredModels: [],
    currentPage: 1,
    sortBy: 'capability',
    providerFilter: '',
    priceRange: '',
    searchQuery: '',
    rankComparedTo: null,
    isMobile: false,
    scoringMeta: null,
    supplierPlansByModel: {},
    supplierMethodology: null,
    channelStats: null,
    useMinChannelPrice: false,
    priceUnit: '100M',
};

const MIN_CHANNEL_PRICE_KEY = 'ui-min-channel-price';
const PRICE_UNIT_KEY = 'ui-price-unit';

const CHANNEL_PROVIDER_ORDER = ['opencode', 'commandcode', 'deepseek', 'openai', 'minimax', 'xiaomi'];

// Provider display names
const PROVIDER_NAMES = {
    openai: { zh: 'OpenAI', en: 'OpenAI' },
    anthropic: { zh: 'Anthropic', en: 'Anthropic' },
    google: { zh: 'Google', en: 'Google' },
    meta: { zh: 'Meta', en: 'Meta' },
    deepseek: { zh: 'DeepSeek', en: 'DeepSeek' },
    mistral: { zh: 'Mistral', en: 'Mistral' },
    xai: { zh: 'xAI', en: 'xAI' },
    cohere: { zh: 'Cohere', en: 'Cohere' },
    amazon: { zh: 'Amazon', en: 'Amazon' },
    nvidia: { zh: 'NVIDIA', en: 'NVIDIA' },
    alibaba: { zh: '阿里', en: 'Alibaba' },
    qwen: { zh: '通义千问', en: 'Qwen' },
    baidu: { zh: '百度', en: 'Baidu' },
    zhipu: { zh: '智谱', en: 'Zhipu' },
    minimax: { zh: 'MiniMax', en: 'MiniMax' },
    xiaomi: { zh: '小米', en: 'Xiaomi' },
    moonshot: { zh: '月之暗面', en: 'Moonshot' },
    yi: { zh: '零一万物', en: 'Yi' },
    stepfun: { zh: '阶跃星辰', en: 'StepFun' },
    microsoft: { zh: '微软', en: 'Microsoft' },
};

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initElements();
    initTheme();
    initStyle();
    initI18n();
    initGitHubStar();
    initResponsive();
    initVersion();
    initMinChannelPriceToggle();
    initPriceUnitToggle();
    await loadData();
    initEventListeners();
});

function initElements() {
    elements.searchInput = document.getElementById('search-input');
    elements.rankingsBody = document.getElementById('rankings-body');
    elements.pagination = document.getElementById('pagination');
    elements.totalModels = document.getElementById('total-models');
    elements.rankedModels = document.getElementById('ranked-models');
    elements.avgIntelligence = document.getElementById('avg-intelligence');
    elements.lastUpdated = document.getElementById('last-updated');
    elements.formulaAvgNote = document.getElementById('formula-avg-note');
    elements.formulaDetail = document.getElementById('formula-detail');
    elements.modelModal = document.getElementById('model-modal');
    elements.modalBody = document.getElementById('modal-body');
    elements.podium = document.getElementById('podium');
    elements.podiumSection = document.getElementById('podium-section');
    elements.resultsCount = document.getElementById('results-count');
    elements.minChannelPriceToggle = document.getElementById('min-channel-price-toggle');
    elements.channelSummaryCount = document.getElementById('channel-summary-count');
    elements.channelSummaryBody = document.getElementById('channel-summary-body');
    elements.priceUnitToggle = document.getElementById('price-unit-toggle');
    elements.priceColumnHeader = document.querySelector('.col-price');
    elements.rankingsCards = document.getElementById('rankings-cards');
    elements.tableContainer = document.querySelector('.table-container');
}

function initResponsive() {
    const mq = window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`);
    state.isMobile = mq.matches;
    if (elements.lastUpdated && state.scoringMeta?.updated_at) {
        const formatted = formatStatUpdatedAt(new Date(state.scoringMeta.updated_at), window.i18n?.currentLang || 'zh');
        elements.lastUpdated.textContent = formatted.text;
        elements.lastUpdated.title = formatted.title;
    }
    mq.addEventListener('change', (e) => {
        state.isMobile = e.matches;
        if (elements.lastUpdated && state.scoringMeta?.updated_at) {
            const formatted = formatStatUpdatedAt(new Date(state.scoringMeta.updated_at), window.i18n?.currentLang || 'zh');
            elements.lastUpdated.textContent = formatted.text;
            elements.lastUpdated.title = formatted.title;
        }
        renderRankings();
    });
}

async function initVersion() {
    const versionLink = document.getElementById('app-version');
    if (!versionLink) return;

    const metaVersion = document.querySelector('meta[name="app-version"]')?.content;
    if (metaVersion) {
        versionLink.textContent = metaVersion;
    }

    try {
        const res = await fetch(`version.json?${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const label = data.build || data.commit;
        if (label) {
            versionLink.textContent = label;
        }
        if (data.commit) {
            versionLink.href = `https://github.com/${CONFIG.GITHUB_REPO}/commit/${data.commit}`;
        }
    } catch {
        // Keep meta fallback
    }
}

async function initGitHubStar() {
    const starLink = document.getElementById('github-star');
    const starCount = document.getElementById('star-count');
    if (!starLink || !CONFIG.GITHUB_REPO) return;

    starLink.href = `https://github.com/${CONFIG.GITHUB_REPO}`;

    const cacheKey = document.querySelector('meta[name="app-version"]')?.content || Date.now();

    try {
        const response = await fetch(`data/repo.json?v=${cacheKey}`);
        if (response.ok) {
            const data = await response.json();
            if (starCount && typeof data.stars === 'number') {
                starCount.textContent = formatStarCount(data.stars);
                return;
            }
        }
    } catch (error) {
        console.warn('Failed to load repo meta:', error);
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}`, {
            headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (starCount && typeof data.stargazers_count === 'number') {
            starCount.textContent = formatStarCount(data.stargazers_count);
        }
    } catch (error) {
        console.warn('Failed to load GitHub star count:', error);
    }
}

function formatStarCount(count) {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return String(count);
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const theme = savedTheme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        syncThemeColor();
    });
    syncThemeColor();
}

const STYLE_OPTIONS = ['spacex', 'editorial', 'classic', 'apple', 'eva'];

const STYLE_PAGES = {
    spacex: 'spacex.html',
    eva: 'eva.html',
    editorial: 'minimal.html',
    apple: 'apple.html',
};

function initStyle() {
    const saved = localStorage.getItem('ui-style');
    if (STYLE_PAGES[saved]) {
        window.location.replace(STYLE_PAGES[saved]);
        return;
    }
    const style = STYLE_OPTIONS.includes(saved) ? saved : 'classic';
    if (STYLE_PAGES[style]) {
        window.location.replace(STYLE_PAGES[style]);
        return;
    }
    applyStyle(style);

    const select = document.getElementById('style-select');
    if (!select) return;
    select.value = style;
    select.addEventListener('change', () => {
        const next = select.value;
        if (STYLE_PAGES[next]) {
            localStorage.setItem('ui-style', next);
            window.location.href = STYLE_PAGES[next];
            return;
        }
        applyStyle(next);
        localStorage.setItem('ui-style', next);
        syncThemeColor();
    });
}

function applyStyle(style) {
    const next = STYLE_OPTIONS.includes(style) ? style : 'classic';
    document.documentElement.setAttribute('data-style', next);
    const select = document.getElementById('style-select');
    if (select && select.value !== next) select.value = next;
}

function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const style = document.documentElement.getAttribute('data-style') || 'classic';
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const colors = {
        spacex: { dark: '#000000', light: '#f0f0fa' },
        editorial: { dark: '#0a0a0b', light: '#f7f7f8' },
        classic: { dark: '#0b0f19', light: '#f8fafc' },
        apple: { dark: '#000000', light: '#f5f5f7' },
        eva: { dark: '#0a0612', light: '#f2ebe3' },
    };
    meta.content = colors[style]?.[theme] || '#0b0f19';
}

function initMinChannelPriceToggle() {
    const toggle = elements.minChannelPriceToggle;
    if (!toggle) return;

    state.useMinChannelPrice = localStorage.getItem(MIN_CHANNEL_PRICE_KEY) === '1';
    toggle.checked = state.useMinChannelPrice;
    toggle.addEventListener('change', () => {
        state.useMinChannelPrice = toggle.checked;
        localStorage.setItem(MIN_CHANNEL_PRICE_KEY, toggle.checked ? '1' : '0');
        filterAndSort();
    });
}

function initPriceUnitToggle() {
    const group = elements.priceUnitToggle;
    if (!group) return;

    const saved = localStorage.getItem(PRICE_UNIT_KEY);
    state.priceUnit = saved === 'M' ? 'M' : '100M';

    group.querySelectorAll('.price-unit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const unit = btn.dataset.unit;
            if (!unit || unit === state.priceUnit) return;
            state.priceUnit = unit;
            localStorage.setItem(PRICE_UNIT_KEY, unit);
            refreshPriceUnitUI();
        });
    });

    updatePriceUnitButtons();
    updatePriceColumnHeader();
}

function getPriceUnitScale() {
    return state.priceUnit === 'M' ? 1 : 100;
}

function getPriceUnitSuffix() {
    const key = state.priceUnit === 'M' ? 'price_unit_m' : 'price_unit_100m';
    return window.i18n?.t(key) || (state.priceUnit === 'M' ? '/M' : '/100M');
}

function getPriceUnitChartAxisLabel(short = false) {
    const isLarge = state.priceUnit !== 'M';
    const minChannel = state.useMinChannelPrice;
    let key;
    if (minChannel) {
        key = short
            ? (isLarge ? 'pareto_axis_price_min_short_100m' : 'pareto_axis_price_min_short_m')
            : (isLarge ? 'pareto_axis_price_min_100m' : 'pareto_axis_price_min_m');
    } else {
        key = short
            ? (isLarge ? 'pareto_axis_price_short_100m' : 'pareto_axis_price_short_m')
            : (isLarge ? 'pareto_axis_price_100m' : 'pareto_axis_price_m');
    }
    return window.i18n?.t(key) || (short ? 'Price' : 'Blended price');
}

function formatScaledMoney(amount, currency) {
    const value = Number(amount);
    if (Number.isNaN(value)) return '-';
    if (currency === 'cny') {
        if (value >= 100) return `¥${value.toFixed(1)}`;
        if (value >= 1) return `¥${value.toFixed(2)}`;
        return `¥${value.toFixed(3)}`;
    }
    if (value < 1) return `$${value.toFixed(2)}`;
    if (value < 10) return `$${value.toFixed(1)}`;
    return `$${Math.round(value)}`;
}

function updatePriceUnitButtons() {
    if (!elements.priceUnitToggle) return;
    elements.priceUnitToggle.setAttribute('aria-label', window.i18n.t('price_unit_group_label'));
    elements.priceUnitToggle.querySelectorAll('.price-unit-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.unit === state.priceUnit);
    });
}

function updatePriceColumnHeader() {
    if (!elements.priceColumnHeader) return;
    const label = window.i18n.t('th_price');
    const unit = getPriceUnitSuffix();
    elements.priceColumnHeader.textContent = `${label} (${unit.replace(/^\//, '')})`;
}

function refreshPriceUnitUI() {
    updatePriceUnitButtons();
    updatePriceColumnHeader();
    renderRankings();
    renderPodium();
    refreshParetoChart();
    const modelId = elements.modelModal?.dataset?.currentModel;
    if (modelId && !elements.modelModal?.classList.contains('hidden')) {
        showModelDetail(modelId);
    }
}

// i18n
function initI18n() {
    window.i18n.init();
    window.i18n.onLangChange(() => {
        renderPodium();
        renderRankings();
        updateStats();
        updateScoringDisplay();
        updateResultsCount();
        renderChannelSummary();
        updatePriceUnitButtons();
        updatePriceColumnHeader();
        window.ParetoChart?.refreshI18n?.();
        const modelId = elements.modelModal?.dataset?.currentModel;
        if (modelId && !elements.modelModal?.classList.contains('hidden')) {
            showModelDetail(modelId);
        }
    });
}

// Load Data
async function loadData() {
    try {
        const cacheKey = document.querySelector('meta[name="app-version"]')?.content || Date.now();
        const [modelsRes, plansRes] = await Promise.all([
            fetch(`${CONFIG.DATA_URL}?v=${cacheKey}`),
            fetch(`${CONFIG.SUPPLIER_PLANS_URL}?v=${cacheKey}`),
        ]);
        if (!modelsRes.ok) throw new Error('Data fetch failed');
        const data = await modelsRes.json();

        state.models = data.models || [];
        state.filteredModels = [...state.models];
        state.rankComparedTo = data.rank_compared_to || null;
        state.scoringMeta = {
            total_models: data.total_models,
            ranked_models: data.ranked_models,
            updated_at: data.updated_at,
            avg_intelligence: data.avg_intelligence,
            avg_intelligence_count: data.avg_intelligence_count,
        };

        if (plansRes.ok) {
            const plansData = await plansRes.json();
            state.supplierPlansByModel = plansData.by_model || {};
            state.supplierMethodology = plansData.methodology || null;
            state.channelStats = buildChannelStats(plansData);
        } else {
            state.supplierPlansByModel = {};
            state.supplierMethodology = null;
            state.channelStats = null;
        }

        updateStats();
        updateScoringDisplay();
        populateProviders();
        renderChannelSummary();
        filterAndSort();
    } catch (error) {
        console.error('Error loading data:', error);
        elements.rankingsBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 2rem; color: var(--danger);">
                    ${window.i18n.t('data_error')}
                </td>
            </tr>
        `;
    }
}

function updateStats(data) {
    const meta = data || state.scoringMeta;
    if (!meta) return;

    if (elements.totalModels) {
        elements.totalModels.textContent = meta.total_models ?? state.models.length;
    }
    if (elements.rankedModels) {
        elements.rankedModels.textContent = meta.ranked_models ?? state.models.filter(m => m.rank).length;
    }
    if (elements.lastUpdated && meta.updated_at) {
        const date = new Date(meta.updated_at);
        const formatted = formatStatUpdatedAt(date, window.i18n.currentLang);
        elements.lastUpdated.textContent = formatted.text;
        elements.lastUpdated.title = formatted.title;
    }
}

function formatStatUpdatedAt(date, lang) {
    const isZh = lang === 'zh';
    const locale = isZh ? 'zh-CN' : 'en-US';
    const full = date.toLocaleDateString(locale);
    const compact = window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`).matches;

    if (compact) {
        return {
            text: date.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' }),
            title: full,
        };
    }

    return { text: full, title: '' };
}

function resolveAvgIntelligence(meta) {
    if (meta?.avg_intelligence != null) {
        return {
            avg: meta.avg_intelligence,
            count: meta.avg_intelligence_count,
        };
    }

    const scores = state.models
        .map(m => m.intelligence_score)
        .filter(score => score != null);
    if (!scores.length) return null;

    return {
        avg: scores.reduce((sum, score) => sum + score, 0) / scores.length,
        count: scores.length,
    };
}

function formatAvg(value) {
    return Number(value).toFixed(1);
}

function updateScoringDisplay() {
    const resolved = resolveAvgIntelligence(state.scoringMeta);
    if (!resolved) {
        if (elements.avgIntelligence) elements.avgIntelligence.textContent = '—';
        if (elements.formulaAvgNote) elements.formulaAvgNote.textContent = '—';
        if (elements.formulaDetail) elements.formulaDetail.textContent = '—';
        return;
    }

    const { avg, count } = resolved;
    const avgText = formatAvg(avg);
    const lang = window.i18n.currentLang;

    if (elements.avgIntelligence) {
        elements.avgIntelligence.textContent = avgText;
    }
    if (elements.formulaAvgNote) {
        elements.formulaAvgNote.textContent = lang === 'zh'
            ? `当前能力均分 ${avgText}（${count} 个模型，每日自动更新）`
            : `Current intelligence avg: ${avgText} (${count} models, updated daily)`;
    }
    if (elements.formulaDetail) {
        elements.formulaDetail.textContent = lang === 'zh'
            ? `f(x)=(${avgText}+(x-${avgText})²)²（x≥${avgText}）；f(x)=(${avgText}-(${avgText}-x)²)²（x<${avgText}，内层≤0排除）`
            : `f(x)=(${avgText}+(x-${avgText})²)² if x≥${avgText}; f(x)=(${avgText}-(${avgText}-x)²)² if x<${avgText} (excluded when inner ≤0)`;
    }
}

function populateProviders() {
    // Skip if provider filter element doesn't exist
    if (!elements.providerFilter) return;
    
    const providers = new Set();
    state.models.forEach(m => providers.add(m.provider));
    
    const lang = window.i18n.currentLang;
    elements.providerFilter.innerHTML = `<option value="">${window.i18n.t('all_providers')}</option>`;
    
    [...providers].sort().forEach(provider => {
        const name = PROVIDER_NAMES[provider]?.[lang] || provider;
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = name;
        elements.providerFilter.appendChild(option);
    });
}

// Filter and Sort
function filterAndSort() {
    let filtered = state.models.filter(m => m.rank != null);
    
    // Search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(m => 
            m.name.toLowerCase().includes(query) ||
            m.id.toLowerCase().includes(query)
        );
    }
    
    // Sort by value score (OpenRouter) or lowest channel price
    if (state.useMinChannelPrice) {
        filtered.sort((a, b) => getAdjustedRawValueScore(b) - getAdjustedRawValueScore(a));
        const maxScore = Math.max(...filtered.map(getAdjustedRawValueScore), 0);
        filtered.forEach((model, index) => {
            model.displayRank = index + 1;
            const raw = getAdjustedRawValueScore(model);
            model.displayValueScore = maxScore > 0
                ? Math.round((raw / maxScore * 100) * 10) / 10
                : null;
        });
    } else {
        filtered.sort((a, b) => (b.value_score || 0) - (a.value_score || 0));
    }
    
    state.filteredModels = filtered;
    state.currentPage = 1;
    updateResultsCount();
    renderRankings();
    renderPodium();
    refreshParetoChart();
}

function refreshParetoChart() {
    try {
        window.ParetoChart?.render?.(state.models, { useMinChannelPrice: state.useMinChannelPrice });
    } catch (err) {
        console.error('Pareto chart render failed:', err);
    }
}

function updateResultsCount() {
    if (!elements.resultsCount) return;
    const count = state.filteredModels.length;
    elements.resultsCount.textContent = window.i18n.t('results_count').replace('{count}', count);
}

function buildChannelStats(plansData) {
    const plans = plansData?.plans || [];
    const byProvider = new Map();

    for (const plan of plans) {
        const key = plan.provider;
        if (!byProvider.has(key)) {
            byProvider.set(key, {
                provider: key,
                display: plan.provider_display || key,
                count: 1,
                url: plan.url || null,
            });
        } else {
            byProvider.get(key).count += 1;
        }
    }

    const providers = CHANNEL_PROVIDER_ORDER
        .filter((key) => byProvider.has(key))
        .map((key) => byProvider.get(key));

    providers.push({
        provider: 'openrouter',
        display: 'OpenRouter',
        count: null,
        url: 'https://openrouter.ai',
    });

    return {
        providers,
        totalChannels: providers.length,
        totalPlans: plansData?.total_plans ?? plans.length,
        modelsCovered: Object.keys(plansData?.by_model || {}).length,
    };
}

function renderChannelSummary() {
    if (!elements.channelSummaryBody) return;

    const stats = state.channelStats;
    if (!stats) {
        if (elements.channelSummaryCount) elements.channelSummaryCount.textContent = '';
        elements.channelSummaryBody.innerHTML = '';
        return;
    }

    if (elements.channelSummaryCount) {
        elements.channelSummaryCount.textContent = `(${stats.totalChannels})`;
    }

    const statsLine = window.i18n.t('channel_summary_stats')
        .replace('{channels}', stats.totalChannels)
        .replace('{plans}', stats.totalPlans)
        .replace('{models}', stats.modelsCovered);

    const listHtml = stats.providers.map((entry) => {
        const meta = entry.count == null
            ? ''
            : window.i18n.t('channel_plan_count').replace('{count}', entry.count);
        const nameHtml = entry.url
            ? `<a href="${escapeAttr(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.display)}</a>`
            : escapeHtml(entry.display);
        const metaHtml = meta
            ? `<span class="channel-summary-meta">${escapeHtml(meta)}</span>`
            : '';
        return `
            <li class="channel-summary-item">
                <span class="channel-summary-name">${nameHtml}</span>
                ${metaHtml}
            </li>
        `;
    }).join('');

    elements.channelSummaryBody.innerHTML = `
        <p class="channel-summary-stats">${escapeHtml(statsLine)}</p>
        <ul class="channel-summary-list">${listHtml}</ul>
    `;
}

function formatValueScore(score) {
    if (score == null) return '-';
    const n = Number(score);
    if (Number.isNaN(n)) return '-';
    return n.toFixed(1);
}

function formatPrice(usd) {
    if (usd == null || Number.isNaN(Number(usd))) return '-';
    const suffix = getPriceUnitSuffix();
    if (window.i18n.currentLang === 'zh') {
        const cny = Number(usd) * CONFIG.USD_TO_CNY * getPriceUnitScale();
        return `${formatScaledMoney(cny, 'cny')}${suffix}`;
    }
    const price = Number(usd) * getPriceUnitScale();
    return `${formatScaledMoney(price, 'usd')}${suffix}`;
}

function getOpenRouterModelUrl(modelId) {
    return `https://openrouter.ai/${modelId}`;
}

function formatLatency(seconds) {
    if (seconds == null || Number.isNaN(Number(seconds)) || Number(seconds) <= 0) return '-';
    const value = Number(seconds);
    if (value < 1) return `${Math.round(value * 1000)} ms`;
    return `${value.toFixed(2)} s`;
}

function formatSpeed(speed) {
    if (speed == null || Number.isNaN(Number(speed))) return '-';
    return `${Math.round(Number(speed))} tok/s`;
}

const PODIUM_MEDALS = ['#1', '#2', '#3'];

function renderPodium() {
    if (!elements.podium || !elements.podiumSection) return;

    const top3 = state.useMinChannelPrice
        ? state.filteredModels.filter((m) => m.displayRank && m.displayRank <= 3)
        : state.models
            .filter((m) => m.rank && m.rank <= 3 && m.value_score != null)
            .sort((a, b) => a.rank - b.rank);

    if (top3.length === 0) {
        elements.podiumSection.hidden = true;
        return;
    }

    elements.podiumSection.hidden = false;
    elements.podium.innerHTML = top3.map((model) => {
        const rank = getDisplayRank(model);
        const rankClass = `podium-place-${rank}`;
        const medal = PODIUM_MEDALS[rank - 1] || `#${rank}`;
        const displayPrice = getDisplayPriceUsd(model);
        return `
            <div class="podium-card ${rankClass} fade-in" data-model-id="${escapeAttr(model.id)}">
                <div class="podium-medal-wrap">
                    <span class="podium-medal">${medal}</span>
                </div>
                <div class="podium-rank">${formatRankChangeHtml(model, true)}</div>
                <div class="podium-name">${escapeHtml(model.name)}</div>
                <div class="podium-provider">${escapeHtml(model.provider_display || model.provider)}</div>
                <div class="podium-metrics">
                    <div class="podium-metric">
                        <span class="podium-metric-value">${model.intelligence_score || '-'}</span>
                        <span class="podium-metric-label">${window.i18n.t('podium_intelligence')}</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-value">${formatSpeed(model.speed)}</span>
                        <span class="podium-metric-label">${window.i18n.t('podium_speed')}</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-value">${formatPrice(displayPrice)}</span>
                        <span class="podium-metric-label">${window.i18n.t('podium_price')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render rankings (table on desktop, cards on mobile)
function renderRankings() {
    if (state.isMobile) {
        renderMobileCards();
    } else {
        renderTable();
    }
}

function formatRankChangeHtml(model, inline = false) {
    const text = formatRankChangeText(model);
    let className = 'rank-change-none';
    if (model.rank_new) className = 'rank-change-new';
    else if (model.rank_change > 0) className = 'rank-change-up';
    else if (model.rank_change < 0) className = 'rank-change-down';
    else if (model.rank_change === 0) className = 'rank-change-flat';
    return `<span class="rank-change ${className}${inline ? ' rank-change-inline' : ''}">${text}</span>`;
}

function formatRankChangeText(model) {
    if (model.rank_new) return window.i18n.t('rank_new');
    if (model.rank_change === null || model.rank_change === undefined) return '—';
    if (model.rank_change === 0) return '—';
    if (model.rank_change > 0) return `↑${model.rank_change}`;
    return `↓${Math.abs(model.rank_change)}`;
}

function supplierCostMinValue(cost) {
    if (cost == null || Number.isNaN(Number(cost))) return Infinity;
    if (Array.isArray(cost)) {
        const low = Number(cost[0]);
        const high = Number(cost[1]);
        if (Number.isNaN(low)) return high;
        if (Number.isNaN(high)) return low;
        return Math.min(low, high);
    }
    return Number(cost);
}

function supplierCostSortValue(cost) {
    return supplierCostMinValue(cost);
}

function buildSupplierEntries(modelId, model) {
    const modelObj = model || state.models.find((m) => m.id === modelId);
    const entries = [...(state.supplierPlansByModel[modelId] || [])];
    const openRouter = modelObj ? buildOpenRouterSupplierEntry(modelObj) : null;
    if (openRouter && !entries.some((e) => e.provider === 'openrouter')) {
        entries.push(openRouter);
    }
    return entries;
}

function getMinChannelPriceCny(model) {
    if (!model) return null;
    const costs = buildSupplierEntries(model.id, model)
        .map((entry) => supplierCostMinValue(entry.cost))
        .filter((cost) => Number.isFinite(cost));
    return costs.length ? Math.min(...costs) : null;
}

function getMinChannelPriceUsd(model) {
    const cny = getMinChannelPriceCny(model);
    if (cny == null) return model?.pricing?.blended ?? null;
    return cny / CONFIG.USD_TO_CNY;
}

function getDisplayPriceUsd(model) {
    if (!state.useMinChannelPrice) return model.pricing?.blended;
    return getMinChannelPriceUsd(model);
}

function formatSupplierChannelLabel(entry) {
    if (!entry) return null;
    return [entry.provider_display, entry.plan].filter(Boolean).join(' · ');
}

function getCheapestSupplierEntry(model) {
    if (!model) return null;
    const entries = buildSupplierEntries(model.id, model);
    if (!entries.length) return null;

    let best = null;
    let bestCost = Infinity;
    for (const entry of entries) {
        const cost = supplierCostMinValue(entry.cost);
        if (cost < bestCost) {
            best = entry;
            bestCost = cost;
        }
    }
    return best;
}

function getChartPriceSupplierShortLabel(model, useMinChannelPrice = state.useMinChannelPrice) {
    if (!useMinChannelPrice || !model) return null;
    const cheapest = getCheapestSupplierEntry(model);
    return cheapest?.provider_display || formatSupplierChannelLabel(cheapest);
}

function getChartPriceSupplierLabel(model, useMinChannelPrice = state.useMinChannelPrice) {
    if (!model) return null;

    if (useMinChannelPrice) {
        const cheapest = getCheapestSupplierEntry(model);
        if (cheapest) return formatSupplierChannelLabel(cheapest);
    }

    const openRouter = buildOpenRouterSupplierEntry(model);
    if (openRouter) return formatSupplierChannelLabel(openRouter);

    return model.pricing?.pricing_source || 'OpenRouter';
}

function getAdjustedRawValueScore(model) {
    if (!model?.value_score) return 0;
    if (!state.useMinChannelPrice) return model.value_score;

    const blended = model.pricing?.blended;
    const minUsd = getMinChannelPriceUsd(model);
    if (!blended || !minUsd || minUsd <= 0) return model.value_score;
    return model.value_score * (blended / minUsd);
}

function getDisplayRank(model) {
    if (state.useMinChannelPrice) return model.displayRank ?? model.rank;
    return model.rank;
}

function getDisplayValueScore(model) {
    if (!state.useMinChannelPrice) return model.value_score || 0;
    return model.displayValueScore ?? model.value_score ?? 0;
}

function buildOpenRouterSupplierEntry(model) {
    const blendedUsd = model?.pricing?.blended;
    if (blendedUsd == null || Number.isNaN(Number(blendedUsd))) return null;
    const cost = Math.round(Number(blendedUsd) * CONFIG.USD_TO_CNY * 10000) / 10000;
    const sourceUrl = model.pricing.pricing_source_url || getOpenRouterModelUrl(model.id);
    return {
        id: 'openrouter-api',
        provider: 'openrouter',
        provider_display: 'OpenRouter',
        plan: window.i18n.t('supplier_openrouter_plan'),
        type: 'api',
        badge: null,
        cost,
        url: sourceUrl,
        pricing_source: 'OpenRouter',
    };
}

function getSuppliersForModel(modelId, model) {
    const entries = buildSupplierEntries(modelId, model);
    entries.sort((a, b) => supplierCostSortValue(a.cost) - supplierCostSortValue(b.cost));
    return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function formatCnyPerM(cny) {
    if (cny == null || Number.isNaN(Number(cny))) return '-';
    const suffix = getPriceUnitSuffix();
    return `${formatScaledMoney(Number(cny) * getPriceUnitScale(), 'cny')}${suffix}`;
}

function formatSupplierCost(value) {
    if (value == null) return '<span class="supplier-cost-dash">—</span>';
    if (window.i18n.currentLang !== 'zh') {
        const suffix = getPriceUnitSuffix();
        const formatUsd = (cny) => {
            const usd = (Number(cny) / CONFIG.USD_TO_CNY) * getPriceUnitScale();
            if (Number.isNaN(usd)) return '-';
            return `${formatScaledMoney(usd, 'usd')}${suffix}`;
        };
        if (Array.isArray(value)) {
            return `<span class="supplier-cost">≈${formatUsd(value[0])}–${formatUsd(value[1])}</span>`;
        }
        return `<span class="supplier-cost">≈${formatUsd(value)}</span>`;
    }
    if (Array.isArray(value)) {
        return `<span class="supplier-cost">≈${formatCnyPerM(value[0])}–${formatCnyPerM(value[1])}</span>`;
    }
    return `<span class="supplier-cost">≈${formatCnyPerM(value)}</span>`;
}

function getPageModels() {
    const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    return state.filteredModels.slice(start, end);
}

function renderMobileCards() {
    if (!elements.rankingsCards) return;

    if (elements.tableContainer) {
        elements.tableContainer.hidden = true;
    }
    elements.rankingsCards.hidden = false;

    const pageModels = getPageModels();

    if (pageModels.length === 0) {
        elements.rankingsCards.innerHTML = `
            <div class="mobile-empty">${window.i18n.t('no_results')}</div>
        `;
        elements.pagination.innerHTML = '';
        return;
    }

    elements.rankingsCards.innerHTML = pageModels.map((model, idx) => {
        const rank = getDisplayRank(model) || '-';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const intelClass = getIntelligenceClass(model.intelligence_score);
        const displayPrice = getDisplayPriceUsd(model);
        const priceClass = getPriceClass(displayPrice);
        const valueScore = getDisplayValueScore(model);

        return `
            <article class="model-card fade-in" style="animation-delay: ${idx * 30}ms" data-model-id="${escapeAttr(model.id)}">
                <div class="model-card-top">
                    <span class="rank-badge ${rankClass}">${rank}</span>
                    <div class="model-card-info">
                        <div class="model-card-title-row">
                            <h4 class="model-card-name">${escapeHtml(model.name)}</h4>
                            <span class="value-score model-card-value">${formatValueScore(valueScore)}</span>
                        </div>
                        <div class="model-card-sub">
                            <span class="provider-badge">${escapeHtml(model.provider_display || model.provider)}</span>
                            ${formatRankChangeHtml(model, true)}
                        </div>
                    </div>
                </div>
                <div class="model-card-stats">
                    <span class="model-card-stat">
                        <em>${window.i18n.t('th_intelligence')}</em>
                        <strong class="intelligence-score ${intelClass}">${model.intelligence_score || '-'}</strong>
                    </span>
                    <span class="model-card-stat">
                        <em>${window.i18n.t('th_speed')}</em>
                        <strong class="speed-display">${formatSpeed(model.speed)}</strong>
                    </span>
                    <span class="model-card-stat">
                        <em>${window.i18n.t('th_ttft')}</em>
                        <strong class="latency-display">${formatLatency(model.ttft)}</strong>
                    </span>
                    <span class="model-card-stat">
                        <em>${window.i18n.t('th_price')}</em>
                        <strong class="price-display ${priceClass}">${formatPrice(displayPrice)}</strong>
                    </span>
                </div>
                <p class="model-card-hint">${window.i18n.t('card_tap_hint')}</p>
            </article>
        `;
    }).join('');

    renderPagination();
}

// Render Table
function renderTable() {
    if (elements.rankingsCards) {
        elements.rankingsCards.hidden = true;
    }
    if (elements.tableContainer) {
        elements.tableContainer.hidden = false;
    }

    const pageModels = getPageModels();
    
    if (pageModels.length === 0) {
        elements.rankingsBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    ${window.i18n.t('no_results')}
                </td>
            </tr>
        `;
        elements.pagination.innerHTML = '';
        return;
    }
    
    // Find max value for bar scaling
    const maxValue = Math.max(...state.filteredModels.map((m) => getDisplayValueScore(m) || 0));
    
    elements.rankingsBody.innerHTML = pageModels.map((model, idx) => {
        const rank = getDisplayRank(model) || '-';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const providerName = model.provider_display || model.provider;
        
        const intelScore = model.intelligence_score || '-';
        const intelClass = getIntelligenceClass(model.intelligence_score);
        
        const speed = formatSpeed(model.speed);
        const ttft = formatLatency(model.ttft);
        
        const price = getDisplayPriceUsd(model);
        const priceClass = getPriceClass(price);
        
        const valueScore = getDisplayValueScore(model);
        const valueBarWidth = maxValue > 0 ? (valueScore / maxValue * 100) : 0;
        const topRowClass = rank <= 3 ? 'top-row' : '';

        return `
            <tr class="fade-in model-main-row ${topRowClass}" style="animation-delay: ${idx * 30}ms" data-model-id="${escapeAttr(model.id)}">
                <td class="col-rank">
                    <span class="rank-badge ${rankClass}">${rank}</span>
                </td>
                <td class="col-change">
                    ${formatRankChangeHtml(model)}
                </td>
                <td class="col-model">
                    <div class="model-info">
                        <span class="model-name">${escapeHtml(model.name)}</span>
                        <span class="model-id">${escapeHtml(model.id)}</span>
                    </div>
                </td>
                <td class="col-provider">
                    <span class="provider-badge">${providerName}</span>
                </td>
                <td class="col-intelligence">
                    <span class="intelligence-score ${intelClass}">${intelScore}</span>
                </td>
                <td class="col-speed">
                    <span class="speed-display">${speed}</span>
                </td>
                <td class="col-ttft">
                    <span class="latency-display">${ttft}</span>
                </td>
                <td class="col-price">
                    <span class="price-display ${priceClass}">${formatPrice(price)}</span>
                </td>
                <td class="col-value">
                    <span class="value-score">${formatValueScore(valueScore)}</span>
                    <div class="value-bar">
                        <div class="value-bar-fill" style="width: ${valueBarWidth}%"></div>
                    </div>
                </td>
                <td class="col-detail">
                    <button type="button" class="btn-detail" data-model-id="${escapeAttr(model.id)}">${window.i18n.t('th_detail')}</button>
                </td>
            </tr>
        `;
    }).join('');
    
    renderPagination();
}

function getIntelligenceClass(score) {
    if (!score) return '';
    if (score >= 60) return 'intelligence-high';
    if (score >= 40) return 'intelligence-medium';
    return 'intelligence-low';
}

function getPriceClass(price) {
    if (price < 1) return 'price-budget';
    if (price < 5) return 'price-mid';
    if (price < 20) return 'price-premium';
    return 'price-enterprise';
}

function renderPagination() {
    const totalPages = Math.ceil(state.filteredModels.length / CONFIG.ITEMS_PER_PAGE);
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    const maxVisible = 7;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    // Previous button
    if (state.currentPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(${state.currentPage - 1})">‹</button>`;
    }
    
    // First page
    if (startPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="page-ellipsis">…</span>`;
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-ellipsis">…</span>`;
        html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    if (state.currentPage < totalPages) {
        html += `<button class="page-btn" onclick="goToPage(${state.currentPage + 1})">›</button>`;
    }
    
    elements.pagination.innerHTML = html;
}

// Navigation
function goToPage(page) {
    state.currentPage = page;
    renderRankings();
    document.querySelector('.rankings').scrollIntoView({ behavior: 'smooth' });
}

// Model Detail
function showModelDetail(modelId) {
    const model = state.models.find(m => m.id === modelId);
    if (!model || !model.pricing) return;

    const lang = window.i18n.currentLang;
    const providerName = PROVIDER_NAMES[model.provider]?.[lang] || model.provider;
    const providerDisplay = model.provider_display || providerName;
    const rank = getDisplayRank(model) || '-';
    const rankClass = rank <= 3 ? `detail-rank-${rank}` : '';
    const intelClass = getIntelligenceClass(model.intelligence_score);
    const displayPrice = getDisplayPriceUsd(model);
    const priceClass = getPriceClass(displayPrice);
    const medal = rank <= 3 ? PODIUM_MEDALS[rank - 1] : `#${rank}`;
    const displayValueScore = getDisplayValueScore(model);
    const listBlended = model.pricing.blended_list;
    const showListPrice = listBlended != null && listBlended !== model.pricing.blended;
    const openRouterUrl = getOpenRouterModelUrl(model.id);
    const pricingChannel = model.pricing.pricing_source || 'OpenRouter';
    const pricingChannelUrl = model.pricing.pricing_source_url || openRouterUrl;
    const isOfficialChannel = pricingChannel !== 'OpenRouter';
    const channelClass = isOfficialChannel ? 'pricing-channel-official' : 'pricing-channel-openrouter';
    const pricingChannelHtml = `
                <div class="detail-item detail-item-channel">
                    <span class="detail-label">${window.i18n.t('pricing_channel')}</span>
                    <span class="detail-value">
                        <a class="pricing-channel-link ${channelClass}" href="${escapeAttr(pricingChannelUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pricingChannel)}</a>
                    </span>
                </div>`;
    const cacheReadHtml = model.pricing.cache_read != null ? `
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('cache_read_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(model.pricing.cache_read)}</span>
                </div>` : '';
    const listPriceHtml = showListPrice ? `
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('list_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(listBlended)}</span>
                </div>` : '';
    const cacheNoteHtml = model.pricing.agent_token_mix ? `
            <p class="detail-pricing-note">${window.i18n.t('cache_hit_note')}</p>` : '';
    const officialChannelNoteHtml = isOfficialChannel ? `
            <p class="detail-pricing-note">${window.i18n.t('pricing_source_note', { source: pricingChannel })}</p>` : '';
    const tod = model.pricing.tod;
    const hasTodPricing = tod && tod.scheme === 'peak_off_peak';
    const todPriceHtml = hasTodPricing ? `
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('peak_blended_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(tod.peak && tod.peak.blended)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('off_peak_blended_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(tod.off_peak && tod.off_peak.blended)}</span>
                </div>` : '';
    const todNoteHtml = hasTodPricing ? `
            <p class="detail-pricing-note">${window.i18n.t('pricing_tod_note')}</p>` : '';
    const suppliers = getSuppliersForModel(modelId, model);
    const minChannelNoteHtml = state.useMinChannelPrice ? `
            <p class="detail-pricing-note">${window.i18n.t('min_channel_price_note')}</p>` : '';
    const supplierSectionHtml = suppliers.length ? `
        <div class="detail-section">
            <h3 class="detail-section-title">${window.i18n.t('supplier_pricing_title')}</h3>
            ${minChannelNoteHtml}
            <div class="supplier-pricing-block supplier-pricing-modal">
                <table class="supplier-pricing-table">
                    <thead>
                        <tr>
                            <th>${window.i18n.t('supplier_th_rank')}</th>
                            <th>${window.i18n.t('supplier_th_channel')}</th>
                            <th>${window.i18n.t('supplier_th_price')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${suppliers.map((entry) => {
                            const label = [entry.provider_display, entry.plan].filter(Boolean).join(' · ');
                            const badge = entry.badge ? `<span class="supplier-badge">${escapeHtml(entry.badge)}</span>` : '';
                            const link = entry.url
                                ? `<a class="supplier-pricing-link" href="${escapeAttr(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(window.i18n.t('supplier_visit'))}</a>`
                                : '';
                            return `
                                <tr class="supplier-pricing-row${entry.rank === 1 ? ' supplier-rank-best' : ''}">
                                    <td class="supplier-col-rank">${entry.rank}</td>
                                    <td class="supplier-col-channel"><span class="supplier-channel-name">${escapeHtml(label)}</span>${badge}</td>
                                    <td class="supplier-col-price">${formatSupplierCost(entry.cost)}</td>
                                    <td class="supplier-col-link">${link}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : '';

    elements.modalBody.innerHTML = `
        <div class="model-detail-hero ${rankClass}">
            <div class="model-detail-hero-main">
                <div class="model-detail-rank-badge"><span>${medal}</span></div>
                <div class="model-detail-identity">
                    <div class="model-detail-titles">
                        <h2 class="model-detail-name">${escapeHtml(model.name)}</h2>
                        <a class="model-detail-id" href="${escapeAttr(openRouterUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(model.id)}</a>
                        <span class="provider-badge">${escapeHtml(providerDisplay)}</span>
                    </div>
                </div>
            </div>
            <div class="model-detail-value-chip">
                <span class="detail-chip-label">${window.i18n.t('th_value')}</span>
                <span class="detail-chip-value">${formatValueScore(displayValueScore)}</span>
                ${formatRankChangeHtml(model, true)}
            </div>
        </div>

        <div class="model-detail-actions">
            <a class="btn-openrouter" href="${escapeAttr(openRouterUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(window.i18n.t('openrouter_link_aria'))}">
                <svg class="openrouter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                <span>${window.i18n.t('openrouter_link')}</span>
            </a>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">${window.i18n.t('detail_metrics')}</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('th_intelligence')}</span>
                    <span class="detail-value ${intelClass}">${model.intelligence_score || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('th_speed')}</span>
                    <span class="detail-value speed-display">${formatSpeed(model.speed)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('th_ttft')}</span>
                    <span class="detail-value latency-display">${formatLatency(model.ttft)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('context_window')}</span>
                    <span class="detail-value">${model.context_length ? (model.context_length / 1024) + 'K' : '-'}</span>
                </div>
                ${pricingChannelHtml}
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('input_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(model.pricing.prompt)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('output_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(model.pricing.completion)}</span>
                </div>
                ${cacheReadHtml}
                ${listPriceHtml}
                <div class="detail-item">
                    <span class="detail-label">${window.i18n.t('blended_price')}</span>
                    <span class="detail-value price-display ${priceClass}">${formatPrice(model.pricing.blended)}</span>
                </div>
                ${todPriceHtml}
                <div class="detail-item detail-item-accent">
                    <span class="detail-label">${window.i18n.t('th_change')}</span>
                    <span class="detail-value">${formatRankChangeHtml(model)}</span>
                </div>
                <div class="detail-item detail-item-accent">
                    <span class="detail-label">${window.i18n.t('value_rank')}</span>
                    <span class="detail-value detail-rank-value">#${rank}</span>
                </div>
            </div>
            ${cacheNoteHtml}
            ${officialChannelNoteHtml}
            ${todNoteHtml}
        </div>

        ${supplierSectionHtml}

        ${model.description ? `
        <div class="model-detail-desc">
            <h3 class="detail-section-title">${window.i18n.t('detail_about')}</h3>
            <p>${escapeHtml(model.description)}</p>
        </div>` : ''}
    `;

    elements.modelModal.dataset.currentModel = modelId;
    elements.modelModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

// Event Listeners
function initEventListeners() {
    // Search
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value;
            filterAndSort();
        }, 300));
    }
    
    // Modal close
    if (elements.modelModal) {
        elements.modelModal.querySelector('.modal-overlay')?.addEventListener('click', closeModal);
        elements.modelModal.querySelector('.modal-close')?.addEventListener('click', closeModal);
    }
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Model detail clicks via event delegation
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.btn-detail, .model-card, .podium-card');
        if (!trigger?.dataset.modelId) return;
        showModelDetail(trigger.dataset.modelId);
    });

    document.addEventListener('pareto-model-select', (e) => {
        if (e.detail?.modelId) showModelDetail(e.detail.modelId);
    });
}

function closeModal() {
    elements.modelModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// Utilities
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
}

// Make goToPage and showModelDetail global
window.goToPage = goToPage;
window.showModelDetail = showModelDetail;
window.getMinChannelPriceUsd = getMinChannelPriceUsd;
window.getAdjustedRawValueScore = getAdjustedRawValueScore;
window.getChartPriceSupplierLabel = getChartPriceSupplierLabel;
window.getChartPriceSupplierShortLabel = getChartPriceSupplierShortLabel;
window.getPriceUnitScale = getPriceUnitScale;
window.getPriceUnitSuffix = getPriceUnitSuffix;
window.getPriceUnitChartAxisLabel = getPriceUnitChartAxisLabel;
