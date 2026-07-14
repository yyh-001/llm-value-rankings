/**
 * LLM Value Rankings - Main Application
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
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
};

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
    elements.rankingsCards = document.getElementById('rankings-cards');
    elements.tableContainer = document.querySelector('.table-container');
}

function initResponsive() {
    const mq = window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`);
    state.isMobile = mq.matches;
    mq.addEventListener('change', (e) => {
        state.isMobile = e.matches;
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

// i18n
function initI18n() {
    window.i18n.init();
    window.i18n.onLangChange(() => {
        renderPodium();
        renderRankings();
        updateStats();
        updateScoringDisplay();
        updateResultsCount();
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
        const response = await fetch(`${CONFIG.DATA_URL}?v=${cacheKey}`);
        if (!response.ok) throw new Error('Data fetch failed');
        const data = await response.json();
        
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
        
        updateStats();
        updateScoringDisplay();
        populateProviders();
        renderPodium();
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
        const lang = window.i18n.currentLang;
        elements.lastUpdated.textContent = date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
    }
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
    
    // Sort by value score (capability²/price)
    filtered.sort((a, b) => (b.value_score || 0) - (a.value_score || 0));
    
    state.filteredModels = filtered;
    state.currentPage = 1;
    updateResultsCount();
    renderRankings();
}

function updateResultsCount() {
    if (!elements.resultsCount) return;
    const count = state.filteredModels.length;
    elements.resultsCount.textContent = window.i18n.t('results_count').replace('{count}', count);
}

function formatValueScore(score) {
    if (score == null) return '-';
    const n = Number(score);
    if (Number.isNaN(n)) return '-';
    return n.toFixed(1);
}

function formatPrice(usd) {
    if (usd == null || Number.isNaN(Number(usd))) return '-';
    const price = Number(usd);
    if (window.i18n.currentLang === 'zh') {
        const cny = price * CONFIG.USD_TO_CNY;
        if (cny >= 100) return `¥${cny.toFixed(1)}`;
        if (cny >= 1) return `¥${cny.toFixed(2)}`;
        return `¥${cny.toFixed(3)}`;
    }
    return `$${price.toFixed(2)}`;
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

    const top3 = state.models
        .filter(m => m.rank && m.rank <= 3 && m.value_score != null)
        .sort((a, b) => a.rank - b.rank);

    if (top3.length === 0) {
        elements.podiumSection.hidden = true;
        return;
    }

    elements.podiumSection.hidden = false;
    elements.podium.innerHTML = top3.map(model => {
        const rankClass = `podium-place-${model.rank}`;
        const medal = PODIUM_MEDALS[model.rank - 1] || `#${model.rank}`;
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
                        <span class="podium-metric-value">${formatPrice(model.pricing.blended)}</span>
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
        const rank = model.rank || '-';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const intelClass = getIntelligenceClass(model.intelligence_score);
        const priceClass = getPriceClass(model.pricing.blended);
        const valueScore = model.value_score || 0;

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
                        <strong class="price-display ${priceClass}">${formatPrice(model.pricing.blended)}</strong>
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
    const maxValue = Math.max(...state.filteredModels.map(m => m.value_score || 0));
    
    elements.rankingsBody.innerHTML = pageModels.map((model, idx) => {
        const rank = model.rank || '-';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const providerName = model.provider_display || model.provider;
        
        const intelScore = model.intelligence_score || '-';
        const intelClass = getIntelligenceClass(model.intelligence_score);
        
        const speed = formatSpeed(model.speed);
        const ttft = formatLatency(model.ttft);
        
        const price = model.pricing.blended;
        const priceClass = getPriceClass(price);
        
        const valueScore = model.value_score || 0;
        const valueBarWidth = maxValue > 0 ? (valueScore / maxValue * 100) : 0;
        const topRowClass = rank <= 3 ? 'top-row' : '';
        
        return `
            <tr class="fade-in ${topRowClass}" style="animation-delay: ${idx * 30}ms" data-model-id="${escapeAttr(model.id)}">
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
    const rank = model.rank || '-';
    const rankClass = rank <= 3 ? `detail-rank-${rank}` : '';
    const intelClass = getIntelligenceClass(model.intelligence_score);
    const priceClass = getPriceClass(model.pricing.blended);
    const medal = rank <= 3 ? PODIUM_MEDALS[rank - 1] : `#${rank}`;
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
    const cacheNoteHtml = model.pricing.cache_hit_rate != null ? `
            <p class="detail-pricing-note">${window.i18n.t('cache_hit_note')}</p>` : '';
    const officialChannelNoteHtml = isOfficialChannel ? `
            <p class="detail-pricing-note">${window.i18n.t('pricing_source_note', { source: pricingChannel })}</p>` : '';

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
                <span class="detail-chip-value">${formatValueScore(model.value_score)}</span>
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
        </div>

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
