/**
 * LLM Value Rankings - Main Application
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
    ITEMS_PER_PAGE: 20,
    GITHUB_REPO: 'yyh-001/llm-value-rankings',
    MOBILE_BREAKPOINT: 768,
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
};

// Provider logos (SVG data URIs for reliability)
const PROVIDER_LOGOS = {
    openai: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzEwYTM0ZiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDEgMC04LTMuNTktOC04czMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4eiIvPjxwYXRoIGZpbGw9IiMxMGEzNGYiIGQ9Ik0xMiA2Yy0zLjMxIDAtNiAyLjY5LTYgNnMyLjY5IDYgNiA2IDYtMi42OSA2LTYtMi42OS02LTYtNnoiLz48L3N2Zz4=',
    anthropic: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZDUwMDAwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPkE8L3RleHQ+PC9zdmc+',
    google: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTEyIDI0YzYuNjIgMCAxMi01LjM4IDEyLTEyUzE4LjYyIDAgMTIgMCAwIDUuMzggMCAxMnM1LjM4IDEyIDEyIDEyeiIvPjxwYXRoIGZpbGw9IiNGQkJDMDUiIGQ9Ik0xMi40OCAxMi45aDExLjI5Yy4wNS4yOC4wOC41OC4wOC44OCAwIDMuMy0yLjY3IDYuMDktNi4wOSA2LjA5LTMuMDcgMC01LjY1LTIuMjItNi4wMy01LjE0bC0uMDItLjA3aC0yLjY2Yy40IDMuMjMgMy4xOCA1Ljc2IDYuNTMgNS43NiAzLjYyIDAgNi41Ni0yLjk0IDYuNTYtNi41NiAwLS42OS0uMS0xLjM2LS4yOC0xLjk5aC4wMnoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNNS4yMyA5LjI1Yy0uOTkgMS43NS0uOTkgMy43NSAwIDUuNS41NS45NSAxLjMgMS43MyAyLjE3IDIuMjhsLjAyLS4wN2gyLjY2bC4wMi4wN2MuODctLjU1IDEuNjItMS4zMyAyLjE3LTIuMjhoLTExLjI5Yy0uMDUtLjI4LS4wOC0uNTgtLjA4LS44OCAwLS4zLjAzLS42LjA4LS44OGgxMS4yOWwtLjAyLS4wN2MtLjU1LS45NS0uOC0xLjczLTIuMTctMi4yOEw3LjQgNi45N2MtLjg3LjU1LTEuNjIgMS4zMy0yLjE3IDIuMjh6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTUuMjMgMTQuNzVjLjU1Ljk1IDEuMyAxLjczIDIuMTcgMi4yOGwuMDItLjA3aDcuNjJjLjg3LS41NSAxLjYyLTEuMzMgMi4xNy0yLjI4aC0xMS45NnoiLz48cGF0aCBmaWxsPSIjRkI4QzAwIiBkPSJNMTIgNC44MWMtMi4wNiAwLTMuODkgMS4wNS00Ljk3IDIuNjZsLjAyLS4wN0g0LjM1bC0uMDIuMDdDMi40NSA5LjIgMS4yNiAxMS4yIDEuMjYgMTNoMi42NmMuNC0zLjIzIDMuMTgtNS43NiA2LjUzLTUuNzYgMS4wOCAwIDIuMDguMjUgMi45NS42OWwtLjAyLS4wN2MyLjE0IDEuMzkgMy41NiAzLjc4IDMuNTYgNi41NiAwIC42OS0uMSAxLjM2LS4yOCAxLjk5aDIuNjhjLjE4LS42My4yOC0xLjMuMjgtMS45OSAwLTMuMy0yLjY3LTYuMDktNi4wOS02LjA5eiIvPjwvc3ZnPg==',
    meta: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzA2NjhFRCIgZD0iTTEyIDI0YzYuNjIgMCAxMi01LjM4IDEyLTEyUzE4LjYyIDAgMTIgMCAwIDUuMzggMCAxMnM1LjM4IDEyIDEyIDEyeiIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPk08L3RleHQ+PC9zdmc+',
    deepseek: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjNEU3M0Y3IiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPkQ8L3RleHQ+PC9zdmc+',
    xai: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMDAwMDAwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPng8L3RleHQ+PC9zdmc+',
    mistral: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkY3MDAwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPk08L3RleHQ+PC9zdmc+',
    cohere: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMzk2OURDIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPkM8L3RleHQ+PC9zdmc+',
    amazon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkY5OTAwIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPkE8L3RleHQ+PC9zdmc+',
    nvidia: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjNzZCMjRBIiByeD0iNCIvPjx0ZXh0IHg9IjEyIiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzZXJpZiIgZm9udC13ZWlnaHQ9ImJvbGQiPk48L3RleHQ+PC9zdmc+',
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
    initI18n();
    initGitHubStar();
    initResponsive();
    await loadData();
    initEventListeners();
});

function initElements() {
    elements.searchInput = document.getElementById('search-input');
    elements.rankingsBody = document.getElementById('rankings-body');
    elements.pagination = document.getElementById('pagination');
    elements.totalModels = document.getElementById('total-models');
    elements.rankedModels = document.getElementById('ranked-models');
    elements.lastUpdated = document.getElementById('last-updated');
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

async function initGitHubStar() {
    const starLink = document.getElementById('github-star');
    const starCount = document.getElementById('star-count');
    if (!starLink || !CONFIG.GITHUB_REPO) return;

    starLink.href = `https://github.com/${CONFIG.GITHUB_REPO}`;

    try {
        const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}`);
        if (!response.ok) return;
        const data = await response.json();
        if (starCount && typeof data.stargazers_count === 'number') {
            starCount.textContent = data.stargazers_count;
        }
    } catch (error) {
        console.warn('Failed to load GitHub star count:', error);
    }
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

// i18n
function initI18n() {
    window.i18n.init();
    window.i18n.onLangChange(() => {
        renderPodium();
        renderRankings();
        updateStats();
        updateResultsCount();
    });
}

// Load Data
async function loadData() {
    try {
        const response = await fetch(CONFIG.DATA_URL);
        if (!response.ok) throw new Error('Data fetch failed');
        const data = await response.json();
        
        state.models = data.models || [];
        state.filteredModels = [...state.models];
        state.rankComparedTo = data.rank_compared_to || null;
        
        updateStats(data);
        populateProviders();
        renderPodium();
        filterAndSort();
    } catch (error) {
        console.error('Error loading data:', error);
        elements.rankingsBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger);">
                    ${window.i18n.t('data_error')}
                </td>
            </tr>
        `;
    }
}

function updateStats(data) {
    if (data) {
        elements.totalModels.textContent = data.total_models || 0;
        elements.rankedModels.textContent = data.ranked_models || 0;
        if (data.updated_at) {
            const date = new Date(data.updated_at);
            const lang = window.i18n.currentLang;
            elements.lastUpdated.textContent = date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
        }
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
    let filtered = state.models.filter(m => m.intelligence_score != null);
    
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
    if (!score) return '-';
    if (score >= 1e6) return (score / 1e6).toFixed(1) + 'M';
    if (score >= 1e3) return (score / 1e3).toFixed(1) + 'K';
    return Math.round(score).toString();
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'];

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
        const medal = PODIUM_MEDALS[model.rank - 1] || '';
        return `
            <div class="podium-card ${rankClass} fade-in" data-model-id="${escapeAttr(model.id)}">
                <div class="podium-medal-wrap">
                    <span class="podium-medal">${medal}</span>
                </div>
                <div class="podium-rank">#${model.rank} ${formatRankChangeHtml(model, true)}</div>
                <div class="podium-name">${escapeHtml(model.name)}</div>
                <div class="podium-provider">${escapeHtml(model.provider_display || model.provider)}</div>
                <div class="podium-metrics">
                    <div class="podium-metric">
                        <span class="podium-metric-value">${model.intelligence_score || '-'}</span>
                        <span class="podium-metric-label">${window.i18n.t('podium_intelligence')}</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-value">${model.speed || '-'}<small style="font-size:0.65em;font-weight:500"> tok/s</small></span>
                        <span class="podium-metric-label">${window.i18n.t('podium_speed')}</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-value">$${model.pricing.blended.toFixed(2)}</span>
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

    const maxValue = Math.max(...state.filteredModels.map(m => m.value_score || 0));

    elements.rankingsCards.innerHTML = pageModels.map((model, idx) => {
        const rank = model.rank || '-';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const intelClass = getIntelligenceClass(model.intelligence_score);
        const priceClass = getPriceClass(model.pricing.blended);
        const valueScore = model.value_score || 0;
        const valueBarWidth = maxValue > 0 ? (valueScore / maxValue * 100) : 0;

        return `
            <article class="model-card fade-in" style="animation-delay: ${idx * 30}ms" data-model-id="${escapeAttr(model.id)}">
                <div class="model-card-header">
                    <div class="model-card-rank">
                        <span class="rank-badge ${rankClass}">${rank}</span>
                        ${formatRankChangeHtml(model)}
                    </div>
                    <button type="button" class="btn-detail" data-model-id="${escapeAttr(model.id)}">${window.i18n.t('th_detail')}</button>
                </div>
                <div class="model-card-body">
                    <h4 class="model-card-name">${escapeHtml(model.name)}</h4>
                    <p class="model-card-id">${escapeHtml(model.id)}</p>
                    <span class="provider-badge">${escapeHtml(model.provider_display || model.provider)}</span>
                </div>
                <div class="model-card-metrics">
                    <div class="model-card-metric">
                        <span class="model-card-metric-label">${window.i18n.t('th_intelligence')}</span>
                        <span class="intelligence-score ${intelClass}">${model.intelligence_score || '-'}</span>
                    </div>
                    <div class="model-card-metric">
                        <span class="model-card-metric-label">${window.i18n.t('th_speed')}</span>
                        <span>${model.speed ? model.speed + ' tok/s' : '-'}</span>
                    </div>
                    <div class="model-card-metric">
                        <span class="model-card-metric-label">${window.i18n.t('th_price')}</span>
                        <span class="price-display ${priceClass}">$${model.pricing.blended.toFixed(2)}</span>
                    </div>
                    <div class="model-card-metric model-card-metric-value">
                        <span class="model-card-metric-label">${window.i18n.t('th_value')}</span>
                        <span class="value-score">${formatValueScore(valueScore)}</span>
                        <div class="value-bar">
                            <div class="value-bar-fill" style="width: ${valueBarWidth}%"></div>
                        </div>
                    </div>
                </div>
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
                <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">
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
        
        const speed = model.speed ? model.speed + ' tok/s' : '-';
        
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
                <td class="col-price">
                    <span class="price-display ${priceClass}">$${price.toFixed(2)}</span>
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
    if (!model) return;
    
    const lang = window.i18n.currentLang;
    const providerName = PROVIDER_NAMES[model.provider]?.[lang] || model.provider;
    const logoSrc = PROVIDER_LOGOS[model.provider] || '';
    
    elements.modalBody.innerHTML = `
        <div class="model-detail-header">
            ${logoSrc ? `<img src="${logoSrc}" alt="${providerName}" style="width: 40px; height: 40px;">` : ''}
            <div>
                <h2>${escapeHtml(model.name)}</h2>
                <span style="color: var(--text-muted); font-family: monospace;">${escapeHtml(model.id)}</span>
            </div>
        </div>
        
        <div class="detail-grid">
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('th_provider')}</span>
                <span class="detail-value">${providerName}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('th_intelligence')}</span>
                <span class="detail-value ${getIntelligenceClass(model.intelligence_score)}">${model.intelligence_score || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('context_window')}</span>
                <span class="detail-value">${model.context_length ? (model.context_length / 1024) + 'K' : '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('input_price')}</span>
                <span class="detail-value">$${model.pricing.prompt.toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('output_price')}</span>
                <span class="detail-value">$${model.pricing.completion.toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('blended_price')}</span>
                <span class="detail-value">$${model.pricing.blended.toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('th_value')}</span>
                <span class="detail-value" style="color: var(--accent-primary); font-size: 1.3rem;">${formatValueScore(model.value_score)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('th_change')}</span>
                <span class="detail-value">${formatRankChangeText(model)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('value_rank')}</span>
                <span class="detail-value">#${model.rank || '-'}</span>
            </div>
        </div>
        
        ${model.description ? `<p style="color: var(--text-secondary); margin-top: 1rem;">${escapeHtml(model.description)}</p>` : ''}
    `;
    
    // Load comments for this model
    elements.modelModal.dataset.currentModel = modelId;
    elements.modelModal.classList.remove('hidden');

    if (window.githubComments) {
        try {
            window.githubComments.loadComments(modelId);
        } catch (error) {
            console.warn('Failed to load comments:', error);
        }
    }
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
        const trigger = e.target.closest('[data-model-id]');
        if (!trigger) return;
        showModelDetail(trigger.dataset.modelId);
    });
}

function closeModal() {
    elements.modelModal.classList.add('hidden');
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
