/**
 * Coding Plan cost leaderboard
 */

const CONFIG = {
    DATA_URL: 'data/coding_plans.json',
};

const I18N = {
    zh: {
        nav_models: '模型性价比',
        nav_plans: 'Coding Plan',
        eyebrow: 'Coding Token 成本排行榜',
        title: 'AI 编程套餐\n每亿 Token 要花多少钱？',
        meta_unit: '单位：人民币 / 每 1 亿 Token',
        meta_cache: '统一折算：Cache 命中率 95%',
        meta_sort: '按高峰价格从低到高排序',
        board_title: '排行榜',
        th_rank: '排名',
        th_plan: '方案',
        th_off: '低峰 / 最省',
        th_peak: '高峰 / 常规',
        loading: '加载中…',
        error: '数据加载失败',
        cheapest: '最便宜',
        runner_up: '次低',
        notes_title: '说明',
        note_dash: '「—」表示该方案无单独高峰定价',
        note_kimi: 'Kimi 256K 与 1M 上下文版本分开列出',
        note_flat: 'GPT Plus、Kimi 等订阅制方案按套餐额度折算有效单价',
        note_api: 'DeepSeek API 使用官方高峰/低峰刊例价',
        note_models: '想看模型综合能力排名？<a href="index.html">前往模型性价比榜 →</a>',
        footer_data: '数据可审计 · 开源可复现',
        updated: '更新于 {date}',
        approx: '≈',
        lang_btn: 'EN',
    },
    en: {
        nav_models: 'Model Rankings',
        nav_plans: 'Coding Plans',
        eyebrow: 'Coding Token Cost Leaderboard',
        title: 'AI Coding Plans\nCost per 100M Tokens',
        meta_unit: 'Unit: CNY / 100M tokens',
        meta_cache: 'Assumes 95% cache hit rate',
        meta_sort: 'Sorted by peak cost (low to high)',
        board_title: 'Leaderboard',
        th_rank: 'Rank',
        th_plan: 'Plan',
        th_off: 'Off-peak / Best',
        th_peak: 'Peak / Regular',
        loading: 'Loading…',
        error: 'Failed to load data',
        cheapest: 'Cheapest',
        runner_up: 'Runner-up',
        notes_title: 'Notes',
        note_dash: '「—」 means no separate peak pricing',
        note_kimi: 'Kimi 256K and 1M context tiers listed separately',
        note_flat: 'Subscription plans priced by included monthly quota',
        note_api: 'DeepSeek API uses official peak/off-peak list rates',
        note_models: 'Looking for model value rankings? <a href="index.html">Go to model leaderboard →</a>',
        footer_data: 'Auditable data · Open source',
        updated: 'Updated {date}',
        approx: '≈',
        lang_btn: '中',
    },
};

let lang = 'zh';

function t(key) {
    return I18N[lang][key] || key;
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

function initI18n() {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'zh') lang = saved;

    applyI18n();
    const label = document.getElementById('lang-label');
    if (label) label.textContent = t('lang_btn');

    document.getElementById('lang-toggle')?.addEventListener('click', () => {
        lang = lang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('lang', lang);
        applyI18n();
        if (label) label.textContent = t('lang_btn');
        if (window.__plansData) renderPlans(window.__plansData);
    });
}

function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        if (key === 'title') {
            el.innerHTML = text.replace('\n', '<br>');
        } else if (key === 'note_models') {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
    });
}

function formatCost(value) {
    if (value == null) return '<span class="cost-dash">—</span>';
    if (Array.isArray(value)) {
        return `<span class="cost-value">${t('approx')} ¥${value[0]} – ${value[1]}</span>`;
    }
    return `<span class="cost-value">${t('approx')} ¥${value}</span>`;
}

function planLabel(plan) {
    const parts = [plan.provider_display, plan.plan];
    if (plan.badge) parts.push(`(${plan.badge})`);
    return parts.filter(Boolean).join(' · ');
}

function providerInitial(provider) {
    const map = {
        opencode: 'OC',
        openai: 'AI',
        moonshot: 'K',
        deepseek: 'DS',
        zhipu: 'GLM',
    };
    return map[provider] || provider.slice(0, 2).toUpperCase();
}

function renderRow(plan) {
    const rankClass = plan.rank <= 2 ? `rank-${plan.rank}` : '';
    const url = plan.url ? `href="${plan.url}" target="_blank" rel="noopener"` : '';
    const linkOpen = plan.url ? `<a class="plan-cell" ${url}>` : '<div class="plan-cell">';
    const linkClose = plan.url ? '</a>' : '</div>';

    return `
        <tr class="${rankClass}">
            <td class="col-rank">
                <span class="rank-badge ${rankClass}">${plan.rank}</span>
            </td>
            <td class="col-plan">
                ${linkOpen}
                    <span class="plan-icon ${plan.provider}">${providerInitial(plan.provider)}</span>
                    <span>
                        <span class="plan-name">${plan.provider_display}</span>
                        <span class="plan-sub">${plan.plan}${plan.badge ? ` · ${plan.badge}` : ''}</span>
                    </span>
                ${linkClose}
            </td>
            <td class="col-off">${formatCost(plan.cost_off_peak)}</td>
            <td class="col-peak">${formatCost(plan.cost_peak)}</td>
        </tr>
    `;
}

function renderCard(plan) {
    const rankClass = plan.rank <= 2 ? `rank-${plan.rank}` : '';
    return `
        <article class="plan-card ${rankClass}">
            <div class="plan-card-head">
                <span class="rank-badge ${rankClass}">${plan.rank}</span>
                <span class="plan-icon ${plan.provider}">${providerInitial(plan.provider)}</span>
                <div>
                    <div class="plan-name">${plan.provider_display}</div>
                    <div class="plan-sub">${plan.plan}${plan.badge ? ` · ${plan.badge}` : ''}</div>
                </div>
            </div>
            <div class="plan-card-costs">
                <div class="plan-card-cost">
                    <span>${t('th_off')}</span>
                    ${formatCost(plan.cost_off_peak)}
                </div>
                <div class="plan-card-cost">
                    <span>${t('th_peak')}</span>
                    ${formatCost(plan.cost_peak)}
                </div>
            </div>
        </article>
    `;
}

function renderSummary(plans) {
    const section = document.getElementById('plans-summary');
    const cheapest = document.getElementById('summary-cheapest');
    const runnerUp = document.getElementById('summary-runner-up');
    if (!section || !plans.length) return;

    section.hidden = false;
    if (cheapest) cheapest.textContent = planLabel(plans[0]);
    if (runnerUp && plans[1]) runnerUp.textContent = planLabel(plans[1]);
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function renderPlans(data) {
    const plans = data.plans || [];
    const body = document.getElementById('plans-body');
    const cards = document.getElementById('plans-cards');
    const updated = document.getElementById('last-updated');

    if (updated) {
        updated.textContent = t('updated').replace('{date}', formatDate(data.updated_at));
    }

    if (!plans.length) {
        body.innerHTML = `<tr><td colspan="4" class="plans-loading">${t('error')}</td></tr>`;
        return;
    }

    body.innerHTML = plans.map(renderRow).join('');
    if (cards) cards.innerHTML = plans.map(renderCard).join('');
    renderSummary(plans);
}

async function loadData() {
    try {
        const res = await fetch(CONFIG.DATA_URL);
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        window.__plansData = data;
        renderPlans(data);
    } catch (err) {
        console.error(err);
        const body = document.getElementById('plans-body');
        if (body) {
            body.innerHTML = `<tr><td colspan="4" class="plans-loading">${t('error')}</td></tr>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initI18n();
    loadData();
});
