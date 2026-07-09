/**
 * EVA / NERV Command — standalone rankings UI
 * Data: data/models.json
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
    REPO_URL: 'data/repo.json',
    GITHUB_REPO: 'yyh-001/llm-value-rankings',
    ITEMS_PER_PAGE: 20,
    USD_TO_CNY: 7.25,
};

const I18N = {
    zh: {
        title: '性价比作战指挥台',
        subtitle: '能力 × 速度^0.8 / 价格 · OpenRouter 实时数据',
        style_label: '风格',
        style_classic: '经典',
        style_spacex: 'SpaceX',
        style_editorial: '极简',
        style_apple: 'Apple',
        style_aurora: 'Aurora',
        style_eva: 'EVA',
        stat_units: 'UNITS',
        stat_ranked: 'RANKED',
        stat_avg: 'INTEL AVG',
        stat_updated: 'UPDATED',
        pilots: 'TOP PILOTS',
        board: 'RANKING BOARD',
        search: 'SEARCH',
        sort: 'SORT',
        sort_value: 'VALUE',
        sort_intel: 'INTEL',
        sort_speed: 'SPEED',
        sort_price: 'PRICE',
        col_unit: 'UNIT',
        col_intel: 'INTEL',
        col_speed: 'SPD',
        col_price: 'PRICE',
        col_value: 'VALUE',
        loading: 'SYNCING MAGI…',
        empty: 'NO MATCHING UNITS',
        error: 'DATA LINK FAILED',
        results: '{count} UNITS',
        online: 'SYSTEM ONLINE',
        intel: 'INTEL',
        speed: 'SPEED',
        ttft: 'TTFT',
        price: 'PRICE',
        value: 'VALUE',
        context: 'CONTEXT',
        input: 'INPUT',
        output: 'OUTPUT',
        blended: 'BLENDED',
        channel: 'CHANNEL',
        open: 'OPEN ON OPENROUTER',
        new: 'NEW',
        lang_btn: 'EN',
    },
    en: {
        title: 'VALUE COMMAND DECK',
        subtitle: 'Intel × Speed^0.8 / Price · OpenRouter live feed',
        style_label: 'Style',
        style_classic: 'Classic',
        style_spacex: 'SpaceX',
        style_editorial: 'Minimal',
        style_apple: 'Apple',
        style_aurora: 'Aurora',
        style_eva: 'EVA',
        stat_units: 'UNITS',
        stat_ranked: 'RANKED',
        stat_avg: 'INTEL AVG',
        stat_updated: 'UPDATED',
        pilots: 'TOP PILOTS',
        board: 'RANKING BOARD',
        search: 'SEARCH',
        sort: 'SORT',
        sort_value: 'VALUE',
        sort_intel: 'INTEL',
        sort_speed: 'SPEED',
        sort_price: 'PRICE',
        col_unit: 'UNIT',
        col_intel: 'INTEL',
        col_speed: 'SPD',
        col_price: 'PRICE',
        col_value: 'VALUE',
        loading: 'SYNCING MAGI…',
        empty: 'NO MATCHING UNITS',
        error: 'DATA LINK FAILED',
        results: '{count} UNITS',
        online: 'SYSTEM ONLINE',
        intel: 'INTEL',
        speed: 'SPEED',
        ttft: 'TTFT',
        price: 'PRICE',
        value: 'VALUE',
        context: 'CONTEXT',
        input: 'INPUT',
        output: 'OUTPUT',
        blended: 'BLENDED',
        channel: 'CHANNEL',
        open: 'OPEN ON OPENROUTER',
        new: 'NEW',
        lang_btn: '中文',
    },
};

const state = {
    models: [],
    filtered: [],
    page: 1,
    sort: 'value',
    query: '',
    lang: localStorage.getItem('eva-lang') || 'zh',
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
    const langBtn = $('lang-toggle');
    if (langBtn) langBtn.textContent = t('lang_btn');
    const status = $('status-text');
    if (status) status.textContent = t('online');
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
}

function initStyleSwitcher() {
    const select = $('style-select');
    if (!select) return;
    select.value = 'eva';
    select.addEventListener('change', () => {
        const next = select.value;
        if (next === 'eva') return;
        localStorage.setItem('ui-style', next);
        window.location.href = 'index.html';
    });
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
    if (model.rank_new) {
        return `<span class="eva-row-change new">${t('new')}</span>`;
    }
    const change = model.rank_change;
    if (change == null || change === 0) {
        return `<span class="eva-row-change same">—</span>`;
    }
    if (change > 0) {
        return `<span class="eva-row-change up">▲${change}</span>`;
    }
    return `<span class="eva-row-change down">▼${Math.abs(change)}</span>`;
}

async function loadData() {
    const list = $('rankings-list');
    list.innerHTML = `<div class="eva-loading">${t('loading')}</div>`;

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
        list.innerHTML = `<div class="eva-error">${t('error')}</div>`;
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
        <article class="eva-pilot place-${m.rank}" data-id="${escapeAttr(m.id)}" tabindex="0" role="button">
            <div class="eva-pilot-rank">#${m.rank} ${rankChangeHtml(m)}</div>
            <div class="eva-pilot-name">${escapeHtml(m.name)}</div>
            <div class="eva-pilot-provider">${escapeHtml(m.provider_display || m.provider)}</div>
            <div class="eva-pilot-metrics">
                <div class="eva-pilot-metric"><b>${m.intelligence_score ?? '—'}</b><span>${t('intel')}</span></div>
                <div class="eva-pilot-metric"><b>${formatSpeed(m.speed)}</b><span>${t('speed')}</span></div>
                <div class="eva-pilot-metric"><b>${formatValue(m.value_score)}</b><span>${t('value')}</span></div>
            </div>
        </article>`
        )
        .join('');

    podium.querySelectorAll('.eva-pilot').forEach((el) => {
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
    const root = $('rankings-list');
    const count = state.filtered.length;
    $('results-count').textContent = t('results').replace('{count}', count);

    if (!count) {
        root.innerHTML = `<div class="eva-empty">${t('empty')}</div>`;
        $('pagination').innerHTML = '';
        return;
    }

    const start = (state.page - 1) * CONFIG.ITEMS_PER_PAGE;
    const pageItems = state.filtered.slice(start, start + CONFIG.ITEMS_PER_PAGE);

    root.innerHTML = pageItems
        .map((m) => {
            const price = formatPrice(m.pricing?.blended);
            const metrics = `${t('intel')} ${m.intelligence_score ?? '—'} · ${t('speed')} ${formatSpeed(m.speed)} · ${price}`;
            const topClass = m.rank <= 3 ? 'top' : '';
            return `
            <div class="eva-row" data-id="${escapeAttr(m.id)}" data-metrics="${escapeAttr(metrics)}" tabindex="0" role="button">
                <div class="eva-row-rank ${topClass}">
                    ${m.rank ?? '—'}
                    ${rankChangeHtml(m)}
                </div>
                <div class="eva-row-unit">
                    <div class="eva-row-name">${escapeHtml(m.name)}</div>
                    <div class="eva-row-meta">${escapeHtml(m.provider_display || m.provider)}</div>
                </div>
                <div class="eva-row-num">${m.intelligence_score ?? '—'}</div>
                <div class="eva-row-num">${formatSpeed(m.speed)} <small style="opacity:.5">t/s</small></div>
                <div class="eva-row-num orange">${price}</div>
                <div class="eva-row-num green">${formatValue(m.value_score)}</div>
            </div>`;
        })
        .join('');

    root.querySelectorAll('.eva-row').forEach((el) => {
        const open = () => showDetail(el.dataset.id);
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });

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
        `<button type="button" class="eva-page-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`
    );

    const windowSize = 5;
    let from = Math.max(1, state.page - Math.floor(windowSize / 2));
    let to = Math.min(total, from + windowSize - 1);
    from = Math.max(1, to - windowSize + 1);

    if (from > 1) {
        buttons.push(`<button type="button" class="eva-page-btn" data-page="1">1</button>`);
        if (from > 2) buttons.push(`<span class="eva-page-btn" style="border:none;opacity:.4">…</span>`);
    }

    for (let i = from; i <= to; i++) {
        buttons.push(
            `<button type="button" class="eva-page-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`
        );
    }

    if (to < total) {
        if (to < total - 1) buttons.push(`<span class="eva-page-btn" style="border:none;opacity:.4">…</span>`);
        buttons.push(`<button type="button" class="eva-page-btn" data-page="${total}">${total}</button>`);
    }

    buttons.push(
        `<button type="button" class="eva-page-btn" data-page="${state.page + 1}" ${state.page === total ? 'disabled' : ''}>›</button>`
    );

    pager.innerHTML = buttons.join('');
    pager.querySelectorAll('button[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const p = Number(btn.dataset.page);
            if (p >= 1 && p <= total) {
                state.page = p;
                renderList();
                $('rankings-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function showDetail(modelId) {
    const model = state.models.find((m) => m.id === modelId);
    if (!model) return;

    const drawer = $('detail-drawer');
    drawer.dataset.currentModel = model.id;

    const pricing = model.pricing || {};
    const openUrl = `https://openrouter.ai/${model.id}`;
    const channel = pricing.pricing_source || 'OpenRouter';
    const channelUrl = pricing.pricing_source_url || openUrl;

    $('drawer-body').innerHTML = `
        <div class="eva-detail-rank">#${model.rank ?? '—'} ${rankChangeHtml(model)}</div>
        <h2 class="eva-detail-title" id="drawer-title">${escapeHtml(model.name)}</h2>
        <a class="eva-detail-id" href="${escapeAttr(openUrl)}" target="_blank" rel="noopener">${escapeHtml(model.id)}</a>
        <span class="eva-detail-provider">${escapeHtml(model.provider_display || model.provider)}</span>

        <div class="eva-detail-value">
            <span>${t('value')}</span>
            <strong>${formatValue(model.value_score)}</strong>
        </div>

        <div class="eva-detail-grid">
            <div class="eva-detail-cell"><span>${t('intel')}</span><b>${model.intelligence_score ?? '—'}</b></div>
            <div class="eva-detail-cell"><span>${t('speed')}</span><b>${formatSpeed(model.speed)} t/s</b></div>
            <div class="eva-detail-cell"><span>${t('ttft')}</span><b>${formatLatency(model.ttft)}</b></div>
            <div class="eva-detail-cell"><span>${t('context')}</span><b>${formatContext(model.context_length)}</b></div>
            <div class="eva-detail-cell"><span>${t('input')}</span><b>${formatPrice(pricing.prompt)}</b></div>
            <div class="eva-detail-cell"><span>${t('output')}</span><b>${formatPrice(pricing.completion)}</b></div>
            <div class="eva-detail-cell"><span>${t('blended')}</span><b>${formatPrice(pricing.blended)}</b></div>
            <div class="eva-detail-cell"><span>${t('channel')}</span><b><a href="${escapeAttr(channelUrl)}" target="_blank" rel="noopener">${escapeHtml(channel)}</a></b></div>
        </div>

        ${model.description ? `<p class="eva-detail-desc">${escapeHtml(model.description)}</p>` : ''}

        <div class="eva-detail-actions">
            <a class="eva-cta" href="${escapeAttr(openUrl)}" target="_blank" rel="noopener">${t('open')}</a>
        </div>
    `;

    $('detail-drawer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDetail() {
    const drawer = $('detail-drawer');
    drawer.classList.add('hidden');
    delete drawer.dataset.currentModel;
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
    } catch {
        /* fall through */
    }
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}`);
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.stargazers_count === 'number') {
            el.textContent = formatStarCount(data.stargazers_count);
        }
    } catch {
        /* ignore */
    }
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
        localStorage.setItem('eva-lang', state.lang);
        applyI18n();
        updateStats();
        renderPodium();
        renderList();
        const drawer = $('detail-drawer');
        if (!drawer.classList.contains('hidden') && drawer.dataset.currentModel) {
            showDetail(drawer.dataset.currentModel);
        }
    });

    $('drawer-close').addEventListener('click', closeDetail);
    $('drawer-backdrop').addEventListener('click', closeDetail);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetail();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();
    initStyleSwitcher();
    initEvents();
    loadStars();
    loadData();
});
