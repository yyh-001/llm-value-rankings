#!/usr/bin/env python3
"""Fetch vendor coding-plan pricing & quotas and build the leaderboard JSON."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

sys.path.insert(0, str(Path(__file__).parent))

from fetch_data import (  # noqa: E402
    DEFAULT_CACHE_HIT_RATE,
    OFFICIAL_PRICING_CNY_PER_M,
    USD_TO_CNY,
    blend_token_price,
    cny_per_m_to_usd_per_m,
    effective_input_price,
    make_http_session,
)

OUTPUT_FILE = Path(__file__).parent.parent / "data" / "coding_plans.json"
CACHE_DIR = Path(__file__).parent / "_vendor_cache"
WEEKS_PER_MONTH = 52 / 12
USER_AGENT = (
    "LLM-Value-Rankings/1.0 (+https://yyh-001.github.io/llm-value-rankings/)"
)

# Fallback when a vendor page is temporarily unreachable (GitHub Actions).
VENDOR_SOURCES = {
    "opencode_go": "https://opencode.ai/docs/go.md",
    "glm_overview": "https://docs.bigmodel.cn/cn/coding-plan/overview.md",
    "glm_pricing": "https://www.bigmodel.cn/glm-coding",
    "kimi_k3_api": "https://platform.kimi.com/docs/pricing/chat-k3.md",
    "codex_pricing": "https://developers.openai.com/codex/pricing.md",
    "commandcode_goat": "https://commandcode.ai/docs/plans/goat",
}

# GPT Plus / Codex — credit rates per 1M tokens (OpenAI Codex rate card).
CODEX_CREDIT_RATES = {
    "gpt-5.6-sol": {"input": 125, "cache": 12.5, "output": 750},
    "gpt-5.6-luna": {"input": 25, "cache": 2.5, "output": 150},
}

# Plus plan local-message ranges per 5h (chatgpt.com/codex/pricing).
CODEX_PLUS_MSG_RANGE = {
    "gpt-5.6-sol": (15, 90),
    "gpt-5.6-luna": (50, 280),
}

# Kimi membership — tokens per CNY efficiency by tier (until Kimi publishes quotas).
KIMI_TOKENS_PER_CNY = {
    "kimi-k3-moderato-256k": 1_510_000,
    "kimi-k3-allegretto-256k": 3_760_000,
    "kimi-k3-allegro-256k": 3_200_000,
    "kimi-k3-allegretto-1m": 3_760_000,
    "kimi-k3-allegro-1m": 3_200_000,
}

KIMI_MEMBERSHIP_TIERS = [
    {"id": "kimi-k3-moderato-256k", "plan": "Moderato 256K", "monthly_cny": 99, "context_factor": 1.0},
    {"id": "kimi-k3-allegretto-256k", "plan": "Allegretto 256K", "monthly_cny": 199, "context_factor": 1.0},
    {"id": "kimi-k3-allegro-256k", "plan": "Allegro 256K", "monthly_cny": 699, "context_factor": 1.0},
    {"id": "kimi-k3-allegretto-1m", "plan": "Allegretto 1M", "monthly_cny": 199, "context_factor": 0.5},
    {"id": "kimi-k3-allegro-1m", "plan": "Allegro 1M", "monthly_cny": 699, "context_factor": 0.5},
]

PROVIDER_EQUIV = {
    "deepseek": {"deepseek"},
    "moonshot": {"moonshot", "moonshotai"},
    "zhipu": {"zhipu", "z-ai", "zai"},
    "openai": {"openai"},
}


def make_match(**kwargs: Any) -> Dict[str, Any]:
    return {key: value for key, value in kwargs.items() if value is not None}


def model_provider_key(model_id: str) -> str:
    return model_id.lstrip("~").split("/")[0].lower()


def model_slug(model_id: str) -> str:
    parts = model_id.lstrip("~").split("/", 1)
    return parts[-1].lower() if parts else model_id.lower()


def core_slug(model_id: str) -> str:
    slug = model_slug(model_id)
    slug = re.sub(r"-latest$", "", slug)
    slug = re.sub(r"-\d{4}$", "", slug)
    return slug


def provider_matches(model_prov: str, allowed: Optional[List[str]]) -> bool:
    if not allowed:
        return True
    allowed_set = set()
    for provider in allowed:
        allowed_set |= PROVIDER_EQUIV.get(provider, {provider})
    return model_prov in allowed_set


def slug_excluded(slug: str, match: Dict[str, Any]) -> bool:
    for pattern in match.get("exclude_slug_patterns") or []:
        if re.search(pattern, slug):
            return True
    return False


def resolve_target_models(plan: Dict[str, Any], models: List[Dict[str, Any]]) -> List[str]:
    """Map a coding plan onto model IDs from the live models list."""
    match = plan.get("match") or {}
    if not models:
        model_id = plan.get("model_id")
        return [model_id] if model_id else []

    family = match.get("model_family") or plan.get("model_id")
    matched: List[str] = []

    if family:
        fam_provider = model_provider_key(family)
        fam_core = core_slug(family)
        for model in models:
            model_id = model["id"]
            slug = model_slug(model_id)
            if model_provider_key(model_id) != fam_provider:
                continue
            if core_slug(model_id) != fam_core:
                continue
            if slug_excluded(slug, match):
                continue
            matched.append(model_id)

    slug_patterns = match.get("slug_patterns") or []
    if slug_patterns:
        for model in models:
            model_id = model["id"]
            slug = model_slug(model_id)
            if not provider_matches(model_provider_key(model_id), match.get("providers")):
                continue
            if not any(re.search(pattern, slug) for pattern in slug_patterns):
                continue
            if slug_excluded(slug, match):
                continue
            matched.append(model_id)

    rank_by_id = {m["id"]: m.get("rank") or 9999 for m in models}
    return sorted(set(matched), key=lambda mid: (rank_by_id.get(mid, 9999), mid))


MATCH_DS_V4_FLASH = make_match(
    model_family="deepseek/deepseek-v4-flash",
    exclude_slug_patterns=[r"vision"],
)

MATCH_KIMI_K3 = make_match(model_family="moonshotai/kimi-k3")

MATCH_GLM_5_CODING = make_match(
    providers=["z-ai", "zhipu"],
    slug_patterns=[r"glm-5(?:\.\d+)?$", r"^glm-5$"],
    exclude_slug_patterns=[r"5v", r"turbo"],
)


def fetch_kimi_membership_prices(html: str) -> Dict[str, float]:
    """Best-effort parse of Kimi membership monthly prices from help HTML."""
    defaults = {tier["id"]: tier["monthly_cny"] for tier in KIMI_MEMBERSHIP_TIERS}
    patterns = {
        "kimi-k3-moderato-256k": r"Moderato[^¥$]{0,80}¥\s*(\d+)",
        "kimi-k3-allegretto-256k": r"Allegretto[^¥$]{0,80}¥\s*(\d+)",
        "kimi-k3-allegro-256k": r"Allegro[^¥$]{0,80}¥\s*(\d+)",
    }
    prices = dict(defaults)
    for tier_id, pattern in patterns.items():
        match = re.search(pattern, html, re.I)
        if match:
            prices[tier_id] = float(match.group(1))
    for tier in KIMI_MEMBERSHIP_TIERS:
        if tier["plan"].endswith("1M"):
            base_id = tier["id"].replace("-1m", "-256k")
            if base_id in prices:
                prices[tier["id"]] = prices[base_id]
    return prices


def fetch_text(url: str, session: Optional[requests.Session] = None) -> Tuple[str, str]:
    """Fetch URL text with disk cache fallback."""
    cache_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", url.replace("https://", ""))[:120]
    cache_path = CACHE_DIR / f"{cache_name}.txt"

    http = session or make_http_session()
    try:
        response = http.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
        response.raise_for_status()
        text = response.text
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(text, encoding="utf-8")
        return text, url
    except Exception as exc:
        if cache_path.exists():
            print(f"  Warning: fetch failed for {url} ({exc}); using cache")
            return cache_path.read_text(encoding="utf-8"), f"cache:{cache_path.name}"
        raise


def round_cost(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(value, 1)


def cost_range(low: Optional[float], high: Optional[float]) -> Any:
    if low is None and high is None:
        return None
    if high is None or low == high:
        return round_cost(low)
    return [round_cost(low), round_cost(high)]


def subscription_cost_per_100m(monthly_cny: float, monthly_tokens: float) -> Optional[float]:
    if not monthly_cny or not monthly_tokens:
        return None
    return round(monthly_cny / (monthly_tokens / 1e8), 1)


def cost_per_100m_from_usd_rates(
    prompt_usd: float,
    cache_usd: Optional[float],
    completion_usd: float,
) -> float:
    prompt_eff = effective_input_price(prompt_usd, cache_usd, DEFAULT_CACHE_HIT_RATE)
    blended = blend_token_price(prompt_eff, completion_usd)
    return round(blended * 100, 1)


def cost_per_100m_from_cny_rates(
    prompt_cny: float,
    cache_cny: float,
    completion_cny: float,
) -> float:
    return cost_per_100m_from_usd_rates(
        cny_per_m_to_usd_per_m(prompt_cny),
        cny_per_m_to_usd_per_m(cache_cny),
        cny_per_m_to_usd_per_m(completion_cny),
    )


def parse_markdown_table_rows(markdown: str) -> List[List[str]]:
    rows = []
    for line in markdown.splitlines():
        line = line.strip()
        if not line.startswith("|") or line.startswith("| --") or "---" in line:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if cells and not all(set(cell) <= {"-"} for cell in cells):
            rows.append(cells)
    return rows


def parse_billion_token_range(text: str) -> Optional[Tuple[float, float]]:
    match = re.search(
        r"([\d.]+)\s*\\?~\s*([\d.]+)\s*亿",
        text.replace(",", ""),
    )
    if not match:
        return None
    return float(match.group(1)), float(match.group(2))


def parse_glm_plans(markdown: str, pricing_html: str) -> List[Dict[str, Any]]:
    tier_map = {
        "Lite": {"id": "glm-5-3-lite", "plan": "5.3 Lite"},
        "Pro": {"id": "glm-5-3-pro", "plan": "5.3 Pro"},
        "Max": {"id": "glm-5-3-max", "plan": "5.3 Max"},
    }
    prices = {}
    for tier in tier_map:
        match = re.search(rf"¥\s*(\d+)\s*/月", pricing_html)
        patterns = [
            rf"{tier}[^¥]{{0,80}}¥\s*(\d+)\s*/月",
            rf"¥\s*(\d+)\s*/月[^<]{{0,80}}{tier}",
            rf"{tier}[^0-9]{{0,40}}(\d{{3,4}})\s*/月",
        ]
        for pattern in patterns:
            match = re.search(pattern, pricing_html, re.I)
            if match:
                prices[tier] = float(match.group(1))
                break

    for amount, tier in ((118, "Lite"), (538, "Pro"), (1078, "Max")):
        if tier not in prices and str(amount) in pricing_html:
            prices[tier] = float(amount)

    if len(prices) < 3:
        prices = {"Lite": 118.0, "Pro": 538.0, "Max": 1078.0}

    cache_col = 2
    for row in parse_markdown_table_rows(markdown):
        if row and ("命中率" in row[0] or row[0] == "套餐"):
            for idx, cell in enumerate(row):
                if "95%" in cell:
                    cache_col = idx
            break

    token_rows = {}
    for row in parse_markdown_table_rows(markdown):
        if len(row) <= cache_col:
            continue
        tier = row[0].strip()
        if tier not in tier_map:
            continue
        parsed = parse_billion_token_range(row[cache_col])
        if parsed:
            token_rows[tier] = parsed

    plans = []
    for tier, meta in tier_map.items():
        weekly = token_rows.get(tier)
        monthly_cny = prices.get(tier)
        if not weekly or not monthly_cny:
            continue
        weekly_min_b, weekly_max_b = weekly
        monthly_min = weekly_min_b * 1e8 * WEEKS_PER_MONTH
        monthly_max = weekly_max_b * 1e8 * WEEKS_PER_MONTH
        plans.append(
            {
                "id": meta["id"],
                "type": "subscription",
                "provider": "zhipu",
                "provider_display": "GLM",
                "plan": meta["plan"],
                "badge": f"¥{int(monthly_cny)}",
                "cost_off_peak": subscription_cost_per_100m(monthly_cny, monthly_max),
                "cost_peak": subscription_cost_per_100m(monthly_cny, monthly_min),
                "monthly_cny": monthly_cny,
                "quota_tokens": {
                    "weekly_min": int(weekly_min_b * 1e8),
                    "weekly_max": int(weekly_max_b * 1e8),
                    "monthly_min": int(monthly_min),
                    "monthly_max": int(monthly_max),
                },
                "url": "https://www.bigmodel.cn/glm-coding",
                "pricing_source": "智谱 GLM Coding Plan 官方文档",
                "source_url": VENDOR_SOURCES["glm_overview"],
                "match": dict(MATCH_GLM_5_CODING),
            }
        )
    return plans


def parse_opencode_token_pattern(markdown: str, model_key: str) -> Optional[Dict[str, int]]:
    match = re.search(
        rf"-\s*{re.escape(model_key)}[^\n]*?(\d+)\s+input,\s*([\d,]+)\s+cached,\s*(\d+)\s+output",
        markdown,
        re.I,
    )
    if not match:
        return None
    return {
        "input": int(match.group(1)),
        "cached": int(match.group(2).replace(",", "")),
        "output": int(match.group(3)),
    }


def parse_opencode_model_row(markdown: str, model_label: str) -> Optional[Dict[str, Any]]:
    for row in parse_markdown_table_rows(markdown):
        if not row or model_label.lower() not in row[0].lower():
            continue
        nums = []
        for cell in row[1:]:
            cell = cell.replace("$", "").replace(",", "").strip()
            if cell in {"", "-"}:
                nums.append(None)
            else:
                try:
                    nums.append(float(cell))
                except ValueError:
                    nums.append(None)
        if len(nums) < 3:
            return None
        return {
            "input": nums[0],
            "output": nums[1],
            "cache_read": nums[2],
            "usage_budget": nums[4] if len(nums) > 4 else None,
        }
    return None


def parse_opencode_monthly_requests(markdown: str, model_label: str) -> Optional[int]:
    for row in parse_markdown_table_rows(markdown):
        if model_label.lower() in row[0].lower() and len(row) >= 4:
            try:
                return int(row[3].replace(",", ""))
            except ValueError:
                return None
    return None


def parse_opencode_monthly_sub_usd(markdown: str) -> float:
    """Parse subscription price from OpenCode Go docs (e.g. **$10/month**)."""
    match = re.search(r"\*\*\$(\d+(?:\.\d+)?)/month", markdown, re.I)
    if match:
        return float(match.group(1))
    match = re.search(r"\$(\d+(?:\.\d+)?)/month", markdown, re.I)
    if match:
        return float(match.group(1))
    return 10.0


def build_opencode_plans(markdown: str) -> List[Dict[str, Any]]:
    monthly_sub_usd = parse_opencode_monthly_sub_usd(markdown)
    monthly_cny = round(monthly_sub_usd * USD_TO_CNY, 2)
    plans = []

    flash_rates = parse_opencode_model_row(markdown, "DeepSeek V4 Flash (Off-Peak)")
    flash_peak = parse_opencode_model_row(markdown, "DeepSeek V4 Flash (Peak)")
    pattern = parse_opencode_token_pattern(markdown, "DeepSeek V4 Flash")
    monthly_requests = parse_opencode_monthly_requests(markdown, "DeepSeek V4 Flash")

    if flash_rates and pattern and monthly_requests:
        tokens_per_request = pattern["input"] + pattern["cached"] + pattern["output"]
        monthly_tokens = monthly_requests * tokens_per_request

        def plan_cost(request_scale: float = 1.0) -> Optional[float]:
            effective_tokens = monthly_requests * request_scale * tokens_per_request
            return subscription_cost_per_100m(monthly_cny, effective_tokens)

        plans.append(
            {
                "id": "opencode-go-ds-flash",
                "type": "subscription",
                "provider": "opencode",
                "provider_display": "OpenCode Go",
                "plan": "DS V4 Flash",
                "badge": f"${int(monthly_sub_usd)}/月",
                "cost_off_peak": plan_cost(1.0),
                "cost_peak": plan_cost(0.5) if flash_peak else None,
                "monthly_cny": monthly_cny,
                "monthly_usd": monthly_sub_usd,
                "quota_tokens": int(monthly_tokens),
                "url": "https://opencode.ai/go",
                "pricing_source": "OpenCode Go 官方文档",
                "source_url": VENDOR_SOURCES["opencode_go"],
                "note_zh": f"按官方 ${int(monthly_sub_usd)}/月 订阅价与 DS V4 Flash 月度请求量估算",
                "note_en": f"Estimated from ${int(monthly_sub_usd)}/mo subscription and DS V4 Flash monthly requests",
                "match": dict(MATCH_DS_V4_FLASH),
            }
        )

    return plans


def parse_commandcode_goat_monthly_price(html: str) -> float:
    match = re.search(r"\$(\d+(?:\.\d+)?)/month", html, re.I)
    if match:
        return float(match.group(1))
    match = re.search(r"Your \$(\d+) buys", html)
    if match:
        return float(match.group(1))
    return 10.0


def parse_commandcode_goat_token_pattern(html: str) -> Dict[str, int]:
    match = re.search(
        r"~(\d+)\s+fresh input tokens,\s*~([\d,]+)\s+cache-read tokens,\s*"
        r"and\s*~(\d+)-(\d+)\s+output tokens",
        html,
        re.I,
    )
    if match:
        return {
            "input": int(match.group(1)),
            "cached": int(match.group(2).replace(",", "")),
            "output": int(match.group(4)),
        }
    return {"input": 800, "cached": 50_000, "output": 200}


def parse_commandcode_goat_monthly_requests(html: str, model_label: str) -> Optional[int]:
    pattern = (
        rf"<tr><td>{re.escape(model_label)}</td>"
        r"<td>[\d,]+</td><td>[\d,]+</td><td>([\d,]+)</td></tr>"
    )
    match = re.search(pattern, html)
    if match:
        return int(match.group(1).replace(",", ""))
    return None


def parse_commandcode_goat_ds_flash_rates(html: str) -> Optional[Dict[str, Dict[str, float]]]:
    label = "DeepSeek V4 Flash (latest)"
    row_match = re.search(
        rf"{re.escape(label)}</td><td>\$([0-9.]+)</td><td>\$([0-9.]+)</td><td>\$([0-9.]+)</td>",
        html,
    )
    if row_match:
        off_peak = {
            "prompt": float(row_match.group(1)),
            "completion": float(row_match.group(2)),
            "cache_read": float(row_match.group(3)),
        }
    else:
        idx = html.find(label)
        if idx < 0:
            return None
        prices = re.findall(r"\$([0-9.]+)", html[idx : idx + 1200])
        if len(prices) < 3:
            return None
        off_peak = {
            "prompt": float(prices[0]),
            "completion": float(prices[1]),
            "cache_read": float(prices[2]),
        }

    peak = {key: value * 2 for key, value in off_peak.items()}
    return {"off_peak": off_peak, "peak": peak}


def build_commandcode_goat_plan(html: str) -> List[Dict[str, Any]]:
    model_label = "DeepSeek V4 Flash (latest)"
    monthly_usd = parse_commandcode_goat_monthly_price(html)
    monthly_requests = parse_commandcode_goat_monthly_requests(html, model_label)
    pattern = parse_commandcode_goat_token_pattern(html)
    rates = parse_commandcode_goat_ds_flash_rates(html)

    if not monthly_requests or not rates:
        return []

    tokens_per_request = pattern["input"] + pattern["cached"] + pattern["output"]
    monthly_tokens = monthly_requests * tokens_per_request
    monthly_cny = round(monthly_usd * USD_TO_CNY, 2)

    off_cost = subscription_cost_per_100m(monthly_cny, monthly_tokens)
    peak_requests = monthly_requests // 2
    peak_cost = subscription_cost_per_100m(monthly_cny, peak_requests * tokens_per_request)

    return [
        {
            "id": "commandcode-goat-ds-flash",
            "type": "subscription",
            "provider": "commandcode",
            "provider_display": "Command Code",
            "plan": "GOAT · DS V4 Flash",
            "badge": f"${int(monthly_usd)}",
            "cost_off_peak": off_cost,
            "cost_peak": peak_cost,
            "monthly_cny": monthly_cny,
            "monthly_usd": monthly_usd,
            "quota_tokens": int(monthly_tokens),
            "monthly_requests": monthly_requests,
            "tokens_per_request": tokens_per_request,
            "url": "https://commandcode.ai/docs/plans/goat",
            "pricing_source": "Command Code GOAT 官方文档",
            "source_url": VENDOR_SOURCES["commandcode_goat"],
            "note_zh": "按 GOAT $10/月、DS V4 Flash 官方月请求量与典型 Token 模式估算",
            "note_en": "From GOAT $10/mo, DS V4 Flash monthly requests, and typical token pattern",
            "match": dict(MATCH_DS_V4_FLASH),
        }
    ]


def credits_per_million(credit_rates: Dict[str, float]) -> float:
    input_eff = credit_rates["input"] * (1 - DEFAULT_CACHE_HIT_RATE) + credit_rates["cache"] * DEFAULT_CACHE_HIT_RATE
    return (3 * input_eff + credit_rates["output"]) / 4


def build_codex_plus_plans(markdown: str, models_index: Dict[str, Any]) -> List[Dict[str, Any]]:
    plus_usd = 20.0
    plus_cny = plus_usd * USD_TO_CNY
    plans = []

    for model_slug, (msg_low, msg_high) in CODEX_PLUS_MSG_RANGE.items():
        rates = CODEX_CREDIT_RATES[model_slug]
        credits_per_msg_low = credits_per_million(rates) * 0.01
        credits_per_msg_high = credits_per_million(rates) * 0.025
        windows_per_month = (24 / 5) * 30 / 4
        monthly_msgs_low = msg_low * windows_per_month
        monthly_msgs_high = msg_high * windows_per_month

        tokens_per_credit = 1e6 / credits_per_million(rates)
        monthly_tokens_low = monthly_msgs_low * credits_per_msg_low * tokens_per_credit
        monthly_tokens_high = monthly_msgs_high * credits_per_msg_high * tokens_per_credit

        model_name = "Luna Max" if "luna" in model_slug else "Sol"
        codex_match = make_match(
            model_family=f"openai/{model_slug}",
            exclude_slug_patterns=[r"-pro"],
        )
        openrouter = models_index.get(f"openai/{model_slug}")
        if openrouter:
            pricing = openrouter.get("pricing") or {}
            api_cost = cost_per_100m_from_usd_rates(
                pricing.get("prompt", 0),
                pricing.get("cache_read"),
                pricing.get("completion", 0),
            )
        else:
            api_cost = None

        plans.append(
            {
                "id": f"gpt-plus-{model_slug.split('-')[-1]}",
                "type": "subscription",
                "provider": "openai",
                "provider_display": "GPT Plus",
                "plan": model_name,
                "cost_off_peak": cost_range(
                    subscription_cost_per_100m(plus_cny, monthly_tokens_high),
                    subscription_cost_per_100m(plus_cny, monthly_tokens_low),
                ),
                "cost_peak": None,
                "monthly_cny": round(plus_cny, 2),
                "monthly_usd": plus_usd,
                "quota_tokens": {
                    "monthly_min": int(monthly_tokens_low),
                    "monthly_max": int(monthly_tokens_high),
                },
                "url": "https://chatgpt.com/codex/pricing",
                "pricing_source": "OpenAI Codex 官方定价",
                "source_url": VENDOR_SOURCES["codex_pricing"],
                "api_reference_cost_per_100m": api_cost,
                "note_zh": "按 Plus $20/月与 Codex 5 小时消息额度估算",
                "note_en": "Estimated from Plus $20/mo and Codex 5-hour message limits",
                "match": dict(codex_match),
            }
        )

    return plans


def parse_kimi_k3_api_rates(markdown: str) -> Optional[Dict[str, float]]:
    match = re.search(
        r'kimi-k3".*?¥([\d.]+)".*?¥([\d.]+)".*?¥([\d.]+)"',
        markdown,
        re.S,
    )
    if match:
        return {
            "cache_read": float(match.group(1)),
            "prompt": float(match.group(2)),
            "completion": float(match.group(3)),
        }
    for row in parse_markdown_table_rows(markdown):
        if row and "kimi-k3" in row[0].lower():
            prices = re.findall(r"¥\s*([\d.]+)", " ".join(row))
            if len(prices) >= 3:
                return {
                    "cache_read": float(prices[0]),
                    "prompt": float(prices[1]),
                    "completion": float(prices[2]),
                }
    return None


def estimate_kimi_membership_tokens(tier_id: str, monthly_cny: float, context_factor: float) -> int:
    tokens_per_cny = KIMI_TOKENS_PER_CNY.get(tier_id)
    if not tokens_per_cny:
        return 0
    return int(monthly_cny * tokens_per_cny * context_factor)


def build_kimi_plans(kimi_api_md: str, kimi_pricing_html: str) -> List[Dict[str, Any]]:
    rates = parse_kimi_k3_api_rates(kimi_api_md)
    plans = []

    if rates:
        api_cost = cost_per_100m_from_cny_rates(
            rates["prompt"], rates["cache_read"], rates["completion"]
        )
        plans.append(
            {
                "id": "kimi-k3-api",
                "type": "api",
                "provider": "moonshot",
                "provider_display": "Kimi K3",
                "plan": "API",
                "cost_off_peak": api_cost,
                "cost_peak": None,
                "url": "https://platform.moonshot.cn/docs/pricing/chat",
                "pricing_source": "Moonshot Kimi K3 官方 API",
                "source_url": VENDOR_SOURCES["kimi_k3_api"],
                "rates_cny_per_m": rates,
                "match": dict(MATCH_KIMI_K3),
            }
        )

        api_cost_per_token = api_cost / 1e8
        membership_prices = fetch_kimi_membership_prices(kimi_pricing_html)
        for tier in KIMI_MEMBERSHIP_TIERS:
            monthly_cny = membership_prices.get(tier["id"], tier["monthly_cny"])
            monthly_tokens = estimate_kimi_membership_tokens(
                tier["id"], monthly_cny, tier["context_factor"]
            )
            if not monthly_tokens:
                continue
            plans.append(
                {
                    "id": tier["id"],
                    "type": "subscription",
                    "provider": "moonshot",
                    "provider_display": "Kimi K3",
                    "plan": tier["plan"],
                    "badge": f"¥{int(monthly_cny)}",
                    "cost_off_peak": subscription_cost_per_100m(monthly_cny, monthly_tokens),
                    "cost_peak": None,
                    "monthly_cny": monthly_cny,
                    "quota_tokens": monthly_tokens,
                    "url": "https://www.kimi.com/code",
                    "pricing_source": "Kimi 会员定价 + 官方 API 价",
                    "source_url": "https://www.kimi.com/en/help/membership/membership-pricing",
                    "api_reference_cost_per_100m": api_cost,
                    "note_zh": "会员 Token 池未公开，按各档历史用量效率折算；月费尝试从帮助中心抓取",
                    "note_en": "Membership quota estimated; monthly price fetched when available",
                    "match": dict(MATCH_KIMI_K3),
                }
            )

    return plans


def build_deepseek_api_plans() -> List[Dict[str, Any]]:
    specs = [
        ("deepseek-v4-flash-0731", "deepseek/deepseek-v4-flash", "V4 Flash 0731"),
        ("deepseek-v4-pro-0813", "deepseek/deepseek-v4-pro", "V4 Pro 0813"),
    ]
    plans = []
    for plan_id, model_id, label in specs:
        pricing = OFFICIAL_PRICING_CNY_PER_M.get(model_id)
        if not pricing or "peak" not in pricing:
            continue
        off = pricing["off_peak"]
        peak = pricing["peak"]
        plans.append(
            {
                "id": plan_id,
                "type": "api",
                "provider": "deepseek",
                "provider_display": "DeepSeek",
                "plan": label,
                "model_id": model_id,
                "cost_off_peak": cost_per_100m_from_cny_rates(
                    off["prompt"], off["cache_read"], off["completion"]
                ),
                "cost_peak": cost_per_100m_from_cny_rates(
                    peak["prompt"], peak["cache_read"], peak["completion"]
                ),
                "url": pricing.get("source_url"),
                "pricing_source": pricing.get("source_label"),
                "source_url": pricing.get("source_url"),
                "match": make_match(model_family=model_id),
            }
        )
    return plans


def sort_key(plan: Dict[str, Any]) -> float:
    peak = plan.get("cost_peak")
    off = plan.get("cost_off_peak")
    if peak is None:
        if isinstance(off, list):
            return off[1]
        return off or float("inf")
    if isinstance(peak, list):
        return peak[1]
    return peak


def index_models(models: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {model["id"]: model for model in models}


def plan_target_models(plan: Dict[str, Any], models: List[Dict[str, Any]]) -> List[str]:
    return resolve_target_models(plan, models)


def supplier_sort_key(entry: Dict[str, Any]) -> float:
    peak = entry.get("cost_peak")
    off = entry.get("cost_off_peak")
    if peak is None:
        if isinstance(off, list):
            return off[1]
        return off or float("inf")
    if isinstance(peak, list):
        return peak[1]
    return peak


def build_by_model_index(
    plans: List[Dict[str, Any]],
    models: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    index: Dict[str, List[Dict[str, Any]]] = {}
    for plan in plans:
        plan["target_models"] = plan_target_models(plan, models)
        if not plan["target_models"]:
            print(f"  Warning: no models matched for plan {plan['id']}")
        entry = {
            "id": plan["id"],
            "provider": plan.get("provider"),
            "provider_display": plan.get("provider_display"),
            "plan": plan.get("plan"),
            "type": plan.get("type"),
            "badge": plan.get("badge"),
            "cost_off_peak": plan.get("cost_off_peak"),
            "cost_peak": plan.get("cost_peak"),
            "url": plan.get("url"),
            "pricing_source": plan.get("pricing_source"),
        }
        for model_id in plan["target_models"]:
            index.setdefault(model_id, []).append(dict(entry))

    for model_id, entries in index.items():
        entries.sort(key=supplier_sort_key)
        for idx, entry in enumerate(entries, start=1):
            entry["rank"] = idx
    return index


def build_coding_plans(models: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    session = make_http_session()
    sources = {}

    opencode_md, sources["opencode_go"] = fetch_text(VENDOR_SOURCES["opencode_go"], session)
    glm_md, sources["glm_overview"] = fetch_text(VENDOR_SOURCES["glm_overview"], session)
    glm_html, sources["glm_pricing"] = fetch_text(VENDOR_SOURCES["glm_pricing"], session)
    kimi_api_md, sources["kimi_k3_api"] = fetch_text(VENDOR_SOURCES["kimi_k3_api"], session)
    kimi_pricing_html, sources["kimi_membership"] = fetch_text(
        "https://www.kimi.com/en/help/membership/membership-pricing", session
    )
    commandcode_goat_html, sources["commandcode_goat"] = fetch_text(
        VENDOR_SOURCES["commandcode_goat"], session
    )

    try:
        codex_md, sources["codex_pricing"] = fetch_text(VENDOR_SOURCES["codex_pricing"], session)
    except Exception as exc:
        print(f"  Warning: Codex pricing fetch failed ({exc}); using OpenRouter model rates")
        codex_md = ""
        sources["codex_pricing"] = "fallback:openrouter"

    models_index = index_models(models or [])
    plans: List[Dict[str, Any]] = []
    plans.extend(build_opencode_plans(opencode_md))
    plans.extend(build_commandcode_goat_plan(commandcode_goat_html))
    plans.extend(build_codex_plus_plans(codex_md, models_index))
    plans.extend(build_kimi_plans(kimi_api_md, kimi_pricing_html))
    plans.extend(parse_glm_plans(glm_md, glm_html))
    plans.extend(build_deepseek_api_plans())

    plans.sort(key=sort_key)
    for idx, plan in enumerate(plans, start=1):
        plan["rank"] = idx

    by_model = build_by_model_index(plans, models or [])

    return {
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "methodology": {
            "unit": "display value per 100M tokens (≈ USD/M × 100, shown as ¥)",
            "cache_hit_rate": DEFAULT_CACHE_HIT_RATE,
            "token_mix": "3:1 input:output for API; subscription uses vendor quota",
            "sort_by": "peak cost ascending (flat-rate plans use off-peak only)",
            "usd_to_cny": USD_TO_CNY,
            "weeks_per_month": round(WEEKS_PER_MONTH, 3),
        },
        "sources": sources,
        "total_plans": len(plans),
        "by_model": by_model,
        "plans": plans,
    }


def save_coding_plans(payload: Dict[str, Any]) -> Path:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return OUTPUT_FILE


def main(models: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    print("Building coding plan leaderboard...")
    payload = build_coding_plans(models)
    path = save_coding_plans(payload)
    print(f"  Wrote {payload['total_plans']} plans to {path}")
    for plan in payload["plans"][:5]:
        print(f"    #{plan['rank']} {plan['provider_display']} · {plan['plan']}")
    return payload


if __name__ == "__main__":
    models = None
    models_file = Path(__file__).parent.parent / "data" / "models.json"
    if models_file.exists():
        with open(models_file, encoding="utf-8") as f:
            models = json.load(f).get("models", [])
    main(models)
