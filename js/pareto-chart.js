/**
 * Pareto frontier chart for top-ranked models (intelligence vs price / speed).
 * Inspired by Artificial Analysis intelligence comparison; data from local models.json.
 */
(function () {
    const TOP_N = 10;
    const PADDING = { top: 28, right: 28, bottom: 52, left: 56 };
    const RANK_COLORS = ['#f0c14b', '#c8c8d4', '#cd7f32', '#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#60a5fa', '#94a3b8'];

    let activeMode = 'price';
    let chartModels = [];
    let elements = {};

    function t(key) {
        return window.i18n?.t(key) || key;
    }

    function toAaSlug(modelId) {
        const part = (modelId || '').split('/').pop() || modelId;
        return part.toLowerCase().replace(/\./g, '-');
    }

    function buildAaUrl(models) {
        const slugs = models.map((m) => toAaSlug(m.id)).join(',');
        const lang = window.i18n?.currentLang === 'zh' ? '/zh' : '';
        return `https://artificialanalysis.ai${lang}?models=${encodeURIComponent(slugs)}#intelligence-comparison-tabs`;
    }

    function getTopModels(allModels) {
        return allModels
            .filter((m) => m.rank != null && m.intelligence_score != null)
            .sort((a, b) => a.rank - b.rank)
            .slice(0, TOP_N);
    }

    function getPoint(model, mode) {
        if (mode === 'speed') {
            return {
                model,
                x: model.speed || 0,
                y: model.intelligence_score,
                xLabel: `${model.speed ?? '—'} tok/s`,
            };
        }
        const price = model.pricing?.blended ?? 0;
        return {
            model,
            x: Math.max(price, 0.001),
            y: model.intelligence_score,
            xLabel: `$${price.toFixed(2)}/M`,
        };
    }

    function computeFrontier(points, mode) {
        if (!points.length) return [];

        if (mode === 'price') {
            const sorted = [...points].sort((a, b) => a.x - b.x);
            const frontier = [];
            let maxY = -Infinity;
            for (const p of sorted) {
                if (p.y > maxY) {
                    frontier.push(p);
                    maxY = p.y;
                }
            }
            return frontier;
        }

        const sorted = [...points].sort((a, b) => b.x - a.x);
        const frontier = [];
        let maxY = -Infinity;
        for (const p of sorted) {
            if (p.y > maxY) {
                frontier.push(p);
                maxY = p.y;
            }
        }
        return frontier.sort((a, b) => a.x - b.x);
    }

    function scaleLinear(value, min, max, rangeMin, rangeMax) {
        if (max === min) return (rangeMin + rangeMax) / 2;
        return rangeMin + ((value - min) / (max - min)) * (rangeMax - rangeMin);
    }

    function scaleLog(value, min, max, rangeMin, rangeMax) {
        const logMin = Math.log10(Math.max(min, 0.001));
        const logMax = Math.log10(Math.max(max, 0.001));
        const logVal = Math.log10(Math.max(value, 0.001));
        if (logMax === logMin) return (rangeMin + rangeMax) / 2;
        return rangeMin + ((logVal - logMin) / (logMax - logMin)) * (rangeMax - rangeMin);
    }

    function shortName(name) {
        const cleaned = (name || '').replace(/^[^:]+:\s*/, '');
        return cleaned.length > 22 ? `${cleaned.slice(0, 20)}…` : cleaned;
    }

    function hideTooltip() {
        if (elements.tooltip) {
            elements.tooltip.hidden = true;
        }
    }

    function showTooltip(event, point) {
        if (!elements.tooltip) return;
        const m = point.model;
        const rank = m.rank ?? '—';
        elements.tooltip.innerHTML = `
            <strong>#${rank} ${escapeHtml(shortName(m.name))}</strong>
            <span>${t('th_intelligence')}: ${m.intelligence_score}</span>
            <span>${activeMode === 'price' ? t('th_price') : t('th_speed')}: ${escapeHtml(point.xLabel)}</span>
            <span class="pareto-tooltip-hint">${t('pareto_click_detail')}</span>
        `;
        elements.tooltip.hidden = false;
        const wrap = elements.wrap.getBoundingClientRect();
        const x = event.clientX - wrap.left + 12;
        const y = event.clientY - wrap.top - 8;
        elements.tooltip.style.left = `${Math.min(x, wrap.width - 200)}px`;
        elements.tooltip.style.top = `${Math.max(y, 8)}px`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderSvg(points, frontier, width, height, mode) {
        const innerW = width - PADDING.left - PADDING.right;
        const innerH = height - PADDING.top - PADDING.bottom;
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        const yPad = Math.max((yMax - yMin) * 0.12, 2);
        const yLo = yMin - yPad;
        const yHi = yMax + yPad;

        const xScale = mode === 'price'
            ? (v) => scaleLog(v, xMin, xMax, PADDING.left, PADDING.left + innerW)
            : (v) => scaleLinear(v, xMin, xMax, PADDING.left, PADDING.left + innerW);
        const yScale = (v) => scaleLinear(v, yLo, yHi, PADDING.top + innerH, PADDING.top);

        const cornerHint = mode === 'price' ? t('pareto_better_corner_price') : t('pareto_better_corner_speed');

        const gridY = 4;
        const gridLines = Array.from({ length: gridY + 1 }, (_, i) => {
            const yVal = yLo + ((yHi - yLo) * i) / gridY;
            const y = yScale(yVal);
            return `<line class="pareto-grid-line" x1="${PADDING.left}" y1="${y}" x2="${PADDING.left + innerW}" y2="${y}" />
                <text class="pareto-axis-tick" x="${PADDING.left - 8}" y="${y + 4}" text-anchor="end">${Math.round(yVal)}</text>`;
        }).join('');

        const frontierPath = frontier.length >= 2
            ? frontier.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ')
            : '';

        const dots = points.map((p, i) => {
            const cx = xScale(p.x);
            const cy = yScale(p.y);
            const color = RANK_COLORS[i] || RANK_COLORS[RANK_COLORS.length - 1];
            const onFrontier = frontier.includes(p);
            return `
                <g class="pareto-point${onFrontier ? ' pareto-point-frontier' : ''}" data-model-id="${escapeHtml(p.model.id)}" tabindex="0" role="button" aria-label="${escapeHtml(shortName(p.model.name))}">
                    <circle class="pareto-point-hit" cx="${cx}" cy="${cy}" r="14" fill="transparent" />
                    <circle class="pareto-point-dot" cx="${cx}" cy="${cy}" r="${onFrontier ? 7 : 5.5}" fill="${color}" stroke="var(--bg-primary)" stroke-width="2" />
                    <text class="pareto-point-label" x="${cx}" y="${cy - 12}" text-anchor="middle">${p.model.rank}</text>
                </g>
            `;
        }).join('');

        return `
            <svg class="pareto-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeHtml(t('pareto_title'))}">
                <rect class="pareto-bg" x="${PADDING.left}" y="${PADDING.top}" width="${innerW}" height="${innerH}" rx="2" />
                ${gridLines}
                <line class="pareto-axis" x1="${PADDING.left}" y1="${PADDING.top + innerH}" x2="${PADDING.left + innerW}" y2="${PADDING.top + innerH}" />
                <line class="pareto-axis" x1="${PADDING.left}" y1="${PADDING.top}" x2="${PADDING.left}" y2="${PADDING.top + innerH}" />
                ${frontierPath ? `<path class="pareto-frontier" d="${frontierPath}" fill="none" />` : ''}
                ${dots}
                <text class="pareto-axis-title" x="${PADDING.left + innerW / 2}" y="${height - 12}" text-anchor="middle">${escapeHtml(xAxisLabel)}</text>
                <text class="pareto-axis-title pareto-axis-title-y" x="16" y="${PADDING.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 16 ${PADDING.top + innerH / 2})">${escapeHtml(yAxisLabel)}</text>
                <text class="pareto-hint-corner" x="${mode === 'price' ? PADDING.left + 4 : PADDING.left + innerW - 4}" y="${PADDING.top + 14}" text-anchor="${mode === 'price' ? 'start' : 'end'}">${escapeHtml(mode === 'price' ? t('pareto_better_corner_price') : t('pareto_better_corner_speed'))}</text>
            </svg>
        `;
    }

    function bindPointEvents() {
        elements.wrap.querySelectorAll('.pareto-point').forEach((node) => {
            const modelId = node.dataset.modelId;
            const point = chartModels.find((p) => p.model.id === modelId);
            if (!point) return;

            node.addEventListener('mouseenter', (e) => showTooltip(e, point));
            node.addEventListener('mousemove', (e) => showTooltip(e, point));
            node.addEventListener('mouseleave', hideTooltip);
            node.addEventListener('click', () => {
                hideTooltip();
                document.dispatchEvent(new CustomEvent('pareto-model-select', { detail: { modelId } }));
            });
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.dispatchEvent(new CustomEvent('pareto-model-select', { detail: { modelId } }));
                }
            });
        });
    }

    function paint() {
        if (!elements.section || !chartModels.length) return;

        const points = chartModels.map((m) => getPoint(m, activeMode));
        const frontier = computeFrontier(points, activeMode);
        const width = Math.min(920, elements.wrap.clientWidth || 920);
        const height = Math.max(320, Math.min(400, width * 0.45));

        elements.canvas.innerHTML = renderSvg(points, frontier, width, height, activeMode);
        bindPointEvents();

        if (elements.aaLink) {
            elements.aaLink.href = buildAaUrl(chartModels);
        }

        elements.section.hidden = false;
    }

    function setMode(mode) {
        activeMode = mode;
        elements.tabs?.querySelectorAll('[data-pareto-mode]').forEach((btn) => {
            const isActive = btn.dataset.paretoMode === mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        paint();
    }

    function init() {
        elements.section = document.getElementById('pareto-section');
        elements.wrap = document.getElementById('pareto-chart-wrap');
        elements.canvas = document.getElementById('pareto-chart');
        elements.tooltip = document.getElementById('pareto-tooltip');
        elements.tabs = document.getElementById('pareto-tabs');
        elements.aaLink = document.getElementById('pareto-aa-link');

        if (!elements.section) return;

        elements.tabs?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-pareto-mode]');
            if (!btn) return;
            setMode(btn.dataset.paretoMode);
        });

        elements.wrap?.addEventListener('mouseleave', hideTooltip);
        window.addEventListener('resize', () => {
            if (chartModels.length) paint();
        });
    }

    function render(allModels) {
        if (!elements.section) init();
        chartModels = getTopModels(allModels || []);
        if (!chartModels.length) {
            if (elements.section) elements.section.hidden = true;
            return;
        }
        paint();
    }

    function refreshI18n() {
        if (chartModels.length) paint();
    }

    window.ParetoChart = { render, refreshI18n };
    document.addEventListener('DOMContentLoaded', init);
})();
