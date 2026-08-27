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
    USD_TO_CNY,
    agent_blended_price,
    get_agent_token_pattern,
    make_http_session,
    time_weighted_cny_rates,
)

OUTPUT_FILE = Path(__file__).parent.parent / "data" / "coding_plans.json"
CACHE_DIR = Path(__file__).parent / "_vendor_cache"
WEEKS_PER_MONTH = 52 / 12
DEFAULT_TOKEN_PATTERN = {"input": 800, "cached": 50_000, "output": 200}
# Subscription amortization ignores peak/off-peak; apply a flat uplift for coding plans.
SUBSCRIPTION_COST_BUFFER = 1.5
OPENCODE_GO_COST_BUFFER = SUBSCRIPTION_COST_BUFFER

# DeepSeek official API (shown in channel pricing, not main OpenRouter leaderboard price).
DEEPSEEK_OFFICIAL_CNY_PER_M = {
    "deepseek/deepseek-v4-flash": {
        "peak": {"prompt": 3.0, "cache_read": 0.10, "completion": 9.0},
        "off_peak": {"prompt": 1.5, "cache_read": 0.05, "completion": 4.5},
        "source_label": "DeepSeek 官方 API",
        "source_url": "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
        "plan_label": "V4 Flash",
    },
    "deepseek/deepseek-v4-pro": {
        "peak": {"prompt": 9.0, "cache_read": 0.30, "completion": 27.0},
        "off_peak": {"prompt": 4.5, "cache_read": 0.15, "completion": 13.5},
        "source_label": "DeepSeek 官方 API",
        "source_url": "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
        "plan_label": "V4 Pro",
    },
}
USER_AGENT = (
    "LLM-Value-Rankings/1.0 (+https://yyh-001.github.io/llm-value-rankings/)"
)

# Fallback when a vendor page is temporarily unreachable (GitHub Actions).
VENDOR_SOURCES = {
    "opencode_go": "https://opencode.ai/docs/go.md",
    "codex_pricing": "https://developers.openai.com/codex/pricing.md",
    "commandcode_goat": "https://commandcode.ai/docs/plans/goat",
}

# GPT Plus / Codex — credit rates per 1M tokens (OpenAI Codex rate card).
CODEX_CREDIT_RATES = {
    "gpt-5.6-sol": {"input": 100, "cache": 10, "output": 500},
    "gpt-5.6-luna": {"input": 5, "cache": 0.5, "output": 30},
}

# Plus plan local messages per rolling 5h window (developers.openai.com/codex/pricing).
CODEX_PLUS_MSG_RANGE = {
    "gpt-5.6-sol": (10, 100),
    "gpt-5.6-luna": (250, 2000),
}

# Rolling 5h windows in one week (168h); scaled to month via WEEKS_PER_MONTH.
CODEX_PLUS_WINDOWS_PER_WEEK = 7 * 24 / 5

PROVIDER_EQUIV = {
    "deepseek": {"deepseek"},
    "moonshot": {"moonshot", "moonshotai"},
    "zhipu": {"zhipu", "z-ai", "zai"},
    "openai": {"openai"},
}


def get_ranked_models(models: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    ranked = [m for m in models if m.get("rank") is not None]
    ranked.sort(key=lambda m: m["rank"])
    return ranked


def normalize_match_key(text: str) -> str:
    text = re.sub(r"\([^)]*\)", "", text)
    text = text.lower()
    return re.sub(r"[\s_\-‑–—./]", "", text)


def slugify_plan_id(text: str) -> str:
    text = re.sub(r"\([^)]*\)", "", text).strip().lower()
    text = re.sub(r"[\s/]+", "-", text)
    return re.sub(r"[^a-z0-9.-]+", "", text)


def slug_matches_vendor(model_id: str, vendor_slug: str) -> bool:
    slug = model_slug(model_id)
    ms = normalize_match_key(slug)
    vs = normalize_match_key(vendor_slug)

    if "vision" in slug and "vision" not in vendor_slug.lower():
        return False
    if "vision" in vendor_slug.lower() and "vision" not in slug:
        return False

    if ms == vs:
        return True
    if ms.startswith(vs):
        suffix = ms[len(vs) :]
        if suffix.isdigit() and len(suffix) == 4:
            return True
    return False


def find_ranked_models_for_vendor_slug(
    vendor_slug: str,
    models: List[Dict[str, Any]],
) -> List[str]:
    matched = [
        model["id"]
        for model in get_ranked_models(models)
        if slug_matches_vendor(model["id"], vendor_slug)
    ]
    rank_by_id = {m["id"]: m["rank"] for m in models}
    return sorted(set(matched), key=lambda mid: (rank_by_id.get(mid, 9999), mid))


def vendor_label_to_slug_guess(label: str) -> str:
    label = re.sub(r"\([^)]*\)", "", label).strip()
    label = re.sub(r"^tencent\s+", "", label, flags=re.I)
    label = label.lower().replace(" ", "-")
    return label


def find_ranked_models_for_vendor_label(
    vendor_label: str,
    models: List[Dict[str, Any]],
) -> List[str]:
    slug_guess = vendor_label_to_slug_guess(vendor_label)
    matched = find_ranked_models_for_vendor_slug(slug_guess, models)
    if matched:
        return matched

    target = normalize_match_key(vendor_label)
    fallback: List[str] = []
    for model in get_ranked_models(models):
        model_id = model["id"]
        keys = {
            normalize_match_key(model_slug(model_id)),
            normalize_match_key(core_slug(model_id)),
            normalize_match_key(model.get("name") or ""),
        }
        if target in keys:
            fallback.append(model_id)
    rank_by_id = {m["id"]: m["rank"] for m in models}
    return sorted(set(fallback), key=lambda mid: (rank_by_id.get(mid, 9999), mid))


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


def codex_rate_key_for_model(model_id: str) -> Optional[str]:
    """Map a live OpenAI model id to Codex credit-card slug when supported."""
    slug = model_slug(model_id)
    for key in sorted(CODEX_CREDIT_RATES, key=len, reverse=True):
        if key in slug:
            return key
    return None


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

    vendor_slug = match.get("vendor_slug")
    if vendor_slug:
        matched.extend(find_ranked_models_for_vendor_slug(vendor_slug, models))

    vendor_label = match.get("vendor_label")
    if vendor_label:
        matched.extend(find_ranked_models_for_vendor_label(vendor_label, models))

    rank_by_id = {m["id"]: m.get("rank") or 9999 for m in models}
    ranked_ids = {m["id"] for m in models if m.get("rank") is not None}
    return sorted(
        {model_id for model_id in matched if model_id in ranked_ids},
        key=lambda mid: (rank_by_id.get(mid, 9999), mid),
    )


MATCH_DS_V4_FLASH = make_match(
    model_family="deepseek/deepseek-v4-flash",
    exclude_slug_patterns=[r"vision"],
)


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


def cost_sort_value(cost: Any) -> float:
    if cost is None:
        return float("inf")
    if isinstance(cost, list):
        return cost[-1] if cost else float("inf")
    return cost


def subscription_cost_cny_per_m(monthly_cny: float, monthly_tokens: float) -> Optional[float]:
    if not monthly_cny or not monthly_tokens:
        return None
    return round(monthly_cny / (monthly_tokens / 1e6), 4)


def blended_cost_cny_per_m_from_usd_rates(
    prompt_usd: float,
    cache_usd: Optional[float],
    completion_usd: float,
    model_id: Optional[str] = None,
) -> float:
    pattern = get_agent_token_pattern(model_id)
    blended_usd = agent_blended_price(prompt_usd, cache_usd, completion_usd, pattern)
    return round(blended_usd * USD_TO_CNY, 4)


def blended_cost_cny_per_m_from_cny_rates(
    prompt_cny: float,
    cache_cny: float,
    completion_cny: float,
    model_id: Optional[str] = None,
) -> float:
    pattern = get_agent_token_pattern(model_id)
    blended_cny = agent_blended_price(prompt_cny, cache_cny, completion_cny, pattern)
    return round(blended_cny, 4)


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


def expand_grouped_doc_label(label: str) -> List[str]:
    label = label.strip()
    glm_match = re.match(r"^GLM-([\d./]+)$", label)
    if glm_match:
        return [f"GLM-{part}" for part in glm_match.group(1).split("/")]
    if label == "Kimi K2.7/K2.6":
        return ["Kimi K2.7 Code", "Kimi K2.6"]
    return [label]


DOC_LABEL_SEPARATOR = r"(?:\u2014|\u2013|\u2011|[-–—])"


def parse_opencode_token_patterns(markdown: str) -> Dict[str, Dict[str, int]]:
    patterns: Dict[str, Dict[str, int]] = {}
    for match in re.finditer(
        rf"-\s*(.+?)\s+{DOC_LABEL_SEPARATOR}\s*([\d,]+)\s+input,\s*([\d,]+)\s+cached,\s*([\d,]+)\s+output",
        markdown,
        re.I,
    ):
        pattern = {
            "input": int(match.group(2).replace(",", "")),
            "cached": int(match.group(3).replace(",", "")),
            "output": int(match.group(4).replace(",", "")),
        }
        for key in expand_grouped_doc_label(match.group(1).strip()):
            patterns[key] = pattern
    return patterns


def parse_opencode_slug_map(markdown: str) -> Dict[str, str]:
    slugs: Dict[str, str] = {}
    for row in parse_markdown_table_rows(markdown):
        if len(row) >= 3 and "opencode.ai" in row[2]:
            slugs[row[0].strip()] = row[1].strip()
    return slugs


def parse_opencode_monthly_request_map(markdown: str) -> Dict[str, int]:
    requests: Dict[str, int] = {}
    for row in parse_markdown_table_rows(markdown):
        if len(row) < 4:
            continue
        try:
            int(row[1].replace(",", ""))
            requests[row[0].strip()] = int(row[3].replace(",", ""))
        except ValueError:
            continue
    return requests


def lookup_opencode_token_pattern(
    patterns: Dict[str, Dict[str, int]],
    doc_label: str,
) -> Optional[Dict[str, int]]:
    if doc_label in patterns:
        return patterns[doc_label]
    target = normalize_match_key(doc_label)
    for key, pattern in patterns.items():
        if normalize_match_key(key) == target:
            return pattern
    return None


def parse_opencode_go_catalog(markdown: str) -> List[Dict[str, Any]]:
    slug_map = parse_opencode_slug_map(markdown)
    request_map = parse_opencode_monthly_request_map(markdown)
    token_patterns = parse_opencode_token_patterns(markdown)
    catalog: List[Dict[str, Any]] = []

    for doc_label, vendor_slug in slug_map.items():
        monthly_requests = request_map.get(doc_label)
        pattern = lookup_opencode_token_pattern(token_patterns, doc_label)
        if not monthly_requests or not pattern:
            continue
        catalog.append(
            {
                "doc_label": doc_label,
                "vendor_slug": vendor_slug,
                "monthly_requests": monthly_requests,
                "token_pattern": pattern,
            }
        )
    return catalog


def parse_opencode_token_pattern(markdown: str, model_key: str) -> Optional[Dict[str, int]]:
    return lookup_opencode_token_pattern(parse_opencode_token_patterns(markdown), model_key)


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
    plans: List[Dict[str, Any]] = []

    for entry in parse_opencode_go_catalog(markdown):
        doc_label = entry["doc_label"]
        vendor_slug = entry["vendor_slug"]
        pattern = entry["token_pattern"]
        monthly_requests = entry["monthly_requests"]
        tokens_per_request = pattern["input"] + pattern["cached"] + pattern["output"]
        monthly_tokens = monthly_requests * tokens_per_request
        base_cost = subscription_cost_cny_per_m(monthly_cny, monthly_tokens)
        cost = (
            round(base_cost * OPENCODE_GO_COST_BUFFER, 4)
            if base_cost is not None
            else None
        )
        plans.append(
            {
                "id": f"opencode-go-{slugify_plan_id(vendor_slug)}",
                "type": "subscription",
                "provider": "opencode",
                "provider_display": "OpenCode Go",
                "plan": doc_label,
                "badge": f"${int(monthly_sub_usd)}/月",
                "cost": cost,
                "subscription_base_cost": base_cost,
                "cost_buffer": OPENCODE_GO_COST_BUFFER,
                "monthly_cny": monthly_cny,
                "monthly_usd": monthly_sub_usd,
                "quota_tokens": int(monthly_tokens),
                "monthly_requests": monthly_requests,
                "vendor_slug": vendor_slug,
                "url": "https://opencode.ai/go",
                "pricing_source": "OpenCode Go 官方文档",
                "source_url": VENDOR_SOURCES["opencode_go"],
                "note_zh": f"按官方 ${int(monthly_sub_usd)}/月 与 {doc_label} 月度请求量估算，并 ×{OPENCODE_GO_COST_BUFFER:.1f} 计入峰谷等因素",
                "note_en": f"From ${int(monthly_sub_usd)}/mo and {doc_label} monthly requests, ×{OPENCODE_GO_COST_BUFFER:.1f} for peak/off-peak exposure",
                "match": make_match(vendor_slug=vendor_slug),
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


def parse_commandcode_goat_request_map(html: str) -> Dict[str, int]:
    requests: Dict[str, int] = {}
    for match in re.finditer(
        r"<tr><td>([^<]+)</td><td>[\d,]+</td><td>[\d,]+</td><td>([\d,]+)</td></tr>",
        html,
    ):
        label = match.group(1).strip()
        requests[label] = int(match.group(2).replace(",", ""))
    return requests


def parse_commandcode_goat_monthly_requests(html: str, model_label: str) -> Optional[int]:
    return parse_commandcode_goat_request_map(html).get(model_label)


def lookup_commandcode_token_pattern(
    vendor_label: str,
    opencode_patterns: Dict[str, Dict[str, int]],
) -> Dict[str, int]:
    if vendor_label in opencode_patterns:
        return opencode_patterns[vendor_label]

    target = normalize_match_key(vendor_label)
    for key, pattern in opencode_patterns.items():
        if normalize_match_key(key) == target:
            return pattern

    slug_guess = vendor_label_to_slug_guess(vendor_label)
    for key, pattern in opencode_patterns.items():
        if normalize_match_key(key) == normalize_match_key(slug_guess):
            return pattern

    aliases = {
        "deepseek v4 flash (latest)": "DeepSeek V4 Flash",
        "deepseek v4 pro (latest)": "DeepSeek V4 Pro",
        "deepseek v4 flash vision (exp)": "DeepSeek V4 Flash Vision Exp",
        "glm-5.3 flash": "GLM-5.3-Flash",
        "glm-5.3": "GLM-5.3",
        "gpt-5.6 luna": "GPT 5.6 Luna",
        "gpt-5.6 sol": "GPT 5.6 Sol",
        "tencent hy3": "Hy3",
        "mimo v2.5": "MiMo-V2.5",
        "mimo v2.5 pro": "MiMo-V2.5-Pro",
        "qwen 3.8 max": "Qwen3.8 Max",
        "qwen 3.7 max": "Qwen3.7 Max",
        "qwen 3.7 plus": "Qwen3.7 Plus",
        "qwen 3.6 plus": "Qwen3.6 Plus",
        "kimi k2.7 code": "Kimi K2.7 Code",
        "kimi k3": "Kimi K3",
        "minimax m3": "MiniMax M3",
        "minimax m2.7": "MiniMax M2.7",
        "muse spark 1.2 contributor": "Muse Spark 1.2 Contributor",
        "muse spark 1.2": "Muse Spark 1.2 Contributor",
        "grok 4.6": "Grok 4.6",
        "grok 4.5": "Grok 4.6",
    }
    alias = aliases.get(vendor_label.lower().strip())
    if alias and alias in opencode_patterns:
        return opencode_patterns[alias]

    return dict(DEFAULT_TOKEN_PATTERN)


def build_commandcode_goat_plan(html: str, opencode_markdown: str = "") -> List[Dict[str, Any]]:
    monthly_usd = parse_commandcode_goat_monthly_price(html)
    monthly_cny = round(monthly_usd * USD_TO_CNY, 2)
    opencode_patterns = (
        parse_opencode_token_patterns(opencode_markdown) if opencode_markdown else {}
    )
    plans: List[Dict[str, Any]] = []

    for vendor_label, monthly_requests in parse_commandcode_goat_request_map(html).items():
        pattern = lookup_commandcode_token_pattern(vendor_label, opencode_patterns)
        tokens_per_request = pattern["input"] + pattern["cached"] + pattern["output"]
        monthly_tokens = monthly_requests * tokens_per_request
        base_cost = subscription_cost_cny_per_m(monthly_cny, monthly_tokens)
        cost = (
            round(base_cost * SUBSCRIPTION_COST_BUFFER, 4)
            if base_cost is not None
            else None
        )
        vendor_slug = vendor_label_to_slug_guess(vendor_label)
        plans.append(
            {
                "id": f"commandcode-goat-{slugify_plan_id(vendor_label)}",
                "type": "subscription",
                "provider": "commandcode",
                "provider_display": "Command Code",
                "plan": f"GOAT · {vendor_label}",
                "badge": f"${int(monthly_usd)}",
                "cost": cost,
                "subscription_base_cost": base_cost,
                "cost_buffer": SUBSCRIPTION_COST_BUFFER,
                "monthly_cny": monthly_cny,
                "monthly_usd": monthly_usd,
                "quota_tokens": int(monthly_tokens),
                "monthly_requests": monthly_requests,
                "tokens_per_request": tokens_per_request,
                "vendor_slug": vendor_slug,
                "vendor_label": vendor_label,
                "url": "https://commandcode.ai/docs/plans/goat",
                "pricing_source": "Command Code GOAT 官方文档",
                "source_url": VENDOR_SOURCES["commandcode_goat"],
                "note_zh": f"按 GOAT ${int(monthly_usd)}/月、{vendor_label} 月请求量估算，并 ×{SUBSCRIPTION_COST_BUFFER:.1f} 计入峰谷等因素",
                "note_en": f"From GOAT ${int(monthly_usd)}/mo and {vendor_label} monthly requests, ×{SUBSCRIPTION_COST_BUFFER:.1f} for peak/off-peak exposure",
                "match": make_match(
                    vendor_slug=vendor_slug,
                    vendor_label=vendor_label,
                ),
            }
        )

    return plans


def credits_per_million(credit_rates: Dict[str, float]) -> float:
    input_eff = credit_rates["input"] * (1 - DEFAULT_CACHE_HIT_RATE) + credit_rates["cache"] * DEFAULT_CACHE_HIT_RATE
    return (3 * input_eff + credit_rates["output"]) / 4


def build_codex_plus_plans(
    markdown: str,
    models_index: Dict[str, Any],
    ranked_models: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    plus_usd = 20.0
    plus_cny = plus_usd * USD_TO_CNY
    plans = []
    seen_rate_keys = set()

    for model in ranked_models:
        if model_provider_key(model["id"]) != "openai":
            continue
        rate_key = codex_rate_key_for_model(model["id"])
        if not rate_key or rate_key in seen_rate_keys:
            continue
        msg_range = CODEX_PLUS_MSG_RANGE.get(rate_key)
        if not msg_range:
            continue
        seen_rate_keys.add(rate_key)

        msg_low, msg_high = msg_range
        rates = CODEX_CREDIT_RATES[rate_key]
        credits_per_msg_high = credits_per_million(rates) * 0.025
        windows_per_month = CODEX_PLUS_WINDOWS_PER_WEEK * WEEKS_PER_MONTH
        monthly_msgs_high = msg_high * windows_per_month

        tokens_per_credit = 1e6 / credits_per_million(rates)
        monthly_tokens_high = monthly_msgs_high * credits_per_msg_high * tokens_per_credit

        model_id = model["id"]
        display_name = re.sub(r"^[^:]+:\s*", "", model.get("name") or model_slug(model_id))
        openrouter = models_index.get(model_id)
        if openrouter:
            pricing = openrouter.get("pricing") or {}
            api_cost = blended_cost_cny_per_m_from_usd_rates(
                pricing.get("prompt", 0),
                pricing.get("cache_read"),
                pricing.get("completion", 0),
                model_id,
            )
        else:
            api_cost = None

        plans.append(
            {
                "id": f"gpt-plus-{core_slug(model_id)}",
                "type": "subscription",
                "provider": "openai",
                "provider_display": "GPT Plus",
                "plan": display_name,
                "cost": subscription_cost_cny_per_m(plus_cny, monthly_tokens_high),
                "monthly_cny": round(plus_cny, 2),
                "monthly_usd": plus_usd,
                "quota_tokens": int(monthly_tokens_high),
                "quota_windows_per_week": round(CODEX_PLUS_WINDOWS_PER_WEEK, 2),
                "quota_msgs_per_5h": msg_high,
                "url": "https://chatgpt.com/codex/pricing",
                "pricing_source": "OpenAI Codex 官方定价",
                "source_url": VENDOR_SOURCES["codex_pricing"],
                "api_reference_blended_cny_per_m": api_cost,
                "note_zh": "按 Plus $20/月：每 5h 消息上限 × 周滚动窗口数 × 月周数；未纳入官方未公开的周总量上限",
                "note_en": "Plus $20/mo: max msgs per 5h × rolling windows/week × weeks/month; undisclosed weekly pool cap not modeled",
                "match": make_match(model_family=model_id, exclude_slug_patterns=[r"-pro"]),
            }
        )

    return plans


def build_deepseek_api_plans() -> List[Dict[str, Any]]:
    plans = []
    for model_family, pricing in DEEPSEEK_OFFICIAL_CNY_PER_M.items():
        if "peak" not in pricing:
            continue
        weighted = time_weighted_cny_rates(pricing)
        family_core = core_slug(model_family)
        plans.append(
            {
                "id": f"deepseek-api-{family_core}",
                "type": "api",
                "provider": "deepseek",
                "provider_display": "DeepSeek",
                "plan": pricing.get("plan_label") or family_core,
                "cost": blended_cost_cny_per_m_from_cny_rates(
                    weighted["prompt"], weighted["cache_read"], weighted["completion"], model_family
                ),
                "url": pricing.get("source_url"),
                "pricing_source": pricing.get("source_label"),
                "source_url": pricing.get("source_url"),
                "match": make_match(model_family=model_family),
            }
        )
    return plans


def sort_key(plan: Dict[str, Any]) -> float:
    return cost_sort_value(plan.get("cost"))


def index_models(models: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {model["id"]: model for model in models}


def plan_target_models(plan: Dict[str, Any], models: List[Dict[str, Any]]) -> List[str]:
    return resolve_target_models(plan, models)


def supplier_sort_key(entry: Dict[str, Any]) -> float:
    return cost_sort_value(entry.get("cost"))


def build_by_model_index(
    plans: List[Dict[str, Any]],
    models: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    ranked_ids = {m["id"] for m in models if m.get("rank") is not None}
    index: Dict[str, List[Dict[str, Any]]] = {}
    matched_plan_count = 0
    for plan in plans:
        matched = plan_target_models(plan, models)
        plan["target_models"] = [model_id for model_id in matched if model_id in ranked_ids]
        if not plan["target_models"]:
            continue
        matched_plan_count += 1
        entry = {
            "id": plan["id"],
            "provider": plan.get("provider"),
            "provider_display": plan.get("provider_display"),
            "plan": plan.get("plan"),
            "type": plan.get("type"),
            "badge": plan.get("badge"),
            "cost": plan.get("cost"),
            "url": plan.get("url"),
            "pricing_source": plan.get("pricing_source"),
        }
        for model_id in plan["target_models"]:
            index.setdefault(model_id, []).append(dict(entry))

    for model_id, entries in index.items():
        entries.sort(key=supplier_sort_key)
        for idx, entry in enumerate(entries, start=1):
            entry["rank"] = idx

    unmatched = ranked_ids - set(index)
    print(
        f"  Ranked models: {len(index)} with channel pricing, "
        f"{len(unmatched)} without ({matched_plan_count} plan entries matched)"
    )
    return index


def build_coding_plans(models: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    session = make_http_session()
    sources = {}

    opencode_md, sources["opencode_go"] = fetch_text(VENDOR_SOURCES["opencode_go"], session)
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
    ranked_models = get_ranked_models(models or [])
    plans: List[Dict[str, Any]] = []
    plans.extend(build_opencode_plans(opencode_md))
    plans.extend(build_commandcode_goat_plan(commandcode_goat_html, opencode_md))
    plans.extend(build_codex_plus_plans(codex_md, models_index, ranked_models))
    plans.extend(build_deepseek_api_plans())

    plans.sort(key=sort_key)
    for idx, plan in enumerate(plans, start=1):
        plan["rank"] = idx

    by_model = build_by_model_index(plans, models or [])

    return {
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "methodology": {
            "unit": "effective blended price (¥/M tokens, coding-agent token mix)",
            "cache_hit_rate": DEFAULT_CACHE_HIT_RATE,
            "token_mix": "OpenCode-observed agent mix (fresh input / cache / output); subscription uses vendor quota",
            "sort_by": "effective blended cost ascending",
            "deepseek_api": "24h time-weighted peak/off-peak average (7h peak + 17h off-peak CST)",
            "opencode_go": f"subscription amortization × {SUBSCRIPTION_COST_BUFFER} (50% uplift; peak/off-peak not in quota math)",
            "commandcode_goat": f"subscription amortization × {SUBSCRIPTION_COST_BUFFER} (50% uplift; peak/off-peak not in quota math)",
            "codex_plus": "5h rolling window max msgs × (168h/5h windows per week) × weeks/month; additional weekly caps per OpenAI docs are not public",
            "target_scope": "all ranked leaderboard models",
            "match_strategy": "vendor plan model slugs/labels matched to live ranked model ids",
            "excluded_plans": "Zhipu GLM Coding Plan; Kimi membership/API official plans (not comparable on this leaderboard)",
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
