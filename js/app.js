/**
 * LLM Value Rankings - Main Application
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
    ITEMS_PER_PAGE: 20,
    GITHUB_REPO: '', // Will be set by user
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
    await loadData();
    initEventListeners();
});

function initElements() {
    elements.searchInput = document.getElementById('search-input');
    elements.providerFilter = document.getElementById('provider-filter');
    elements.sortBy = document.getElementById('sort-by');
    elements.priceRange = document.getElementById('price-range');
    elements.rankingsBody = document.getElementById('rankings-body');
    elements.pagination = document.getElementById('pagination');
    elements.totalModels = document.getElementById('total-models');
    elements.rankedModels = document.getElementById('ranked-models');
    elements.lastUpdated = document.getElementById('last-updated');
    elements.modelModal = document.getElementById('model-modal');
    elements.modalBody = document.getElementById('modal-body');
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
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
        renderTable();
        updateStats();
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
        
        updateStats(data);
        populateProviders();
        filterAndSort();
    } catch (error) {
        console.error('Error loading data:', error);
        elements.rankingsBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
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
    let filtered = [...state.models];
    
    // Search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(m => 
            m.name.toLowerCase().includes(query) ||
            m.id.toLowerCase().includes(query) ||
            m.provider.toLowerCase().includes(query)
        );
    }
    
    // Provider filter
    if (state.providerFilter) {
        filtered = filtered.filter(m => m.provider === state.providerFilter);
    }
    
    // Price range filter
    if (state.priceRange) {
        const [min, max] = state.priceRange.split('-').map(Number);
        filtered = filtered.filter(m => {
            const price = m.pricing.blended;
            if (max) return price >= min && price < max;
            return price >= min;
        });
    }
    
    // Sort based on selected method
    switch (state.sortBy) {
        case 'capability':
            // Capability-first: strongly favors high intelligence models
            filtered.sort((a, b) => {
                const scoreA = a.value_scores?.capability_first || 0;
                const scoreB = b.value_scores?.capability_first || 0;
                return scoreB - scoreA;
            });
            break;
        case 'balanced':
            // Balanced: intelligence^2 / price
            filtered.sort((a, b) => {
                const scoreA = a.value_scores?.balanced || 0;
                const scoreB = b.value_scores?.balanced || 0;
                return scoreB - scoreA;
            });
            break;
        case 'budget':
            // Budget: intelligence / sqrt(price)
            filtered.sort((a, b) => {
                const scoreA = a.value_scores?.budget || 0;
                const scoreB = b.value_scores?.budget || 0;
                return scoreB - scoreA;
            });
            break;
        case 'intelligence':
            filtered.sort((a, b) => (b.intelligence_score || 0) - (a.intelligence_score || 0));
            break;
        case 'price':
            filtered.sort((a, b) => a.pricing.blended - b.pricing.blended);
            break;
        default:
            // Default to capability-first
            filtered.sort((a, b) => {
                const scoreA = a.value_scores?.capability_first || 0;
                const scoreB = b.value_scores?.capability_first || 0;
                return scoreB - scoreA;
            });
    }
    
    state.filteredModels = filtered;
    state.currentPage = 1;
    renderTable();
}

// Render Table
function renderTable() {
    const lang = window.i18n.currentLang;
    const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const pageModels = state.filteredModels.slice(start, end);
    
    if (pageModels.length === 0) {
        elements.rankingsBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    ${lang === 'zh' ? '没有找到匹配的模型' : 'No matching models found'}
                </td>
            </tr>
        `;
        elements.pagination.innerHTML = '';
        return;
    }
    
    // Find max value for bar scaling
    const maxValue = Math.max(...state.filteredModels.filter(m => m.value_score).map(m => m.value_score));
    
    elements.rankingsBody.innerHTML = pageModels.map((model, idx) => {
        const rank = model.rank || '-';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        const providerName = PROVIDER_NAMES[model.provider]?.[lang] || model.provider;
        const logoSrc = PROVIDER_LOGOS[model.provider] || '';
        
        const intelScore = model.intelligence_score || '-';
        const intelClass = getIntelligenceClass(model.intelligence_score);
        
        const price = model.pricing.blended;
        const priceClass = getPriceClass(price);
        
        const valueBarWidth = model.value_score ? (model.value_score / maxValue * 100) : 0;
        
        return `
            <tr class="fade-in" style="animation-delay: ${idx * 30}ms">
                <td class="col-rank">
                    <span class="rank-badge ${rankClass}">${rank}</span>
                </td>
                <td class="col-model">
                    <div class="model-info">
                        <span class="model-name">${escapeHtml(model.name)}</span>
                        <span class="model-id">${escapeHtml(model.id)}</span>
                    </div>
                </td>
                <td class="col-provider">
                    <span class="provider-badge">
                        ${logoSrc ? `<img src="${logoSrc}" alt="${providerName}" class="provider-logo">` : ''}
                        ${providerName}
                    </span>
                </td>
                <td class="col-intelligence">
                    <span class="intelligence-score ${intelClass}">${intelScore}</span>
                </td>
                <td class="col-price">
                    <span class="price-display ${priceClass}">$${price.toFixed(2)}</span>
                </td>
                <td class="col-value">
                    <span class="value-score">${model.value_score || '-'}</span>
                    <div class="value-bar">
                        <div class="value-bar-fill" style="width: ${valueBarWidth}%"></div>
                    </div>
                </td>
                <td class="col-detail">
                    <button class="btn-detail" onclick="showModelDetail('${model.id}')">
                        ${lang === 'zh' ? '详情' : 'Detail'}
                    </button>
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
        if (startPage > 2) html += `<span style="padding: 0.5rem;">...</span>`;
    }
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0.5rem;">...</span>`;
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
    renderTable();
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
                <span class="detail-value" style="color: var(--accent-primary); font-size: 1.3rem;">${model.value_score || '-'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">${window.i18n.t('value_rank')}</span>
                <span class="detail-value">#${model.rank || '-'}</span>
            </div>
        </div>
        
        ${model.description ? `<p style="color: var(--text-secondary); margin-top: 1rem;">${escapeHtml(model.description)}</p>` : ''}
    `;
    
    // Load comments for this model
    if (window.githubComments) {
        window.githubComments.loadComments(modelId);
    }
    
    elements.modelModal.classList.remove('hidden');
}

// Event Listeners
function initEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', debounce((e) => {
        state.searchQuery = e.target.value;
        filterAndSort();
    }, 300));
    
    // Provider filter
    elements.providerFilter.addEventListener('change', (e) => {
        state.providerFilter = e.target.value;
        filterAndSort();
    });
    
    // Sort
    elements.sortBy.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        filterAndSort();
    });
    
    // Price range
    elements.priceRange.addEventListener('change', (e) => {
        state.priceRange = e.target.value;
        filterAndSort();
    });
    
    // Modal close
    elements.modelModal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    elements.modelModal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
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

// Make goToPage and showModelDetail global
window.goToPage = goToPage;
window.showModelDetail = showModelDetail;
