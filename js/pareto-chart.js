/**
 * Pareto frontier chart for top-ranked models (intelligence vs price).
 */
(function () {
    const TOP_N = 30;
    const LABEL_TOP_N = 10;
    const MIN_CHART_INTELLIGENCE = 30;
    const PADDING = { top: 36, right: 32, bottom: 58, left: 62 };
    const PADDING_MOBILE = { top: 40, right: 28, bottom: 72, left: 54 };
    const MOBILE_BREAKPOINT = 768;
    const TOP_RANK_COLORS = { 1: '#f0c14b', 2: '#c8c8d4', 3: '#cd7f32' };
    const USD_TO_CNY = 7.25;

    let chartModels = [];
    let chartOptions = {};
    let elements = {};

    function t(key) {
        return window.i18n?.t(key) || key;
    }

    function getModelChartPrice(model) {
        if (chartOptions.useMinChannelPrice && typeof window.getMinChannelPriceUsd === 'function') {
            return window.getMinChannelPriceUsd(model) ?? model.pricing?.blended ?? 0;
        }
        return model.pricing?.blended ?? 0;
    }

    function getModelChartRank(model, index) {
        if (chartOptions.useMinChannelPrice && typeof window.getAdjustedRawValueScore === 'function') {
            return index + 1;
        }
        return model.rank;
    }

    function getTopModels(allModels) {
        const pool = allModels
            .filter((m) => (
                m.rank != null
                && m.intelligence_score != null
                && m.intelligence_score >= MIN_CHART_INTELLIGENCE
            ));

        if (chartOptions.useMinChannelPrice && typeof window.getAdjustedRawValueScore === 'function') {
            return [...pool]
                .sort((a, b) => window.getAdjustedRawValueScore(b) - window.getAdjustedRawValueScore(a))
                .slice(0, TOP_N);
        }

        return pool
            .sort((a, b) => a.rank - b.rank)
            .slice(0, TOP_N);
    }

    function isMobile() {
        return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
    }

    function isZh() {
        return window.i18n?.currentLang === 'zh';
    }

    function getLayout(width, height) {
        const mobile = isMobile();
        return {
            mobile,
            width,
            height,
            padding: mobile ? PADDING_MOBILE : PADDING,
            xTickCount: mobile ? 4 : 5,
            yTickCount: mobile ? 4 : 5,
            dotScale: mobile ? 1.55 : 1,
            hitScale: mobile ? 1.65 : 1,
        };
    }

    function getContainerWidth() {
        if (!elements.wrap) return 720;
        const panel = elements.wrap.closest('.pareto-panel');
        const candidates = [
            elements.wrap.clientWidth,
            panel?.clientWidth ? panel.clientWidth - 48 : 0,
            elements.section?.clientWidth ? elements.section.clientWidth - 56 : 0,
        ];
        for (const w of candidates) {
            if (w > 0) return w;
        }
        return Math.min(1140, Math.max(480, window.innerWidth - 56));
    }

    function getChartSize() {
        const wrapW = getContainerWidth();
        const width = Math.max(320, wrapW);
        if (isMobile()) {
            return {
                width,
                height: Math.max(400, Math.min(520, width * 0.92)),
            };
        }
        return {
            width,
            height: Math.max(380, Math.min(500, width * 0.42)),
        };
    }

    function formatChartPrice(usd, withUnit) {
        const scale = typeof window.getPriceUnitScale === 'function' ? window.getPriceUnitScale() : 1;
        const suffix = typeof window.getPriceUnitSuffix === 'function' ? window.getPriceUnitSuffix() : '/M';
        const price = Number(usd) * scale;
        if (Number.isNaN(price)) return '—';
        if (isZh()) {
            const cny = price * USD_TO_CNY;
            let text;
            if (cny >= 100) text = `¥${cny.toFixed(1)}`;
            else if (cny >= 1) text = `¥${cny.toFixed(2)}`;
            else text = `¥${cny.toFixed(3)}`;
            return withUnit ? `${text}${suffix}` : text;
        }
        if (price < 1) return withUnit ? `$${price.toFixed(2)}${suffix}` : `$${price.toFixed(2)}`;
        if (price < 10) return withUnit ? `$${price.toFixed(1)}${suffix}` : `$${price.toFixed(1)}`;
        const rounded = `$${Math.round(price)}`;
        return withUnit ? `${rounded}${suffix}` : rounded;
    }

    function getPoint(model, index) {
        const price = getModelChartPrice(model);
        return {
            model,
            chartRank: getModelChartRank(model, index),
            x: Math.max(price, 0.001),
            y: model.intelligence_score,
            xLabel: formatChartPrice(price, true),
        };
    }

    function computeFrontier(points) {
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

    function scaleLog(value, min, max, rangeMin, rangeMax) {
        const logMin = Math.log10(Math.max(min, 0.001));
        const logMax = Math.log10(Math.max(max, 0.001));
        const logVal = Math.log10(Math.max(value, 0.001));
        if (logMax === logMin) return (rangeMin + rangeMax) / 2;
        return rangeMin + ((logVal - logMin) / (logMax - logMin)) * (rangeMax - rangeMin);
    }

    function scaleLinear(value, min, max, rangeMin, rangeMax) {
        if (max === min) return (rangeMin + rangeMax) / 2;
        return rangeMin + ((value - min) / (max - min)) * (rangeMax - rangeMin);
    }

    function shortName(name) {
        const cleaned = (name || '').replace(/^[^:]+:\s*/, '');
        return cleaned.length > 22 ? `${cleaned.slice(0, 20)}…` : cleaned;
    }

    function chartLabel(name, mobile) {
        const cleaned = (name || '').replace(/^[^:]+:\s*/, '');
        const max = mobile ? 11 : 15;
        return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
    }

    function pointLabelPosition(cx, cy, rank, onFrontier, index, pad, innerW, dotScale) {
        const isTop3 = rank <= 3;
        const rightZone = pad.left + innerW * 0.62;
        const anchor = cx >= rightZone ? 'end' : 'start';
        const x = cx >= rightZone ? cx - 7 : cx + 7;
        let y = cy - 10 * dotScale;

        if (isTop3) {
            y = cy + 18 * dotScale;
        } else if (onFrontier) {
            y = index % 2 === 1 ? cy + 14 * dotScale : cy - 10 * dotScale;
        } else {
            y = rank % 2 === 0 ? cy - 11 * dotScale : cy + 15 * dotScale;
        }

        return { x, y, anchor };
    }

    function collectLabeledPoints(points, frontier) {
        const entries = [];
        const seen = new Set();

        frontier.forEach((point, index) => {
            seen.add(point.model.id);
            entries.push({ point, onFrontier: true, index });
        });

        points
            .filter((p) => p.chartRank != null && p.chartRank <= LABEL_TOP_N)
            .sort((a, b) => a.chartRank - b.chartRank)
            .forEach((point) => {
                if (seen.has(point.model.id)) return;
                seen.add(point.model.id);
                entries.push({ point, onFrontier: false, index: point.chartRank });
            });

        return entries;
    }

    function shortChannelLabel(model) {
        if (!chartOptions.useMinChannelPrice) return '';
        if (typeof window.getChartPriceSupplierShortLabel === 'function') {
            return window.getChartPriceSupplierShortLabel(model, true) || '';
        }
        return '';
    }

    function renderPointLabels(points, frontier, layout, xScale, yScale, pad, innerW, dotScale) {
        return collectLabeledPoints(points, frontier).map(({ point, onFrontier, index }) => {
            const cx = xScale(point.x);
            const cy = yScale(point.y);
            const rank = point.chartRank;
            const { x, y, anchor } = pointLabelPosition(cx, cy, rank, onFrontier, index, pad, innerW, dotScale);
            const name = chartLabel(point.model.name, layout.mobile);
            const channel = shortChannelLabel(point.model);
            const nameY = channel && y < cy ? y - 9 * dotScale : y;
            const cls = onFrontier ? 'pareto-frontier-label' : 'pareto-frontier-label pareto-top-label';
            const channelTspan = channel
                ? `<tspan class="pareto-channel-label" x="${x.toFixed(1)}" dy="${(11 * dotScale).toFixed(1)}">${escapeHtml(channel)}</tspan>`
                : '';
            return `<text class="${cls}" x="${x.toFixed(1)}" y="${nameY.toFixed(1)}" text-anchor="${anchor}">${escapeHtml(name)}${channelTspan}</text>`;
        }).join('');
    }

    function rankColor(rank) {
        return TOP_RANK_COLORS[rank] || 'rgba(148, 163, 184, 0.75)';
    }

    function formatXTick(price) {
        return formatChartPrice(price, true);
    }

    function getXAxisLabel(mobile) {
        if (typeof window.getPriceUnitChartAxisLabel === 'function') {
            return window.getPriceUnitChartAxisLabel(mobile);
        }
        return t(mobile ? 'pareto_axis_price_short_m' : 'pareto_axis_price_m');
    }

    function logTicks(min, max, count) {
        const logMin = Math.log10(Math.max(min, 0.001));
        const logMax = Math.log10(Math.max(max, 0.001));
        if (logMax === logMin) return [min];
        return Array.from({ length: count }, (_, i) => {
            const t = i / (count - 1);
            return 10 ** (logMin + t * (logMax - logMin));
        });
    }

    function hideTooltip() {
        if (elements.tooltip) elements.tooltip.hidden = true;
    }

    function showTooltip(event, point) {
        if (!elements.tooltip) return;
        const m = point.model;
        const rank = point.chartRank ?? m.rank ?? '—';
        const supplierLabel = typeof window.getChartPriceSupplierLabel === 'function'
            ? window.getChartPriceSupplierLabel(m, chartOptions.useMinChannelPrice)
            : null;
        const supplierHtml = supplierLabel
            ? `<span class="pareto-tooltip-channel">${t('pricing_channel')}: ${escapeHtml(supplierLabel)}</span>`
            : '';
        elements.tooltip.innerHTML = `
            <strong>#${rank} ${escapeHtml(shortName(m.name))}</strong>
            <span>${t('th_intelligence')}: ${m.intelligence_score}</span>
            <span>${t('th_price')}: ${escapeHtml(point.xLabel)}</span>
            ${supplierHtml}
            <span class="pareto-tooltip-hint">${t('pareto_click_detail')}</span>
        `;
        elements.tooltip.hidden = false;
        const wrap = elements.wrap;
        const rect = wrap.getBoundingClientRect();
        const scrollLeft = wrap.scrollLeft || 0;
        const x = event.clientX - rect.left + scrollLeft + 12;
        const y = event.clientY - rect.top - 8;
        elements.tooltip.style.left = `${Math.min(x, wrap.scrollWidth - 200)}px`;
        elements.tooltip.style.top = `${Math.max(y, 8)}px`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderSvg(points, frontier, layout) {
        const { width, height, padding: pad, xTickCount, yTickCount, dotScale, hitScale } = layout;
        const innerW = width - pad.left - pad.right;
        const innerH = height - pad.top - pad.bottom;
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        const yPad = Math.max((yMax - yMin) * 0.1, 2);
        const yLo = yMin - yPad;
        const yHi = yMax + yPad;

        const xScale = (v) => scaleLog(v, xMin, xMax, pad.left, pad.left + innerW);
        const yScale = (v) => scaleLinear(v, yLo, yHi, pad.top + innerH, pad.top);
        const baseY = pad.top + innerH;

        const gridY = yTickCount;
        const gridLines = Array.from({ length: gridY + 1 }, (_, i) => {
            const yVal = yLo + ((yHi - yLo) * i) / gridY;
            const y = yScale(yVal);
            return `<line class="pareto-grid-line" x1="${pad.left}" y1="${y}" x2="${pad.left + innerW}" y2="${y}" />
                <text class="pareto-axis-tick" x="${pad.left - 10}" y="${y + 4}" text-anchor="end">${Math.round(yVal)}</text>`;
        }).join('');

        const xTicks = logTicks(xMin, xMax, xTickCount);
        const xLabelY = height - (layout.mobile ? 34 : 28);
        const xTickLines = xTicks.map((val) => {
            const x = xScale(val);
            return `<line class="pareto-grid-line pareto-grid-line-v" x1="${x}" y1="${pad.top}" x2="${x}" y2="${baseY}" />
                <text class="pareto-axis-tick pareto-axis-tick-x" x="${x}" y="${xLabelY}" text-anchor="middle">${formatXTick(val)}</text>`;
        }).join('');

        const frontierPath = frontier.length >= 2
            ? frontier.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ')
            : '';

        const frontierArea = frontier.length >= 2
            ? `${frontierPath} L ${xScale(frontier[frontier.length - 1].x).toFixed(1)} ${baseY} L ${xScale(frontier[0].x).toFixed(1)} ${baseY} Z`
            : '';

        const dots = points.map((p) => {
            const cx = xScale(p.x);
            const cy = yScale(p.y);
            const rank = p.chartRank;
            const onFrontier = frontier.includes(p);
            const isTop3 = rank <= 3;
            const color = isTop3 ? rankColor(rank) : (onFrontier ? '#38bdf8' : 'rgba(148, 163, 184, 0.55)');
            const baseDot = isTop3 ? 6.5 : (onFrontier ? 5 : (layout.mobile ? 4.5 : 3.5));
            const dotR = baseDot * dotScale;
            const hitR = 12 * hitScale;
            const badgeR = 8 * dotScale;
            const opacity = isTop3 || onFrontier ? 1 : (layout.mobile ? 0.82 : 0.72);
            const label = isTop3
                ? `<g class="pareto-rank-badge"><circle cx="${cx}" cy="${cy - 14 * dotScale}" r="${badgeR}" class="pareto-rank-badge-bg" /><text class="pareto-point-label" x="${cx}" y="${cy - 11 * dotScale}" text-anchor="middle">${rank}</text></g>`
                : '';
            return `
                <g class="pareto-point${onFrontier ? ' pareto-point-frontier' : ''}${isTop3 ? ' pareto-point-top3' : ''}" data-model-id="${escapeHtml(p.model.id)}" tabindex="0" role="button" aria-label="#${rank} ${escapeHtml(shortName(p.model.name))}" opacity="${opacity}">
                    <circle class="pareto-point-hit" cx="${cx}" cy="${cy}" r="${hitR}" fill="transparent" />
                    ${isTop3 ? `<circle class="pareto-point-glow" cx="${cx}" cy="${cy}" r="${dotR + 5}" fill="${color}" opacity="0.22" />` : ''}
                    <circle class="pareto-point-dot" cx="${cx}" cy="${cy}" r="${dotR}" fill="${color}" />
                    ${label}
                </g>
            `;
        }).join('');

        const pointLabels = renderPointLabels(points, frontier, layout, xScale, yScale, pad, innerW, dotScale);
        const modeBadge = chartOptions.useMinChannelPrice
            ? `<text class="pareto-mode-badge" x="${pad.left + innerW - 10}" y="${pad.top + 16}" text-anchor="end">${escapeHtml(t('pareto_min_channel_badge'))}</text>`
            : '';

        const xAxisLabel = getXAxisLabel(layout.mobile);
        const svgClass = layout.mobile ? 'pareto-svg pareto-svg-mobile' : 'pareto-svg';
        const svgSize = 'width="100%" height="auto" preserveAspectRatio="xMidYMid meet"';
        const frontierFilter = layout.mobile ? '' : ' filter="url(#pareto-glow)"';

        return `
            <svg class="${svgClass}" viewBox="0 0 ${width} ${height}" ${svgSize} role="img" aria-label="${escapeHtml(t('pareto_title'))}">
                <defs>
                    <linearGradient id="pareto-frontier-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#22d3ee" />
                        <stop offset="100%" stop-color="#818cf8" />
                    </linearGradient>
                    <linearGradient id="pareto-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="rgba(56, 189, 248, 0.14)" />
                        <stop offset="100%" stop-color="rgba(56, 189, 248, 0)" />
                    </linearGradient>
                    <filter id="pareto-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                <rect class="pareto-bg" x="${pad.left}" y="${pad.top}" width="${innerW}" height="${innerH}" rx="8" />
                ${gridLines}
                ${xTickLines}
                <line class="pareto-axis" x1="${pad.left}" y1="${baseY}" x2="${pad.left + innerW}" y2="${baseY}" />
                <line class="pareto-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${baseY}" />
                ${frontierArea ? `<path class="pareto-frontier-area" d="${frontierArea}" />` : ''}
                ${frontierPath ? `<path class="pareto-frontier" d="${frontierPath}"${frontierFilter} />` : ''}
                ${dots}
                <g class="pareto-point-labels" aria-hidden="true">${pointLabels}</g>
                <text class="pareto-axis-title" x="${pad.left + innerW / 2}" y="${height - 8}" text-anchor="middle">${escapeHtml(xAxisLabel)}</text>
                <text class="pareto-axis-title pareto-axis-title-y" x="18" y="${pad.top + innerH / 2}" text-anchor="middle" transform="rotate(-90 18 ${pad.top + innerH / 2})">${escapeHtml(t('pareto_axis_intelligence'))}</text>
                <text class="pareto-hint-corner" x="${pad.left + 10}" y="${pad.top + 16}" text-anchor="start">${escapeHtml(t('pareto_better_corner_price'))}</text>
                ${modeBadge}
            </svg>
        `;
    }

    function bindPointEvents() {
        if (!elements.wrap) return;
        elements.wrap.querySelectorAll('.pareto-point').forEach((node) => {
            const modelId = node.dataset.modelId;
            const model = chartModels.find((m) => m.id === modelId);
            if (!model) return;
            const point = getPoint(model, chartModels.indexOf(model));

            node.addEventListener('mouseenter', (e) => showTooltip(e, point));
            node.addEventListener('mousemove', (e) => showTooltip(e, point));
            node.addEventListener('mouseleave', hideTooltip);
            node.addEventListener('touchstart', (e) => {
                if (e.touches[0]) showTooltip(e.touches[0], point);
            }, { passive: true });
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
        if (!elements.section || !chartModels.length || !elements.wrap || !elements.canvas) return;

        elements.section.hidden = false;

        const points = chartModels.map((m, index) => getPoint(m, index));
        const frontier = computeFrontier(points);
        const { width, height } = getChartSize();
        const layout = getLayout(width, height);

        elements.wrap.classList.toggle('is-mobile', layout.mobile);
        if (elements.scrollHint) {
            elements.scrollHint.hidden = true;
        }
        elements.canvas.style.minWidth = '';
        elements.canvas.innerHTML = renderSvg(points, frontier, layout);
        bindPointEvents();
        if (elements.minChannelLegend) {
            elements.minChannelLegend.hidden = !chartOptions.useMinChannelPrice;
        }
    }

    function init() {
        elements.section = document.getElementById('pareto-section');
        elements.wrap = document.getElementById('pareto-chart-wrap');
        elements.canvas = document.getElementById('pareto-chart');
        elements.tooltip = document.getElementById('pareto-tooltip');
        elements.scrollHint = document.getElementById('pareto-scroll-hint');
        elements.minChannelLegend = document.getElementById('pareto-min-channel-legend');

        if (!elements.section) return;

        elements.wrap?.addEventListener('mouseleave', hideTooltip);
        let resizeFrame = 0;
        if (elements.wrap && typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => {
                if (!chartModels.length) return;
                cancelAnimationFrame(resizeFrame);
                resizeFrame = requestAnimationFrame(() => paint());
            });
            observer.observe(elements.wrap);
        }
        window.addEventListener('resize', () => {
            if (chartModels.length) paint();
        });
    }

    function render(allModels, options = {}) {
        if (!elements.section) init();
        chartOptions = options;
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
