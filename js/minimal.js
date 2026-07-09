/**
 * Minimal / Editorial standalone rankings UI
 * Data: data/models.json
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
    REPO_URL: 'data/repo.json',
    GITHUB_REPO: 'yyh-001/llm-value-rankings',
    ITEMS_PER_PAGE: 20,
    USD_TO_CNY: 7.25,
    STYLE_PAGES: {
        spacex: 'spacex.html',
        eva: 'eva.html',
        editorial: 'minimal.html',
    },
};

const I18N = {
    zh: {
        eyebrow: '每日更新',
        title: '大模型性价比',
        subtitle: '能力 × 速度^0.8 / 价格 · OpenRouter',
        style_label: '风格',
        style_classic: '经典',
        style_spacex: 'SpaceX',
        style_editorial: '极简',
        style_apple: 'Apple',
        style_aurora: 'Aurora',
        style_eva: 'EVA',
        stat_total: '模型',
        stat_ranked: '已排名',
        stat_avg: '能力均分',
        stat_updated: '更新',
        top3: 'Top 3',
        search_ph: '搜索模型…',
        sort_value: '性价比',
        sort_intel: '能力',
        sort_speed: '速度',
        sort_price: '价格',
        col_rank: '#',
        col_model: '模型',
        col_intel: '能力',
        col_speed: '速度',
        col_price: '价格',
        col_value: '性价比',
        loading: '加载中…',
        empty: '没有匹配的模型',
        error: '数据加载失败',
        results: '{count} 个模型',
        intel: '能力',
        speed: '速度',
        ttft: '首字延迟',
        price: '价格',
        value: '性价比',
        context: '上下文',
        input: '输入',
        output: '输出',
        blended: '综合价',
        channel: '渠道',
        open: '在 OpenRouter 打开',
        new: '新',
        footer: 'OpenRouter · Artificial Analysis',
        footer_site_pv: '总访问量',
        footer_site_uv: '访客数',
        lang_btn: 'EN',
    },
    en: {
        eyebrow: 'Daily rankings',
        title: 'LLM Value Rankings',
        subtitle: 'Intel × Speed^0.8 / Price · OpenRouter',
        style_label: 'Style',
        style_classic: 'Classic',
        style_spacex: 'SpaceX',
        style_editorial: 'Minimal',
        style_apple: 'Apple',
        style_aurora: 'Aurora',
        style_eva: 'EVA',
        stat_total: 'Models',
        stat_ranked: 'Ranked',
        stat_avg: 'Intel avg',
        stat_updated: 'Updated',
        top3: 'Top 3',
        search_ph: 'Search models…',
        sort_value: 'Value',
        sort_intel: 'Intel',
        sort_speed: 'Speed',
        sort_price: 'Price',
        col_rank: '#',
        col_model: 'Model',
        col_intel: 'Intel',
        col_speed: 'Speed',
        col_price: 'Price',
        col_value: 'Value',
        loading: 'Loading…',
        empty: 'No matching models',
        error: 'Failed to load data',
        results: '{count} models',
        intel: 'Intel',
        speed: 'Speed',
        ttft: 'TTFT',
        price: 'Price',
        value: 'Value',
        context: 'Context',
        input: 'Input',
        output: 'Output',
        blended: 'Blended',
        channel: 'Channel',
        open: 'Open on OpenRouter',
        new: 'NEW',
        footer: 'OpenRouter · Artificial Analysis',
        footer_site_pv: 'Total visits',
        footer_site_uv: 'Unique visitors',
        lang_btn: '中文',
    },
};

const state = {
    models: [],
    filtered: [],
    page: 1,
    sort: 'value',
    query: '',
    lang: localStorage.getItem('min-lang') || localStorage.getItem('eva-lang') || 'zh',
    meta: null,
};

const $ = (id) => document.getElementById(id);

function t(key) {
    return I18N[state.lang][key] || I18N.en[key] || key;
}

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (I18N[state.lang][key]) el.textContent = I18N[state.lang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (I18N[state.lang][key]) el.placeholder = I18N[state.lang][key];
    });
    const langBtn = $('lang-label');
    if (langBtn) langBtn.textContent = t('lang_btn');
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
}

function formatPrice(usd) {
    if (usd == null || Number.isNaN(Number(usd))) return '—';
    const price = Number(usd);
    if (state.lang === 'zh') {
        const cny = price * CONFIG.USD_TO_CNY;
        if (cny >= 100) return `¥${cny.toFixed(1)}`;
        if (cny >= 1) return `¥${cny.toFixed(2)}`;
        return `¥${cny.toFixed(3)}`;
    }
    return `$${price.toFixed(2)}`;
}

function formatSpeed(speed) {
    if (speed == null || Number.isNaN(Number(speed))) return '—';
    return `${Math.round(Number(speed))}`;
}

function formatLatency(seconds) {
    if (seconds == null || Number.isNaN(Number(seconds)) || Number(seconds) <= 0) return '—';
    const value = Number(seconds);
    if (value < 1) return `${Math.round(value * 1000)}ms`;
    return `${value.toFixed(2)}s`;
}

function formatValue(score) {
    if (score == null || Number.isNaN(Number(score))) return '—';
    return Number(score).toFixed(1);
}

function formatContext(len) {
    if (!len) return '—';
    if (len >= 1048576) return `${(len / 1048576).toFixed(len % 1048576 === 0 ? 0 : 1)}M`;
    return `${Math.round(len / 1024)}K`;
}

function formatStarCount(count) {
    if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(count);
}

function rankChangeHtml(model) {
    if (model.rank_new) return `<span class="min-change new">${t('new')}</span>`;
    const change = model.rank_change;
    if (change == null || change === 0) return `<span class="min-change same">—</span>`;
    if (change > 0) return `<span class="min-change up">▲${change}</span>`;
    return `<span class="min-change down">▼${Math.abs(change)}</span>`;
}

function navigateStyle(style) {
    localStorage.setItem('ui-style', style);
    if (CONFIG.STYLE_PAGES[style]) {
        window.location.href = CONFIG.STYLE_PAGES[style];
        return;
    }
    window.location.href = 'index.html';
}

function initStyleSwitcher() {
    const select = $('style-select');
    if (!select) return;
    select.value = 'editorial';
    select.addEventListener('change', () => {
        const next = select.value;
        if (next === 'editorial') return;
        navigateStyle(next);
    });
}

function initTheme() {
    const btn = $('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = next === 'light' ? '#f7f7f8' : '#0a0a0b';
    });
}

async function loadData() {
    const body = $('rankings-body');
    body.innerHTML = `<tr><td colspan="6" class="min-empty">${t('loading')}</td></tr>`;
    $('rankings-cards').innerHTML = '';

    try {
        const cacheKey = document.querySelector('meta[name="app-version"]')?.content || Date.now();
        const res = await fetch(`${CONFIG.DATA_URL}?v=${cacheKey}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();

        state.models = data.models || [];
        state.meta = {
            total_models: data.total_models,
            ranked_models: data.ranked_models,
            updated_at: data.updated_at,
            avg_intelligence: data.avg_intelligence,
        };

        updateStats();
        renderPodium();
        filterAndSort();
    } catch (err) {
        console.error(err);
        body.innerHTML = `<tr><td colspan="6" class="min-empty">${t('error')}</td></tr>`;
    }
}

function updateStats() {
    const meta = state.meta || {};
    $('total-models').textContent = meta.total_models ?? state.models.length;
    $('ranked-models').textContent = meta.ranked_models ?? state.models.filter((m) => m.rank).length;
    const avg = meta.avg_intelligence;
    $('avg-intelligence').textContent = avg != null ? Number(avg).toFixed(1) : '—';
    if (meta.updated_at) {
        const date = new Date(meta.updated_at);
        $('last-updated').textContent = date.toLocaleDateString(
            state.lang === 'zh' ? 'zh-CN' : 'en-US',
            { month: 'short', day: 'numeric' }
        );
    }
}

function renderPodium() {
    const section = $('podium-section');
    const podium = $('podium');
    const top3 = state.models
        .filter((m) => m.rank && m.rank <= 3 && m.value_score != null)
        .sort((a, b) => a.rank - b.rank);

    if (!top3.length) {
        section.hidden = true;
        return;
    }

    section.hidden = false;
    podium.innerHTML = top3
        .map(
            (m) => `
        <article class="min-card" data-id="${escapeAttr(m.id)}" tabindex="0" role="button">
            <div class="min-card-rank">#${m.rank} ${rankChangeHtml(m)}</div>
            <div class="min-card-name">${escapeHtml(m.name)}</div>
            <div class="min-card-provider">${escapeHtml(m.provider_display || m.provider)}</div>
            <div class="min-card-row">
                <span>${t('intel')} <b>${m.intelligence_score ?? '—'}</b></span>
                <span>${t('speed')} <b>${formatSpeed(m.speed)}</b></span>
                <span>${t('value')} <b>${formatValue(m.value_score)}</b></span>
            </div>
        </article>`
        )
        .join('');

    podium.querySelectorAll('.min-card').forEach((el) => {
        const open = () => showDetail(el.dataset.id);
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });
}

function filterAndSort() {
    let list = state.models.filter((m) => m.rank != null);

    if (state.query) {
        const q = state.query.toLowerCase();
        list = list.filter(
            (m) =>
                m.name?.toLowerCase().includes(q) ||
                m.id?.toLowerCase().includes(q) ||
                m.provider?.toLowerCase().includes(q) ||
                m.provider_display?.toLowerCase().includes(q)
        );
    }

    const sorters = {
        value: (a, b) => (b.value_score || 0) - (a.value_score || 0),
        intelligence: (a, b) => (b.intelligence_score || 0) - (a.intelligence_score || 0),
        speed: (a, b) => (b.speed || 0) - (a.speed || 0),
        price: (a, b) => (a.pricing?.blended || Infinity) - (b.pricing?.blended || Infinity),
    };
    list.sort(sorters[state.sort] || sorters.value);

    state.filtered = list;
    state.page = 1;
    renderList();
}

function renderList() {
    const body = $('rankings-body');
    const cards = $('rankings-cards');
    const count = state.filtered.length;
    $('results-count').textContent = t('results').replace('{count}', count);

    if (!count) {
        body.innerHTML = `<tr><td colspan="6" class="min-empty">${t('empty')}</td></tr>`;
        cards.innerHTML = `<div class="min-empty">${t('empty')}</div>`;
        $('pagination').innerHTML = '';
        return;
    }

    const start = (state.page - 1) * CONFIG.ITEMS_PER_PAGE;
    const pageItems = state.filtered.slice(start, start + CONFIG.ITEMS_PER_PAGE);

    body.innerHTML = pageItems
        .map((m) => {
            const topClass = m.rank <= 3 ? 'top' : '';
            return `
            <tr data-id="${escapeAttr(m.id)}" tabindex="0">
                <td>
                    <span class="min-rank ${topClass}">${m.rank ?? '—'}</span>
                    ${rankChangeHtml(m)}
                </td>
                <td>
                    <div class="min-model-name">${escapeHtml(m.name)}</div>
                    <div class="min-model-meta">${escapeHtml(m.provider_display || m.provider)}</div>
                </td>
                <td class="min-num">${m.intelligence_score ?? '—'}</td>
                <td class="min-num">${formatSpeed(m.speed)} t/s</td>
                <td class="min-num">${formatPrice(m.pricing?.blended)}</td>
                <td class="min-num value">${formatValue(m.value_score)}</td>
            </tr>`;
        })
        .join('');

    cards.innerHTML = pageItems
        .map((m) => {
            const topClass = m.rank <= 3 ? 'top' : '';
            return `
            <div class="min-list-card" data-id="${escapeAttr(m.id)}" tabindex="0" role="button">
                <div class="min-list-top">
                    <div>
                        <span class="min-rank ${topClass}">#${m.rank ?? '—'}</span>
                        ${rankChangeHtml(m)}
                        <div class="min-model-name" style="margin-top:0.25rem">${escapeHtml(m.name)}</div>
                        <div class="min-model-meta">${escapeHtml(m.provider_display || m.provider)}</div>
                    </div>
                    <div class="min-num value" style="font-size:1.1rem">${formatValue(m.value_score)}</div>
                </div>
                <div class="min-list-metrics">
                    <div><b>${m.intelligence_score ?? '—'}</b>${t('intel')}</div>
                    <div><b>${formatSpeed(m.speed)}</b>${t('speed')}</div>
                    <div><b>${formatPrice(m.pricing?.blended)}</b>${t('price')}</div>
                    <div><b>${formatValue(m.value_score)}</b>${t('value')}</div>
                </div>
            </div>`;
        })
        .join('');

    const bind = (el) => {
        const open = () => showDetail(el.dataset.id);
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    };
    body.querySelectorAll('tr[data-id]').forEach(bind);
    cards.querySelectorAll('.min-list-card').forEach(bind);

    renderPagination();
}

function renderPagination() {
    const total = Math.ceil(state.filtered.length / CONFIG.ITEMS_PER_PAGE);
    const pager = $('pagination');
    if (total <= 1) {
        pager.innerHTML = '';
        return;
    }

    const buttons = [];
    buttons.push(
        `<button type="button" class="min-page-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`
    );

    const windowSize = 5;
    let from = Math.max(1, state.page - Math.floor(windowSize / 2));
    let to = Math.min(total, from + windowSize - 1);
    from = Math.max(1, to - windowSize + 1);

    if (from > 1) {
        buttons.push(`<button type="button" class="min-page-btn" data-page="1">1</button>`);
        if (from > 2) buttons.push(`<span class="min-page-btn" style="border:none;opacity:.4">…</span>`);
    }

    for (let i = from; i <= to; i++) {
        buttons.push(
            `<button type="button" class="min-page-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`
        );
    }

    if (to < total) {
        if (to < total - 1) buttons.push(`<span class="min-page-btn" style="border:none;opacity:.4">…</span>`);
        buttons.push(`<button type="button" class="min-page-btn" data-page="${total}">${total}</button>`);
    }

    buttons.push(
        `<button type="button" class="min-page-btn" data-page="${state.page + 1}" ${state.page === total ? 'disabled' : ''}>›</button>`
    );

    pager.innerHTML = buttons.join('');
    pager.querySelectorAll('button[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const p = Number(btn.dataset.page);
            if (p >= 1 && p <= total) {
                state.page = p;
                renderList();
                $('rankings-body').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function showDetail(modelId) {
    const model = state.models.find((m) => m.id === modelId);
    if (!model) return;

    const modal = $('detail-modal');
    modal.dataset.currentModel = model.id;

    const pricing = model.pricing || {};
    const openUrl = `https://openrouter.ai/${model.id}`;
    const channel = pricing.pricing_source || 'OpenRouter';
    const channelUrl = pricing.pricing_source_url || openUrl;

    $('modal-body').innerHTML = `
        <div class="min-detail-rank">#${model.rank ?? '—'} ${rankChangeHtml(model)}</div>
        <h2 class="min-detail-title" id="modal-title">${escapeHtml(model.name)}</h2>
        <a class="min-detail-id" href="${escapeAttr(openUrl)}" target="_blank" rel="noopener">${escapeHtml(model.id)}</a>
        <span class="min-detail-provider">${escapeHtml(model.provider_display || model.provider)}</span>

        <div class="min-detail-value">
            <span>${t('value')}</span>
            <strong>${formatValue(model.value_score)}</strong>
        </div>

        <div class="min-detail-grid">
            <div class="min-detail-cell"><span>${t('intel')}</span><b>${model.intelligence_score ?? '—'}</b></div>
            <div class="min-detail-cell"><span>${t('speed')}</span><b>${formatSpeed(model.speed)} t/s</b></div>
            <div class="min-detail-cell"><span>${t('ttft')}</span><b>${formatLatency(model.ttft)}</b></div>
            <div class="min-detail-cell"><span>${t('context')}</span><b>${formatContext(model.context_length)}</b></div>
            <div class="min-detail-cell"><span>${t('input')}</span><b>${formatPrice(pricing.prompt)}</b></div>
            <div class="min-detail-cell"><span>${t('output')}</span><b>${formatPrice(pricing.completion)}</b></div>
            <div class="min-detail-cell"><span>${t('blended')}</span><b>${formatPrice(pricing.blended)}</b></div>
            <div class="min-detail-cell"><span>${t('channel')}</span><b><a href="${escapeAttr(channelUrl)}" target="_blank" rel="noopener">${escapeHtml(channel)}</a></b></div>
        </div>

        ${model.description ? `<p class="min-detail-desc">${escapeHtml(model.description)}</p>` : ''}

        <a class="min-cta" href="${escapeAttr(openUrl)}" target="_blank" rel="noopener">${t('open')}</a>
    `;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDetail() {
    const modal = $('detail-modal');
    modal.classList.add('hidden');
    delete modal.dataset.currentModel;
    document.body.style.overflow = '';
}

async function loadStars() {
    const el = $('star-count');
    if (!el) return;
    try {
        const cacheKey = document.querySelector('meta[name="app-version"]')?.content || Date.now();
        const res = await fetch(`${CONFIG.REPO_URL}?v=${cacheKey}`);
        if (res.ok) {
            const data = await res.json();
            if (typeof data.stars === 'number') {
                el.textContent = formatStarCount(data.stars);
                return;
            }
        }
    } catch { /* fall through */ }
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}`);
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.stargazers_count === 'number') {
            el.textContent = formatStarCount(data.stargazers_count);
        }
    } catch { /* ignore */ }
}

function initEvents() {
    let searchTimer;
    $('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.query = e.target.value.trim();
            filterAndSort();
        }, 180);
    });

    $('sort-select').addEventListener('change', (e) => {
        state.sort = e.target.value;
        filterAndSort();
    });

    $('lang-toggle').addEventListener('click', () => {
        state.lang = state.lang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('min-lang', state.lang);
        applyI18n();
        updateStats();
        renderPodium();
        renderList();
        const modal = $('detail-modal');
        if (!modal.classList.contains('hidden') && modal.dataset.currentModel) {
            showDetail(modal.dataset.currentModel);
        }
    });

    $('modal-close').addEventListener('click', closeDetail);
    $('modal-backdrop').addEventListener('click', closeDetail);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetail();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();
    initTheme();
    initStyleSwitcher();
    initEvents();
    loadStars();
    loadData();
});
