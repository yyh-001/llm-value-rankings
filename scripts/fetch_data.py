#!/usr/bin/env python3
"""
Fetch LLM model data from OpenRouter and Artificial Analysis
to calculate value rankings.
"""

import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Configuration
OPENROUTER_API = "https://openrouter.ai/api/v1/models"
ARTIFICIAL_ANALYSIS_URL = "https://artificialanalysis.ai/leaderboards/models"
OUTPUT_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "models.json"
HISTORY_FILE = OUTPUT_DIR / "rank_history.json"
REPO_META_FILE = OUTPUT_DIR / "repo.json"
GITHUB_REPO = "yyh-001/llm-value-rankings"

# Scoring: raw = intelligence³ × speed / price → normalized to 0–100 in rank_models()
MIN_INTELLIGENCE = 25
INTELLIGENCE_EXPONENT = 3
DEFAULT_CACHE_HIT_RATE = 0.5
DEFAULT_SPEED = 80
OPENROUTER_ENDPOINTS_API = "https://openrouter.ai/api/v1/models/{model_id}/endpoints"
ENDPOINT_FETCH_WORKERS = 8
ENDPOINT_FETCH_TIMEOUT = 25

# Provider logo mapping
PROVIDER_LOGOS = {
    "openai": "https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg",
    "anthropic": "https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg",
    "google": "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg",
    "meta": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg",
    "mistral": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Mistral_AI_logo.svg",
    "deepseek": "https://upload.wikimedia.org/wikipedia/commons/9/91/DeepSeek_logo.svg",
    "qwen": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Alibaba_Cloud_logo.svg",
    "xai": "https://upload.wikimedia.org/wikipedia/commons/5/55/X.ai_logo.svg",
    "cohere": "https://upload.wikimedia.org/wikipedia/commons/5/5e/Cohere_logo.svg",
    "amazon": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
}

# Provider name normalization
PROVIDER_NAMES = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "meta": "Meta",
    "mistral": "Mistral",
    "deepseek": "DeepSeek",
    "alibaba": "Alibaba",
    "xai": "xAI",
    "cohere": "Cohere",
    "amazon": "Amazon",
    "nvidia": "NVIDIA",
    "microsoft": "Microsoft",
}


def fetch_openrouter_models():
    """Fetch model data from OpenRouter API."""
    print("Fetching models from OpenRouter...")
    try:
        response = requests.get(OPENROUTER_API, timeout=30)
        response.raise_for_status()
        data = response.json()
        models = data.get("data", [])
        print(f"  Found {len(models)} models from OpenRouter")
        return models
    except Exception as e:
        print(f"  Error fetching OpenRouter models: {e}")
        return []


def extract_provider(model_id):
    """Extract provider name from model ID."""
    parts = model_id.split("/")
    if len(parts) >= 2:
        return parts[0].lower()
    return "unknown"


def get_provider_display_name(provider_id):
    """Get display name for provider."""
    return PROVIDER_NAMES.get(provider_id, provider_id.title())


def get_openrouter_headers():
    """Headers for OpenRouter API; optional API key unlocks latency/throughput stats."""
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def price_per_million(token_price):
    """Convert OpenRouter per-token price string to USD per 1M tokens."""
    if token_price is None or token_price == "":
        return None
    value = float(token_price)
    if value == 0:
        return 0.0
    return round(value * 1_000_000, 6)


def parse_p50_stat(stat):
    """Extract p50 from OpenRouter percentile stats (number or {p50: ...})."""
    if stat is None:
        return None
    if isinstance(stat, (int, float)):
        return float(stat)
    if isinstance(stat, dict):
        p50 = stat.get("p50")
        return float(p50) if p50 is not None else None
    return None


def normalize_latency_seconds(latency):
    """Normalize latency to seconds (API may return seconds or milliseconds)."""
    if latency is None:
        return None
    if latency > 20:
        return round(latency / 1000, 3)
    return round(latency, 3)


def weighted_average(values, weights):
    """Weighted average; falls back to simple mean when weights are missing."""
    if not values:
        return None
    if not weights or len(weights) != len(values):
        return round(sum(values) / len(values), 6)
    total_weight = sum(weights)
    if total_weight <= 0:
        return round(sum(values) / len(values), 6)
    return round(sum(v * w for v, w in zip(values, weights)) / total_weight, 6)


def get_list_blended_price(pricing):
    """List-price blended average: (prompt + completion) / 2 per 1M tokens."""
    if not pricing:
        return None

    prompt_price = price_per_million(pricing.get("prompt"))
    completion_price = price_per_million(pricing.get("completion"))

    if prompt_price is None or completion_price is None:
        return None
    if prompt_price == 0 and completion_price == 0:
        return None

    return round((prompt_price + completion_price) / 2, 4)


def fetch_model_endpoints(model_id, session=None):
    """Fetch per-provider endpoint stats for a model."""
    url = OPENROUTER_ENDPOINTS_API.format(model_id=model_id)
    http = session or requests
    try:
        response = http.get(
            url,
            headers=get_openrouter_headers(),
            timeout=ENDPOINT_FETCH_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json().get("data") or {}
        return payload.get("endpoints") or []
    except Exception as exc:
        print(f"  Warning: endpoints for {model_id}: {exc}")
        return []


def fetch_endpoints_batch(model_ids):
    """Fetch endpoint stats for many models in parallel."""
    unique_ids = list(dict.fromkeys(model_ids))
    results = {}
    session = requests.Session()
    session.headers.update(get_openrouter_headers())

    print(f"Fetching OpenRouter endpoint stats for {len(unique_ids)} models...")
    with ThreadPoolExecutor(max_workers=ENDPOINT_FETCH_WORKERS) as executor:
        futures = {
            executor.submit(fetch_model_endpoints, model_id, session): model_id
            for model_id in unique_ids
        }
        done = 0
        for future in as_completed(futures):
            model_id = futures[future]
            try:
                results[model_id] = future.result()
            except Exception as exc:
                print(f"  Warning: failed endpoints for {model_id}: {exc}")
                results[model_id] = []
            done += 1
            if done % 50 == 0 or done == len(unique_ids):
                print(f"  Endpoints progress: {done}/{len(unique_ids)}")

    with_stats = sum(
        1
        for endpoints in results.values()
        if aggregate_endpoint_metrics(endpoints).get("throughput") is not None
    )
    print(f"  Models with live throughput data: {with_stats}/{len(unique_ids)}")
    return results


def aggregate_endpoint_metrics(endpoints, cache_hit_rate=DEFAULT_CACHE_HIT_RATE):
    """
    Aggregate provider endpoint stats into model-level speed, TTFT, and effective price.

    Effective input price uses cache_hit_rate when input_cache_read is available
    (OpenRouter model pages expose real hit rates; the public endpoints API does not).
    """
    healthy = [ep for ep in endpoints if ep.get("status") == 0]
    if not healthy:
        healthy = list(endpoints)

    throughputs = []
    latencies = []
    weights = []
    effective_inputs = []
    list_prompts = []
    list_completions = []
    cache_reads = []
    has_cache = False

    for ep in healthy:
        pricing = ep.get("pricing") or {}
        prompt = price_per_million(pricing.get("prompt"))
        completion = price_per_million(pricing.get("completion"))
        cache_read = price_per_million(pricing.get("input_cache_read"))

        if prompt is None and completion is None:
            continue

        weight = ep.get("uptime_last_1d") or ep.get("uptime_last_30m") or 1.0
        weights.append(weight)

        if prompt is not None:
            list_prompts.append(prompt)
            if cache_read is not None:
                has_cache = True
                cache_reads.append(cache_read)
                effective_inputs.append(
                    prompt * (1 - cache_hit_rate) + cache_read * cache_hit_rate
                )
            else:
                effective_inputs.append(prompt)

        if completion is not None:
            list_completions.append(completion)

        throughput = parse_p50_stat(ep.get("throughput_last_30m"))
        if throughput is not None and throughput > 0:
            throughputs.append(throughput)

        latency = normalize_latency_seconds(parse_p50_stat(ep.get("latency_last_30m")))
        if latency is not None and latency > 0:
            latencies.append(latency)

    prompt_list = min(list_prompts) if list_prompts else None
    completion_list = min(list_completions) if list_completions else None
    prompt_effective = weighted_average(effective_inputs, weights[: len(effective_inputs)])
    cache_read_min = min(cache_reads) if cache_reads else None

    blended_list = None
    blended_effective = None
    if prompt_list is not None and completion_list is not None:
        blended_list = round((prompt_list + completion_list) / 2, 4)
    if prompt_effective is not None and completion_list is not None:
        blended_effective = round((prompt_effective + completion_list) / 2, 4)

    return {
        "throughput": round(max(throughputs), 1) if throughputs else None,
        "ttft": min(latencies) if latencies else None,
        "prompt_list": prompt_list,
        "completion_list": completion_list,
        "prompt_effective": prompt_effective,
        "cache_read": cache_read_min,
        "cache_hit_rate": cache_hit_rate if has_cache else None,
        "blended_list": blended_list,
        "blended_effective": blended_effective,
        "endpoint_count": len(healthy),
    }


def build_pricing_payload(catalog_pricing, endpoint_metrics):
    """Merge catalog list prices with endpoint-derived effective prices."""
    prompt_list = endpoint_metrics.get("prompt_list")
    completion_list = endpoint_metrics.get("completion_list")

    if prompt_list is None:
        prompt_list = price_per_million((catalog_pricing or {}).get("prompt"))
    if completion_list is None:
        completion_list = price_per_million((catalog_pricing or {}).get("completion"))

    cache_read = endpoint_metrics.get("cache_read")
    if cache_read is None and catalog_pricing:
        cache_read = price_per_million(catalog_pricing.get("input_cache_read"))

    blended_effective = endpoint_metrics.get("blended_effective")
    blended_list = endpoint_metrics.get("blended_list") or get_list_blended_price(catalog_pricing)
    blended = blended_effective or blended_list

    return {
        "prompt": prompt_list,
        "completion": completion_list,
        "cache_read": cache_read,
        "blended": blended,
        "blended_list": blended_list,
        "cache_hit_rate": endpoint_metrics.get("cache_hit_rate"),
    }


def is_text_llm(model):
    """Return True only for text-output LLMs (exclude image generation models)."""
    architecture = model.get("architecture") or {}
    output_modalities = architecture.get("output_modalities") or []
    if "image" in output_modalities:
        return False
    model_id = model.get("id", "")
    if model_id in ("openrouter/auto",):
        return False
    return True


def fetch_intelligence_scores():
    """
    Load intelligence scores from Artificial Analysis.

    Speed and TTFT come from OpenRouter endpoint stats; only intelligence is sourced here.
    Source: https://artificialanalysis.ai/leaderboards/models (June 2026)
    """
    print("Loading intelligence scores from Artificial Analysis...")
    
    # Intelligence scores (0-100). Speed fields are legacy and ignored.
    model_data = {
        # ===== Anthropic =====
        "claude-fable-5": {"intelligence": 60, "speed": 45},
        "claude-opus-4.8": {"intelligence": 56, "speed": 48},
        "claude-opus-4.7": {"intelligence": 54, "speed": 48},
        "claude-opus-4.6": {"intelligence": 54, "speed": 48},
        "claude-opus-4.5": {"intelligence": 54, "speed": 48},
        "claude-opus-4": {"intelligence": 52, "speed": 48},
        "claude-sonnet-4.6": {"intelligence": 47, "speed": 52},
        "claude-sonnet-4.5": {"intelligence": 47, "speed": 52},
        "claude-sonnet-4": {"intelligence": 45, "speed": 52},
        "claude-3.5-sonnet": {"intelligence": 42, "speed": 55},
        "claude-3-opus": {"intelligence": 40, "speed": 40},
        "claude-4.5-haiku": {"intelligence": 30, "speed": 94},
        "claude-3.5-haiku": {"intelligence": 28, "speed": 90},
        "claude-3-haiku": {"intelligence": 25, "speed": 85},
        
        # ===== OpenAI =====
        "gpt-5.5": {"intelligence": 55, "speed": 67},
        "gpt-5.4": {"intelligence": 40, "speed": 183},
        "gpt-5.3": {"intelligence": 40, "speed": 91},
        "gpt-5.2": {"intelligence": 40, "speed": 80},
        "gpt-5.1": {"intelligence": 52, "speed": 75},
        "gpt-5": {"intelligence": 50, "speed": 70},
        "o3": {"intelligence": 48, "speed": 170},
        "o4-mini": {"intelligence": 44, "speed": 180},
        "gpt-4.1": {"intelligence": 42, "speed": 85},
        "gpt-4o": {"intelligence": 28, "speed": 90},
        "gpt-4-turbo": {"intelligence": 30, "speed": 75},
        "gpt-4o-mini": {"intelligence": 25, "speed": 150},
        "gpt-4.1-mini": {"intelligence": 38, "speed": 160},
        "gpt-4.1-nano": {"intelligence": 32, "speed": 180},
        "gpt-5-mini": {"intelligence": 45, "speed": 120},
        "gpt-5-nano": {"intelligence": 40, "speed": 174},
        
        # ===== Google =====
        "gemini-2.5-pro": {"intelligence": 48, "speed": 125},
        "gemini-3.1-pro": {"intelligence": 46, "speed": 132},
        "gemini-3-flash": {"intelligence": 50, "speed": 167},
        "gemini-2.5-flash": {"intelligence": 42, "speed": 150},
        "gemini-2.0-flash": {"intelligence": 38, "speed": 160},
        "gemini-1.5-pro": {"intelligence": 35, "speed": 100},
        "gemini-2.5-flash-lite": {"intelligence": 28, "speed": 200},
        "gemini-3.1-flash-lite": {"intelligence": 42, "speed": 331},
        
        # ===== DeepSeek =====
        "deepseek-r1": {"intelligence": 38, "speed": 87},
        "deepseek-v4-pro": {"intelligence": 44, "speed": 87},
        "deepseek-v4-flash": {"intelligence": 40, "speed": 105},
        "deepseek-v3": {"intelligence": 35, "speed": 80},
        "deepseek-v3.2": {"intelligence": 36, "speed": 82},
        "deepseek-chat": {"intelligence": 35, "speed": 80},
        
        # ===== xAI =====
        "grok-4.3": {"intelligence": 38, "speed": 171},
        "grok-4": {"intelligence": 38, "speed": 170},
        "grok-3": {"intelligence": 35, "speed": 150},
        "grok-2": {"intelligence": 30, "speed": 120},
        
        # ===== Meta =====
        "llama-4-maverick": {"intelligence": 38, "speed": 140},
        "llama-4-scout": {"intelligence": 35, "speed": 150},
        "llama-3.1-405b": {"intelligence": 32, "speed": 40},
        "llama-3.1-70b": {"intelligence": 28, "speed": 60},
        "llama-3.3-70b": {"intelligence": 30, "speed": 65},
        
        # ===== Qwen / Alibaba =====
        "qwen3.7-max": {"intelligence": 46, "speed": 198},
        "qwen3.6-plus": {"intelligence": 40, "speed": 53},
        "qwen-2.5-72b": {"intelligence": 32, "speed": 45},
        "qwq-32b": {"intelligence": 35, "speed": 60},
        
        # ===== Mistral =====
        "mistral-large": {"intelligence": 35, "speed": 137},
        "codestral": {"intelligence": 33, "speed": 130},
        
        # ===== MiniMax =====
        "minimax-m3": {"intelligence": 44, "speed": 85},
        
        # ===== GLM / Zhipu =====
        "glm-5.2": {"intelligence": 51, "speed": 114},
        "glm-5.1": {"intelligence": 40, "speed": 100},
        
        # ===== Kimi =====
        "kimi-k2.7": {"intelligence": 42, "speed": 53},
        "kimi-k2.6": {"intelligence": 40, "speed": 73},
        
        # ===== Xiaomi =====
        "mimo-v2.5-pro": {"intelligence": 42, "speed": 46},
        
        # ===== NVIDIA =====
        "nemotron-3-ultra": {"intelligence": 38, "speed": 138},
        
        # ===== Cohere =====
        "command-r-plus": {"intelligence": 30, "speed": 90},
        "command-a": {"intelligence": 35, "speed": 199},
        
        # ===== Amazon =====
        "nova-pro": {"intelligence": 28, "speed": 80},
        
        # ===== Tencent =====
        "hy3": {"intelligence": 34, "speed": 109},
        
        # ===== Step =====
        "step-3.7-flash": {"intelligence": 30, "speed": 402},
    }
    
    print(f"  Loaded {len(model_data)} models from Artificial Analysis")
    return model_data


def match_model_data(model_id, model_name, model_data):
    """
    Try to match a model to its Artificial Analysis intelligence score.
    Returns dict with intelligence, or None.
    """
    model_id_lower = model_id.lower()
    model_name_lower = model_name.lower() if model_name else ""
    model_part = model_id_lower.split("/")[-1] if "/" in model_id_lower else model_id_lower
    
    # Step 1: Exact match
    for key, data in model_data.items():
        if model_part == key:
            return data
    
    # Step 2: Match with suffixes removed
    clean_part = model_part
    for suffix in ["-instruct", "-chat", "-preview", "-latest", "-0528", "-0324", "-v1", "-v2"]:
        clean_part = clean_part.replace(suffix, "")
    
    for key, data in model_data.items():
        if clean_part == key:
            return data
    
    # Step 3: Pattern matching
    import re
    patterns = [
        (r"claude.*fable.*5", "claude-fable-5"),
        (r"claude.*opus.*4\.[78]", "claude-opus-4.7"),
        (r"claude.*opus.*4\.[56]", "claude-opus-4.5"),
        (r"claude.*opus.*4\.[1234]", "claude-opus-4"),
        (r"claude.*opus.*4\b", "claude-opus-4"),
        (r"claude.*sonnet.*4\.[56]", "claude-sonnet-4.5"),
        (r"claude.*sonnet.*4\b", "claude-sonnet-4"),
        (r"claude.*sonnet.*3\.5", "claude-3.5-sonnet"),
        (r"claude.*opus.*3", "claude-3-opus"),
        (r"claude.*haiku.*4\.5", "claude-4.5-haiku"),
        (r"claude.*haiku.*3\.5", "claude-3.5-haiku"),
        (r"claude.*haiku.*3", "claude-3-haiku"),
        
        (r"gpt-5\.5", "gpt-5.5"),
        (r"gpt-5\.4", "gpt-5.4"),
        (r"gpt-5\.3", "gpt-5.3"),
        (r"gpt-5\.2", "gpt-5.2"),
        (r"gpt-5\.1", "gpt-5.1"),
        (r"gpt-5(?![-.])", "gpt-5"),
        (r"gpt-4o-mini", "gpt-4o-mini"),
        (r"gpt-4o(?!-mini)", "gpt-4o"),
        (r"gpt-4\.1-nano", "gpt-4.1-nano"),
        (r"gpt-4\.1-mini", "gpt-4.1-mini"),
        (r"gpt-4\.1", "gpt-4.1"),
        (r"gpt-4-turbo", "gpt-4-turbo"),
        (r"o4-mini", "o4-mini"),
        (r"o3-mini", "o3"),
        (r"\bo3\b", "o3"),
        
        (r"gemini-2\.5-pro", "gemini-2.5-pro"),
        (r"gemini-3\.1-pro", "gemini-3.1-pro"),
        (r"gemini-3\.1-flash-lite", "gemini-3.1-flash-lite"),
        (r"gemini-3-flash", "gemini-3-flash"),
        (r"gemini-2\.5-flash-lite", "gemini-2.5-flash-lite"),
        (r"gemini-2\.5-flash", "gemini-2.5-flash"),
        (r"gemini-2\.0-flash", "gemini-2.0-flash"),
        (r"gemini-1\.5-pro", "gemini-1.5-pro"),
        
        (r"deepseek.*r1", "deepseek-r1"),
        (r"deepseek.*v4-pro", "deepseek-v4-pro"),
        (r"deepseek.*v4-flash", "deepseek-v4-flash"),
        (r"deepseek.*v3\.2", "deepseek-v3.2"),
        (r"deepseek.*v3", "deepseek-v3"),
        (r"deepseek.*chat", "deepseek-chat"),
        
        (r"grok.*4\.[23]", "grok-4.3"),
        (r"grok.*4\b", "grok-4"),
        (r"grok.*3", "grok-3"),
        (r"grok.*2", "grok-2"),
        
        (r"llama.*4.*maverick", "llama-4-maverick"),
        (r"llama.*4.*scout", "llama-4-scout"),
        (r"llama.*3\.1.*405", "llama-3.1-405b"),
        (r"llama.*3\.1.*70", "llama-3.1-70b"),
        (r"llama.*3\.3.*70", "llama-3.3-70b"),
        
        (r"qwen.*3\.7.*max", "qwen3.7-max"),
        (r"qwen.*3\.6.*plus", "qwen3.6-plus"),
        (r"qwen.*2\.5.*72", "qwen-2.5-72b"),
        (r"\bqwq\b", "qwq-32b"),
        
        (r"minimax.*m3", "minimax-m3"),
        (r"glm.*5\.2", "glm-5.2"),
        (r"glm.*5\.1", "glm-5.1"),
        (r"kimi.*k2\.7", "kimi-k2.7"),
        (r"kimi.*k2\.6", "kimi-k2.6"),
        (r"mimo.*v2\.5.*pro", "mimo-v2.5-pro"),
        (r"nemotron.*3.*ultra", "nemotron-3-ultra"),
        (r"command.*r.*plus", "command-r-plus"),
        (r"command.*a", "command-a"),
        (r"nova.*pro", "nova-pro"),
        (r"\bhy3\b", "hy3"),
        (r"step.*3\.7", "step-3.7-flash"),
    ]
    
    for pattern, key in patterns:
        if re.search(pattern, model_id_lower) or re.search(pattern, model_name_lower):
            if key in model_data:
                return model_data[key]
    
    return None


def calculate_value_scores(intelligence, price, speed):
    """
    Calculate raw value score: intelligence³ × speed / price.

    Normalized to a 0–100 scale in rank_models(). Models below MIN_INTELLIGENCE are excluded.
    """
    if intelligence is None or price is None or price <= 0:
        return None

    if intelligence < MIN_INTELLIGENCE:
        return None

    if speed is None:
        speed = DEFAULT_SPEED

    return (intelligence ** INTELLIGENCE_EXPONENT) * speed / price


def process_models(openrouter_models, model_data, endpoints_map):
    """Process and combine model data from OpenRouter + AA + endpoint stats."""
    processed = []
    seen = set()

    for model in openrouter_models:
        model_id = model.get("id", "")
        if not is_text_llm(model):
            continue

        provider = extract_provider(model_id)
        model_name = model.get("name", "")

        pricing = model.get("pricing")
        if not pricing:
            continue

        endpoint_metrics = aggregate_endpoint_metrics(endpoints_map.get(model_id, []))
        pricing_payload = build_pricing_payload(pricing, endpoint_metrics)
        blended_price = pricing_payload.get("blended")
        if blended_price is None or blended_price <= 0:
            continue

        data = match_model_data(model_id, model_name, model_data)
        intelligence = data["intelligence"] if data else None
        speed = endpoint_metrics.get("throughput")
        if speed is None and data and data.get("speed"):
            speed = data["speed"]
        ttft = endpoint_metrics.get("ttft")

        if "distill" in model_id.lower():
            value_score = None
        else:
            value_score = calculate_value_scores(intelligence, blended_price, speed)

        base_name = model_id.split(":")[0] if ":" in model_id else model_id
        if base_name in seen:
            continue
        seen.add(base_name)

        processed.append({
            "id": model_id,
            "name": model_name or model_id.split("/")[-1],
            "provider": provider,
            "provider_display": get_provider_display_name(provider),
            "context_length": model.get("context_length"),
            "pricing": pricing_payload,
            "intelligence_score": intelligence,
            "speed": speed,
            "ttft": ttft,
            "value_score": value_score,
            "created": model.get("created"),
            "description": model.get("description", ""),
        })

    return processed


def rank_models(models):
    """Rank models by value score, excluding distill models. Scores normalized to 0–100."""
    ranked = [m for m in models if m["value_score"] is not None and "distill" not in m["id"].lower()]
    unranked = [m for m in models if m["value_score"] is None or "distill" in m["id"].lower()]

    ranked.sort(key=lambda x: x["value_score"], reverse=True)

    max_score = ranked[0]["value_score"] if ranked else 0
    for i, model in enumerate(ranked, 1):
        model["rank"] = i
        if max_score > 0:
            model["value_score"] = round(model["value_score"] / max_score * 100, 1)

    for model in unranked:
        model["rank"] = None
        model["value_score"] = None

    return ranked + unranked


def load_rank_history():
    """Load daily rank snapshots."""
    if not HISTORY_FILE.exists():
        return {"snapshots": {}}
    with open(HISTORY_FILE, encoding="utf-8") as f:
        data = json.load(f)
    if "snapshots" not in data:
        return {"snapshots": data}
    return data


def save_rank_history(history):
    """Persist rank snapshots, keeping the last 30 days."""
    snapshots = history.get("snapshots", {})
    cutoff = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    history["snapshots"] = {
        day: ranks for day, ranks in snapshots.items() if day >= cutoff
    }
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def get_yesterday_ranks(history):
    """Return the most recent snapshot before today."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    snapshots = history.get("snapshots", {})
    previous_days = sorted(day for day in snapshots if day < today)
    if not previous_days:
        return None, {}
    compare_day = previous_days[-1]
    return compare_day, snapshots[compare_day]


def seed_yesterday_from_previous_output(history):
    """Use the previous models.json as yesterday's baseline on first comparison."""
    _, yesterday_ranks = get_yesterday_ranks(history)
    if yesterday_ranks:
        return
    if not OUTPUT_FILE.exists():
        return
    with open(OUTPUT_FILE, encoding="utf-8") as f:
        previous = json.load(f)
    old_ranks = {
        m["id"]: m["rank"]
        for m in previous.get("models", [])
        if m.get("rank") is not None
    }
    if not old_ranks:
        return
    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    history.setdefault("snapshots", {})[yesterday] = old_ranks
    save_rank_history(history)
    print(f"  Seeded baseline ranks from previous data ({len(old_ranks)} models)")


def apply_rank_changes(models, history):
    """Attach day-over-day rank change vs the previous snapshot."""
    compare_day, yesterday_ranks = get_yesterday_ranks(history)
    today = datetime.utcnow().strftime("%Y-%m-%d")

    for model in models:
        rank = model.get("rank")
        if rank is None:
            model["rank_change"] = None
            model["rank_new"] = False
            continue

        previous_rank = yesterday_ranks.get(model["id"])
        if previous_rank is None:
            model["rank_change"] = None
            model["rank_new"] = bool(yesterday_ranks)
        else:
            model["rank_change"] = previous_rank - rank
            model["rank_new"] = False

    current_ranks = {
        model["id"]: model["rank"]
        for model in models
        if model.get("rank") is not None
    }
    history.setdefault("snapshots", {})[today] = current_ranks
    save_rank_history(history)

    return compare_day


def save_data(models, compare_day=None):
    """Save processed data to JSON file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    data = {
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "total_models": len(models),
        "ranked_models": len([m for m in models if m["rank"] is not None]),
        "rank_compared_to": compare_day,
        "models": models,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nData saved to {OUTPUT_FILE}")
    print(f"  Total models: {data['total_models']}")
    print(f"  Ranked models: {data['ranked_models']}")
    print(f"  Updated at: {data['updated_at']}")


def fetch_repo_meta():
    """Fetch GitHub repo star count for static hosting (avoids browser API limits)."""
    print("Fetching GitHub repo meta...")
    try:
        response = requests.get(
            f"https://api.github.com/repos/{GITHUB_REPO}",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=15,
        )
        if response.ok:
            stars = response.json().get("stargazers_count")
            if isinstance(stars, int):
                meta = {
                    "repo": GITHUB_REPO,
                    "stars": stars,
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                }
                OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
                with open(REPO_META_FILE, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2, ensure_ascii=False)
                print(f"  GitHub stars: {stars}")
                return
        print(f"  Warning: GitHub API returned {response.status_code}")
    except Exception as exc:
        print(f"  Warning: failed to fetch repo meta: {exc}")

    if REPO_META_FILE.exists():
        print("  Keeping existing repo.json")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(REPO_META_FILE, "w", encoding="utf-8") as f:
        json.dump({"repo": GITHUB_REPO, "stars": None, "updated_at": None}, f, indent=2)


def main():
    """Main entry point."""
    print("=" * 60)
    print("LLM Value Rankings - Data Fetcher")
    print("=" * 60)

    # Fetch data
    openrouter_models = fetch_openrouter_models()
    if not openrouter_models:
        print("Error: No models fetched from OpenRouter")
        sys.exit(1)

    model_data = fetch_intelligence_scores()

    candidate_ids = []
    seen_ids = set()
    for model in openrouter_models:
        model_id = model.get("id", "")
        if not is_text_llm(model) or not model.get("pricing"):
            continue
        base_name = model_id.split(":")[0] if ":" in model_id else model_id
        if base_name in seen_ids:
            continue
        seen_ids.add(base_name)
        candidate_ids.append(model_id)

    endpoints_map = fetch_endpoints_batch(candidate_ids)

    # Process and rank
    processed = process_models(openrouter_models, model_data, endpoints_map)
    ranked = rank_models(processed)

    history = load_rank_history()
    seed_yesterday_from_previous_output(history)
    compare_day = apply_rank_changes(ranked, history)

    # Save
    save_data(ranked, compare_day)
    fetch_repo_meta()

    # Print top 10
    print("\n" + "=" * 60)
    print("Top 10 Best Value Models:")
    print("=" * 60)
    top10 = [m for m in ranked if m["rank"] is not None][:10]
    for m in top10:
        speed_str = f"{m['speed']:>5.0f} tok/s" if m.get("speed") else "N/A"
        ttft_str = f"{m['ttft']:>5.2f}s" if m.get("ttft") else "N/A"
        print(f"  #{m['rank']:2d} {m['name']:<30s} "
              f"Score: {m['intelligence_score'] or 'N/A':>3} "
              f"Speed: {speed_str:>12s} "
              f"TTFT: {ttft_str:>8s} "
              f"Price: ${m['pricing']['blended']:>8.4f}/1M "
              f"Value: {m['value_score']:>8.2f}")


if __name__ == "__main__":
    main()
