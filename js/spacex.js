/**
 * SpaceX cinematic full-screen scroll rankings
 * Data: data/models.json
 */

const CONFIG = {
    DATA_URL: 'data/models.json',
    REPO_URL: 'data/repo.json',
    GITHUB_REPO: 'yyh-001/llm-value-rankings',
    ITEMS_PER_PAGE: 20,
    USD_TO_CNY: 7.25,
};

const STYLE_PAGES = {
    spacex: 'spacex.html',
    editorial: 'minimal.html',
    eva: 'eva.html',
};

const I18N = {
    zh: {
        kicker: '任务简报',
        title: '性价比排行榜',
        subtitle: '能力 × 速度^0.8 / 价格 · OpenRouter 遥测',
        scroll: '向下滚动',
        telemetry: '遥测数据',
        formula_label: '核心方程',
        fx_countdown: '准备发射',
        fx_vehicle: '下一台载具就位',
        fx_liftoff: '发射',
        fx_formula: '每个模型 · 一个分数',
        fx_marquee: '数百载具在轨',
        fx_warp_title: 'MAX Q',
        fx_warp: '速度遇见价格 · 只有高效者存活',
        duel_speed: '最快',
        duel_price: '最便宜',
        duel_value: '性价比胜出',
        duel_hint: '继续滚动 · 揭晓胜者',
        duel_hint_done: '点击卡片查看详情',
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
        top3: '飞行机组',
        board: '任务清单',
        search_ph: '搜索载具…',
        sort_value: '性价比',
        sort_intel: '能力',
        sort_speed: '速度',
        sort_price: '价格',
        col_rank: '#',
        col_model: '载具',
        col_intel: '能力',
        col_speed: '速度',
        col_price: '价格',
        col_value: '性价比',
        loading: '正在获取信号…',
        empty: '无匹配载具',
        error: '链路中断',
        results: '{count} 台',
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
        footer: '占领火星 · 排名模型',
        lang_btn: 'EN',
    },
    en: {
        kicker: 'MISSION BRIEFING',
        title: 'VALUE LEADERBOARD',
        subtitle: 'INTEL × SPEED^0.8 / PRICE · OPENROUTER TELEMETRY',
        scroll: 'SCROLL',
        telemetry: 'TELEMETRY',
        formula_label: 'CORE EQUATION',
        fx_countdown: 'GO FOR LAUNCH',
        fx_vehicle: 'NEXT VEHICLE ON PAD',
        fx_liftoff: 'LIFTOFF',
        fx_formula: 'EVERY MODEL. ONE SCORE.',
        fx_marquee: 'HUNDREDS OF VEHICLES IN ORBIT',
        fx_warp_title: 'MAX Q',
        fx_warp: 'SPEED MEETS PRICE. ONLY THE EFFICIENT SURVIVE.',
        duel_speed: 'FASTEST',
        duel_price: 'CHEAPEST',
        duel_value: 'BEST VALUE',
        duel_hint: 'KEEP SCROLLING · REVEAL WINNER',
        duel_hint_done: 'TAP A CARD FOR DETAILS',
        style_label: 'STYLE',
        style_classic: 'Classic',
        style_spacex: 'SpaceX',
        style_editorial: 'Minimal',
        style_apple: 'Apple',
        style_aurora: 'Aurora',
        style_eva: 'EVA',
        stat_total: 'MODELS',
        stat_ranked: 'RANKED',
        stat_avg: 'INTEL AVG',
        stat_updated: 'UPDATED',
        top3: 'FLIGHT CREW',
        board: 'MANIFEST',
        search_ph: 'SEARCH VEHICLE…',
        sort_value: 'VALUE',
        sort_intel: 'INTEL',
        sort_speed: 'SPEED',
        sort_price: 'PRICE',
        col_rank: '#',
        col_model: 'VEHICLE',
        col_intel: 'INTEL',
        col_speed: 'SPEED',
        col_price: 'PRICE',
        col_value: 'VALUE',
        loading: 'ACQUIRING SIGNAL…',
        empty: 'NO MATCHING VEHICLES',
        error: 'LINK FAILED',
        results: '{count} UNITS',
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
        footer: 'OCCUPY MARS · RANK MODELS',
        lang_btn: '中文',
    },
};

const state = {
    models: [],
    filtered: [],
    page: 1,
    sort: 'value',
    query: '',
    lang: localStorage.getItem('sx-lang') || localStorage.getItem('min-lang') || localStorage.getItem('eva-lang') || 'zh',
    meta: null,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    lastCountdownStep: -1,
    launchModels: [],
    duel: { speed: null, price: null, value: null },
    lastWarpPhase: -1,
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
    splitTitle();
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
    if (model.rank_new) return `<span class="sx-change new">${t('new')}</span>`;
    const change = model.rank_change;
    if (change == null || change === 0) return `<span class="sx-change same">—</span>`;
    if (change > 0) return `<span class="sx-change up">▲${change}</span>`;
    return `<span class="sx-change down">▼${Math.abs(change)}</span>`;
}

/* —— Scroll cinema —— */
function splitTitle() {
    const title = document.querySelector('.sx-title-split');
    if (!title) return;
    const text = t('title');
    title.textContent = '';
    [...text].forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'sx-char';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        span.style.animationDelay = `${0.05 + i * 0.04}s`;
        title.appendChild(span);
    });
}

function pinProgress(el) {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const total = Math.max(1, el.offsetHeight - window.innerHeight);
    const scrolled = Math.min(total, Math.max(0, -rect.top));
    return scrolled / total;
}

function initStarfield() {
    const canvas = $('sx-canvas');
    if (!canvas || state.reduceMotion) return;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let stars = [];
    let raf = 0;
    let scrollBoost = 0;

    const resize = () => {
        w = canvas.width = window.innerWidth * devicePixelRatio;
        h = canvas.height = window.innerHeight * devicePixelRatio;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        stars = Array.from({ length: 140 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            z: Math.random() * 0.9 + 0.1,
            r: Math.random() * 1.6 + 0.3,
        }));
    };

    const draw = () => {
        ctx.clearRect(0, 0, w, h);
        const speed = 0.35 + scrollBoost * 8;
        for (const s of stars) {
            s.y += s.z * speed * devicePixelRatio;
            if (s.y > h) {
                s.y = 0;
                s.x = Math.random() * w;
            }
            const alpha = 0.25 + s.z * 0.75;
            ctx.beginPath();
            ctx.fillStyle = `rgba(240,240,250,${alpha})`;
            ctx.arc(s.x, s.y, s.r * s.z * devicePixelRatio, 0, Math.PI * 2);
            ctx.fill();
            if (scrollBoost > 0.08) {
                ctx.strokeStyle = `rgba(240,240,250,${alpha * 0.45})`;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x, s.y - s.z * scrollBoost * 40 * devicePixelRatio);
                ctx.stroke();
            }
        }
        scrollBoost *= 0.92;
        raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener(
        'scroll',
        () => {
            scrollBoost = Math.min(1, scrollBoost + 0.12);
        },
        { passive: true }
    );

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else raf = requestAnimationFrame(draw);
    });
}

function initScrollCinema() {
    const screens = [...document.querySelectorAll('.sx-screen, .sx-pin')];
    const nav = document.querySelector('.sx-nav');
    const progress = $('sx-progress-bar');
    const stars = $('sx-stars');
    const starsFar = $('sx-stars-far');
    const nebula = $('sx-nebula');
    const horizon = $('sx-horizon');
    const glow = $('sx-glow');
    const pinCountdown = $('pin-countdown');
    const countdownEl = $('countdown-num');
    const countdownCaption = $('countdown-caption');
    const launchBar = $('launch-bar-fill');

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('is-inview');
            });
        },
        { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    screens.forEach((s) => observer.observe(s));
    document.querySelector('.sx-screen-hero')?.classList.add('is-inview');

    let ticking = false;
    let lastY = window.scrollY;

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const p = scrollY / max;
            const velocity = Math.min(1, Math.abs(scrollY - lastY) / 40);
            lastY = scrollY;

            if (progress) progress.style.width = `${(p * 100).toFixed(2)}%`;
            if (nav) nav.classList.toggle('is-solid', scrollY > 24);

            if (!state.reduceMotion) {
                if (stars) stars.style.transform = `translate3d(0, ${scrollY * 0.12}px, 0)`;
                if (starsFar) starsFar.style.transform = `translate3d(0, ${scrollY * 0.05}px, 0) scale(1.2)`;
                if (nebula) nebula.style.transform = `translate3d(${scrollY * 0.02}px, ${scrollY * 0.03}px, 0)`;
                // Keep horizon soft and fixed — translating it caused a hard color seam
                if (horizon) horizon.style.opacity = String(Math.max(0.35, 0.85 - p * 0.4));
                if (glow) glow.style.opacity = String(Math.max(0.2, 0.85 - p * 0.7 + velocity * 0.2));
            }

            // Sticky countdown scrub: T-10 → LIFTOFF + model reveal
            if (pinCountdown && countdownEl) {
                const cp = pinProgress(pinCountdown);
                const steps = ['T-10', 'T-8', 'T-6', 'T-4', 'T-3', 'T-2', 'T-1', 'LIFTOFF'];
                const idx = Math.min(steps.length - 1, Math.floor(cp * steps.length));
                if (idx !== state.lastCountdownStep) {
                    state.lastCountdownStep = idx;
                    countdownEl.textContent = steps[idx];
                    countdownEl.style.transform = `scale(${1.1 - idx * 0.012})`;
                    countdownEl.style.filter = idx === steps.length - 1 ? 'blur(0)' : `blur(${Math.max(0, 1.5 - cp * 2)}px)`;
                    updateLaunchVehicle(idx, idx === steps.length - 1);
                    if (countdownCaption) {
                        countdownCaption.textContent =
                            idx === steps.length - 1 ? t('fx_liftoff') : t('fx_vehicle');
                    }
                }
                if (launchBar) launchBar.style.width = `${(cp * 100).toFixed(1)}%`;
            }

            ticking = false;
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    initStarfield();

    const hint = $('scroll-hint');
    if (hint) {
        hint.addEventListener('click', () => {
            $('pin-countdown')?.scrollIntoView({ behavior: state.reduceMotion ? 'auto' : 'smooth' });
        });
    }
}

function buildMarquee() {
    const tracks = [$('sx-marquee-track'), $('sx-marquee-track-2')].filter(Boolean);
    if (!tracks.length) return;

    const names = state.models
        .filter((m) => m.rank != null)
        .slice(0, 20)
        .map((m) => m.name.replace(/^[^:]+:\s*/, ''));

    const fallbackA = ['LLM', 'VALUE', 'RANKINGS', 'OPENROUTER', 'DEEPSEEK', 'GPT', 'CLAUDE', 'GEMINI'];
    const fallbackB = ['INTEL', 'SPEED', 'PRICE', 'VALUE', 'TOKENS', 'LATENCY', 'CONTEXT', 'BLEND'];
    const listA = names.length ? names : fallbackA;
    const listB = names.length ? [...names].reverse() : fallbackB;

    const html = (list) => {
        const loop = [...list, ...list];
        return loop.map((n) => `<span>${escapeHtml(n)}</span>`).join('');
    };

    if (tracks[0]) tracks[0].innerHTML = html(listA);
    if (tracks[1]) tracks[1].innerHTML = html(listB);
}

function navigateStyle(style) {
    localStorage.setItem('ui-style', style);
    if (STYLE_PAGES[style]) {
        window.location.href = STYLE_PAGES[style];
        return;
    }
    window.location.href = 'index.html';
}

function initStyleSwitcher() {
    const select = $('style-select');
    if (!select) return;
    select.value = 'spacex';
    select.addEventListener('change', () => {
        const next = select.value;
        if (next === 'spacex') return;
        navigateStyle(next);
    });
}

function initTheme() {
    // SpaceX page is always black — no light theme
    document.documentElement.setAttribute('data-theme', 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = '#000000';
}

async function loadData() {
    const list = $('rankings-list');
    const podium = $('podium');
    if (list) list.innerHTML = `<div class="sx-empty">${t('loading')}</div>`;

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
        prepareLaunchModels();
        prepareDuelModels();
        buildMarquee();
        renderPodium();
        filterAndSort();
        // Refresh countdown vehicle if user is already in that section
        if (state.lastCountdownStep >= 0) {
            updateLaunchVehicle(state.lastCountdownStep, state.lastCountdownStep >= 7);
        }
    } catch (err) {
        console.error(err);
        if (list) list.innerHTML = `<div class="sx-empty">${t('error')}</div>`;
        if (podium) podium.innerHTML = `<div class="sx-empty">${t('error')}</div>`;
    }
}

function prepareLaunchModels() {
    // Ascend from lower ranks to #1 during countdown (pad → liftoff)
    state.launchModels = state.models
        .filter((m) => m.rank != null && m.value_score != null)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 8)
        .reverse();

    const queue = $('launch-queue');
    if (!queue) return;
    if (!state.launchModels.length) {
        queue.innerHTML = '';
        return;
    }
    queue.innerHTML = state.launchModels
        .map(
            (m, i) => `
        <button type="button" class="sx-queue-chip" data-idx="${i}" data-id="${escapeAttr(m.id)}" title="${escapeAttr(m.name)}">
            <span class="sx-queue-rank">#${m.rank}</span>
            <span class="sx-queue-name">${escapeHtml((m.name || '').replace(/^[^:]+:\s*/, ''))}</span>
        </button>`
        )
        .join('');

    queue.querySelectorAll('.sx-queue-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const id = chip.dataset.id;
            if (id) showDetail(id);
        });
    });
}

function updateLaunchVehicle(stepIdx, isLiftoff) {
    const card = $('launch-vehicle');
    const queue = $('launch-queue');
    if (!card) return;

    const models = state.launchModels;
    if (!models.length) {
        card.hidden = true;
        return;
    }

    const model = models[Math.min(stepIdx, models.length - 1)];
    card.hidden = false;
    card.classList.remove('is-swap');
    void card.offsetWidth;
    card.classList.add('is-swap');
    card.classList.toggle('is-liftoff', !!isLiftoff);

    const set = (id, text) => {
        const el = $(id);
        if (el) el.textContent = text;
    };

    set('launch-rank', `#${model.rank ?? '—'}`);
    set('launch-name', model.name || '—');
    set('launch-provider', model.provider_display || model.provider || '—');
    set('launch-intel', model.intelligence_score ?? '—');
    set('launch-speed', formatSpeed(model.speed));
    set('launch-value', formatValue(model.value_score));

    card.onclick = () => showDetail(model.id);

    if (queue) {
        queue.querySelectorAll('.sx-queue-chip').forEach((chip, i) => {
            chip.classList.toggle('is-active', i === Math.min(stepIdx, models.length - 1));
            chip.classList.toggle('is-done', i < stepIdx);
        });
    }
}

function prepareDuelModels() {
    const ranked = state.models.filter((m) => m.rank != null && m.pricing);
    if (!ranked.length) {
        state.duel = { speed: null, price: null, value: null };
        return;
    }

    const bySpeed = [...ranked]
        .filter((m) => m.speed != null)
        .sort((a, b) => (b.speed || 0) - (a.speed || 0))[0];
    const byPrice = [...ranked]
        .filter((m) => m.pricing?.blended != null)
        .sort((a, b) => (a.pricing.blended || Infinity) - (b.pricing.blended || Infinity))[0];
    const byValue = [...ranked]
        .filter((m) => m.value_score != null)
        .sort((a, b) => (b.value_score || 0) - (a.value_score || 0))[0];

    state.duel = { speed: bySpeed || null, price: byPrice || null, value: byValue || null };
    fillDuelCards();
}

function shortName(model) {
    return (model?.name || '—').replace(/^[^:]+:\s*/, '');
}

function fillDuelCards() {
    const { speed, price, value } = state.duel;
    const set = (id, text) => {
        const el = $(id);
        if (el) el.textContent = text;
    };

    if (speed) {
        set('duel-speed-name', shortName(speed));
        set('duel-speed-meta', speed.provider_display || speed.provider || '—');
        set('duel-speed-val', formatSpeed(speed.speed));
        const card = $('duel-speed');
        if (card) card.onclick = () => showDetail(speed.id);
    }
    if (price) {
        set('duel-price-name', shortName(price));
        set('duel-price-meta', price.provider_display || price.provider || '—');
        set('duel-price-val', formatPrice(price.pricing?.blended));
        const card = $('duel-price');
        if (card) card.onclick = () => showDetail(price.id);
    }
    if (value) {
        set('duel-value-name', shortName(value));
        set('duel-value-meta', value.provider_display || value.provider || '—');
        set('duel-value-val', formatValue(value.value_score));
        set('duel-value-intel', value.intelligence_score ?? '—');
        set('duel-value-speed', formatSpeed(value.speed));
        set('duel-value-price', formatPrice(value.pricing?.blended));
        const card = $('duel-winner');
        if (card) card.onclick = () => showDetail(value.id);
    }

    const caption = $('warp-caption');
    if (caption) caption.textContent = t('duel_hint_done');
}

function updateStats() {
    const meta = state.meta || {};
    const total = $('total-models');
    const ranked = $('ranked-models');
    const avgEl = $('avg-intelligence');
    const updated = $('last-updated');
    if (total) total.textContent = meta.total_models ?? state.models.length;
    if (ranked) ranked.textContent = meta.ranked_models ?? state.models.filter((m) => m.rank).length;
    const avg = meta.avg_intelligence;
    if (avgEl) avgEl.textContent = avg != null ? Number(avg).toFixed(1) : '—';
    if (updated && meta.updated_at) {
        const date = new Date(meta.updated_at);
        updated.textContent = date.toLocaleDateString(
            state.lang === 'zh' ? 'zh-CN' : 'en-US',
            { month: 'short', day: 'numeric' }
        );
    }
}

function renderPodium() {
    const podium = $('podium');
    if (!podium) return;
    const top3 = state.models
        .filter((m) => m.rank && m.rank <= 3 && m.value_score != null)
        .sort((a, b) => a.rank - b.rank);

    if (!top3.length) {
        podium.innerHTML = `<div class="sx-empty">${t('empty')}</div>`;
        return;
    }

    podium.innerHTML = top3
        .map(
            (m) => `
        <article class="sx-crew place-${m.rank}" data-id="${escapeAttr(m.id)}" tabindex="0" role="button">
            <div class="sx-crew-rank">#${m.rank} ${rankChangeHtml(m)}</div>
            <div class="sx-crew-name">${escapeHtml(m.name)}</div>
            <div class="sx-crew-provider">${escapeHtml(m.provider_display || m.provider)}</div>
            <div class="sx-crew-metrics">
                <div class="sx-crew-metric"><b>${m.intelligence_score ?? '—'}</b><span>${t('intel')}</span></div>
                <div class="sx-crew-metric"><b>${formatSpeed(m.speed)}</b><span>${t('speed')}</span></div>
                <div class="sx-crew-metric"><b>${formatValue(m.value_score)}</b><span>${t('value')}</span></div>
            </div>
        </article>`
        )
        .join('');

    podium.querySelectorAll('.sx-crew').forEach((el) => {
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
    if (!root) return;
    const count = state.filtered.length;
    const results = $('results-count');
    if (results) results.textContent = t('results').replace('{count}', count);

    if (!count) {
        root.innerHTML = `<div class="sx-empty">${t('empty')}</div>`;
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
            <div class="sx-row" data-id="${escapeAttr(m.id)}" data-metrics="${escapeAttr(metrics)}" tabindex="0" role="button">
                <div class="sx-row-rank ${topClass}">
                    ${m.rank ?? '—'}
                    ${rankChangeHtml(m)}
                </div>
                <div>
                    <div class="sx-row-name">${escapeHtml(m.name)}</div>
                    <div class="sx-row-meta">${escapeHtml(m.provider_display || m.provider)}</div>
                </div>
                <div class="sx-row-num">${m.intelligence_score ?? '—'}</div>
                <div class="sx-row-num">${formatSpeed(m.speed)} T/S</div>
                <div class="sx-row-num">${price}</div>
                <div class="sx-row-num value">${formatValue(m.value_score)}</div>
            </div>`;
        })
        .join('');

    root.querySelectorAll('.sx-row').forEach((el) => {
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
    if (!pager) return;
    if (total <= 1) {
        pager.innerHTML = '';
        return;
    }

    const buttons = [];
    buttons.push(
        `<button type="button" class="sx-page-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`
    );

    const windowSize = 5;
    let from = Math.max(1, state.page - Math.floor(windowSize / 2));
    let to = Math.min(total, from + windowSize - 1);
    from = Math.max(1, to - windowSize + 1);

    if (from > 1) {
        buttons.push(`<button type="button" class="sx-page-btn" data-page="1">1</button>`);
        if (from > 2) buttons.push(`<span class="sx-page-btn" style="border:none;opacity:.4">…</span>`);
    }

    for (let i = from; i <= to; i++) {
        buttons.push(
            `<button type="button" class="sx-page-btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`
        );
    }

    if (to < total) {
        if (to < total - 1) buttons.push(`<span class="sx-page-btn" style="border:none;opacity:.4">…</span>`);
        buttons.push(`<button type="button" class="sx-page-btn" data-page="${total}">${total}</button>`);
    }

    buttons.push(
        `<button type="button" class="sx-page-btn" data-page="${state.page + 1}" ${state.page === total ? 'disabled' : ''}>›</button>`
    );

    pager.innerHTML = buttons.join('');
    pager.querySelectorAll('button[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const p = Number(btn.dataset.page);
            if (p >= 1 && p <= total) {
                state.page = p;
                renderList();
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
        <div class="sx-detail-rank">#${model.rank ?? '—'} ${rankChangeHtml(model)}</div>
        <h2 class="sx-detail-title" id="modal-title">${escapeHtml(model.name)}</h2>
        <a class="sx-detail-id" href="${escapeAttr(openUrl)}" target="_blank" rel="noopener">${escapeHtml(model.id)}</a>
        <span class="sx-detail-provider">${escapeHtml(model.provider_display || model.provider)}</span>

        <div class="sx-detail-value">
            <span>${t('value')}</span>
            <strong>${formatValue(model.value_score)}</strong>
        </div>

        <div class="sx-detail-grid">
            <div class="sx-detail-cell"><span>${t('intel')}</span><b>${model.intelligence_score ?? '—'}</b></div>
            <div class="sx-detail-cell"><span>${t('speed')}</span><b>${formatSpeed(model.speed)} T/S</b></div>
            <div class="sx-detail-cell"><span>${t('ttft')}</span><b>${formatLatency(model.ttft)}</b></div>
            <div class="sx-detail-cell"><span>${t('context')}</span><b>${formatContext(model.context_length)}</b></div>
            <div class="sx-detail-cell"><span>${t('input')}</span><b>${formatPrice(pricing.prompt)}</b></div>
            <div class="sx-detail-cell"><span>${t('output')}</span><b>${formatPrice(pricing.completion)}</b></div>
            <div class="sx-detail-cell"><span>${t('blended')}</span><b>${formatPrice(pricing.blended)}</b></div>
            <div class="sx-detail-cell"><span>${t('channel')}</span><b><a href="${escapeAttr(channelUrl)}" target="_blank" rel="noopener">${escapeHtml(channel)}</a></b></div>
        </div>

        ${model.description ? `<p class="sx-detail-desc">${escapeHtml(model.description)}</p>` : ''}

        <a class="sx-cta" href="${escapeAttr(openUrl)}" target="_blank" rel="noopener">${t('open')}</a>
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
    const search = $('search-input');
    if (search) {
        search.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                state.query = e.target.value.trim();
                filterAndSort();
            }, 180);
        });
    }

    const sort = $('sort-select');
    if (sort) {
        sort.addEventListener('change', (e) => {
            state.sort = e.target.value;
            filterAndSort();
        });
    }

    $('lang-toggle')?.addEventListener('click', () => {
        state.lang = state.lang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('sx-lang', state.lang);
        applyI18n();
        updateStats();
        prepareLaunchModels();
        prepareDuelModels();
        renderPodium();
        renderList();
        if (state.lastCountdownStep >= 0) {
            updateLaunchVehicle(state.lastCountdownStep, state.lastCountdownStep >= 7);
            const caption = $('countdown-caption');
            if (caption) {
                caption.textContent =
                    state.lastCountdownStep >= 7 ? t('fx_liftoff') : t('fx_vehicle');
            }
        }
        state.lastWarpPhase = -1;
        fillDuelCards();
        const modal = $('detail-modal');
        if (modal && !modal.classList.contains('hidden') && modal.dataset.currentModel) {
            showDetail(modal.dataset.currentModel);
        }
    });

    $('modal-close')?.addEventListener('click', closeDetail);
    $('modal-backdrop')?.addEventListener('click', closeDetail);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetail();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();
    initTheme();
    initStyleSwitcher();
    initScrollCinema();
    initEvents();
    loadStars();
    loadData();
});
