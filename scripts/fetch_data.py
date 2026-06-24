#!/usr/bin/env python3
"""
Fetch LLM model data from OpenRouter to calculate value rankings.
"""

import json
import os
import re
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path

import requests

# Configuration
OPENROUTER_API = "https://openrouter.ai/api/v1/models"
OPENROUTER_BENCHMARKS_API = "https://openrouter.ai/api/v1/benchmarks"
OUTPUT_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "models.json"
HISTORY_FILE = OUTPUT_DIR / "rank_history.json"
REPO_META_FILE = OUTPUT_DIR / "repo.json"
GITHUB_REPO = "yyh-001/llm-value-rankings"


def load_local_env():
    """Load .env.local / .env into os.environ when keys are not already set."""
    root = Path(__file__).parent.parent
    for name in (".env.local", ".env"):
        env_file = root / name
        if not env_file.exists():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value

# Scoring: raw = capability⁵ × speed^0.8 / price → normalized to 0–100 in rank_models()
# Capability uses AA coding_index from OpenRouter (broader coverage than intelligence_index).
AA_CAPABILITY_FIELD = "coding_index"
MIN_INTELLIGENCE = 25
INTELLIGENCE_EXPONENT = 5
SPEED_EXPONENT = 0.8
DEFAULT_CACHE_HIT_RATE = 0.7
INPUT_TOKEN_WEIGHT = 3
OUTPUT_TOKEN_WEIGHT = 1
OPENROUTER_ENDPOINTS_API = "https://openrouter.ai/api/v1/models/{model_id}/endpoints"
OPENROUTER_MODEL_PAGE = "https://openrouter.ai/{model_id}"
ENDPOINT_FETCH_WORKERS = 8
PAGE_FETCH_WORKERS = 6
ENDPOINT_FETCH_TIMEOUT = 25
PAGE_FETCH_TIMEOUT = 30
USER_AGENT = (
    "LLM-Value-Rankings/1.0 (+https://yyh-001.github.io/llm-value-rankings/)"
)

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
        response = make_http_session().get(OPENROUTER_API, timeout=30)
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


def make_http_session():
    """HTTP session that ignores broken local proxy env and sends OpenRouter auth when set."""
    session = requests.Session()
    session.trust_env = False
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if api_key:
        session.headers["Authorization"] = f"Bearer {api_key}"
    return session


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


def blend_token_price(input_price, output_price):
    """Blend input/output $/1M rates using typical chat token mix (3:1 input:output)."""
    if input_price is None or output_price is None:
        return None
    total_weight = INPUT_TOKEN_WEIGHT + OUTPUT_TOKEN_WEIGHT
    return round(
        (INPUT_TOKEN_WEIGHT * input_price + OUTPUT_TOKEN_WEIGHT * output_price) / total_weight,
        4,
    )


def effective_input_price(prompt, cache_read, cache_hit_rate):
    """Apply cache-hit discount to input price when cache read pricing exists."""
    if prompt is None:
        return None
    if cache_read is not None and cache_hit_rate is not None:
        return prompt * (1 - cache_hit_rate) + cache_read * cache_hit_rate
    return prompt


def get_list_blended_price(pricing):
    """List-price blended rate from catalog pricing ($/1M tokens)."""
    if not pricing:
        return None

    prompt_price = price_per_million(pricing.get("prompt"))
    completion_price = price_per_million(pricing.get("completion"))

    if prompt_price is None or completion_price is None:
        return None
    if prompt_price == 0 and completion_price == 0:
        return None

    return blend_token_price(prompt_price, completion_price)


def refresh_pricing_blended(pricing):
    """Recompute blended prices from stored prompt/completion/cache fields."""
    if not pricing:
        return pricing

    prompt = pricing.get("prompt")
    completion = pricing.get("completion")
    if prompt is None or completion is None:
        return pricing

    cache_read = pricing.get("cache_read")
    cache_hit_rate = DEFAULT_CACHE_HIT_RATE if cache_read is not None else None
    if cache_hit_rate is not None:
        pricing["cache_hit_rate"] = cache_hit_rate

    prompt_effective = effective_input_price(prompt, cache_read, cache_hit_rate)
    pricing["blended_list"] = blend_token_price(prompt, completion)
    pricing["blended"] = blend_token_price(prompt_effective, completion)
    return pricing


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
    session = make_http_session()
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


def scrape_model_page_performance(model_id, session=None):
    """
    Scrape throughput / TTFT from an OpenRouter model page via Next.js RSC payload.

    Plain HTML is client-rendered and empty; the RSC response embeds provider stats.
    """
    url = OPENROUTER_MODEL_PAGE.format(model_id=model_id)
    http = session or make_http_session()
    try:
        response = http.get(
            url,
            headers={
                "RSC": "1",
                "Accept": "text/x-component",
                "User-Agent": USER_AGENT,
            },
            timeout=PAGE_FETCH_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.text
    except Exception as exc:
        print(f"  Warning: page scrape for {model_id}: {exc}")
        return {"throughput": None, "ttft": None}

    throughputs = []
    latencies = []

    for match in re.finditer(
        r'"throughput_last_30m"\s*:\s*(?:\{"p50"\s*:\s*([\d.]+)\}|([\d.]+))',
        payload,
    ):
        value = match.group(1) or match.group(2)
        if value:
            throughputs.append(float(value))

    for match in re.finditer(
        r'"latency_last_30m"\s*:\s*(?:\{"p50"\s*:\s*([\d.]+)\}|([\d.]+))',
        payload,
    ):
        value = match.group(1) or match.group(2)
        if value:
            latencies.append(normalize_latency_seconds(float(value)))

    for value in re.findall(r'p50_throughput(?:_last_30m)?":(\d+(?:\.\d+)?)', payload):
        throughputs.append(float(value))

    for value in re.findall(r'p50_latency(?:_last_30m)?":(\d+(?:\.\d+)?)', payload):
        latencies.append(normalize_latency_seconds(float(value)))

    throughput = round(max(throughputs), 1) if throughputs else None
    ttft = round(min(latencies), 3) if latencies else None
    return {"throughput": throughput, "ttft": ttft}


def fetch_page_stats_batch(model_ids, endpoints_map):
    """Scrape OpenRouter model pages for models missing endpoint throughput."""
    need_scrape = [
        model_id
        for model_id in model_ids
        if aggregate_endpoint_metrics(endpoints_map.get(model_id, [])).get("throughput") is None
    ]
    results = {}
    if not need_scrape:
        return results

    session = make_http_session()
    print(f"Scraping OpenRouter model pages for speed: {len(need_scrape)} models...")
    with ThreadPoolExecutor(max_workers=PAGE_FETCH_WORKERS) as executor:
        futures = {
            executor.submit(scrape_model_page_performance, model_id, session): model_id
            for model_id in need_scrape
        }
        done = 0
        for future in as_completed(futures):
            model_id = futures[future]
            try:
                results[model_id] = future.result()
            except Exception as exc:
                print(f"  Warning: page stats for {model_id}: {exc}")
                results[model_id] = {"throughput": None, "ttft": None, "intelligence": None}
            done += 1
            if done % 50 == 0 or done == len(need_scrape):
                print(f"  Page scrape progress: {done}/{len(need_scrape)}")

    with_stats = sum(1 for stats in results.values() if stats.get("throughput") is not None)
    print(f"  Models with scraped throughput: {with_stats}/{len(need_scrape)}")
    return results


def aggregate_endpoint_metrics(endpoints, cache_hit_rate=DEFAULT_CACHE_HIT_RATE):
    """
    Aggregate provider endpoint stats into model-level speed, TTFT, and effective price.

    Speed uses the best provider throughput (matches OpenRouter model page).
    TTFT uses the lowest provider latency.
    Effective input price uses cache_hit_rate when input_cache_read is available.
    """
    healthy = [ep for ep in endpoints if ep.get("status") == 0]
    if not healthy:
        healthy = list(endpoints)

    throughputs = []
    latencies = []
    prompt_prices = []
    prompt_weights = []
    completion_prices = []
    completion_weights = []
    effective_inputs = []
    effective_weights = []
    cache_reads = []
    cache_weights = []
    has_cache = False

    for ep in healthy:
        pricing = ep.get("pricing") or {}
        prompt = price_per_million(pricing.get("prompt"))
        completion = price_per_million(pricing.get("completion"))
        cache_read = price_per_million(pricing.get("input_cache_read"))

        if prompt is None and completion is None:
            continue

        weight = ep.get("uptime_last_1d") or ep.get("uptime_last_30m") or 1.0

        if prompt is not None:
            prompt_prices.append(prompt)
            prompt_weights.append(weight)
            if cache_read is not None:
                has_cache = True
                cache_reads.append(cache_read)
                cache_weights.append(weight)
                effective_inputs.append(
                    prompt * (1 - cache_hit_rate) + cache_read * cache_hit_rate
                )
            else:
                effective_inputs.append(prompt)
            effective_weights.append(weight)

        if completion is not None:
            completion_prices.append(completion)
            completion_weights.append(weight)

        throughput = parse_p50_stat(ep.get("throughput_last_30m"))
        if throughput is not None and throughput > 0:
            throughputs.append(throughput)

        latency = normalize_latency_seconds(parse_p50_stat(ep.get("latency_last_30m")))
        if latency is not None and latency > 0:
            latencies.append(latency)

    prompt_list = weighted_average(prompt_prices, prompt_weights)
    completion_list = weighted_average(completion_prices, completion_weights)
    prompt_effective = weighted_average(effective_inputs, effective_weights)
    cache_read_avg = weighted_average(cache_reads, cache_weights)

    blended_list = None
    blended_effective = None
    if prompt_list is not None and completion_list is not None:
        blended_list = blend_token_price(prompt_list, completion_list)
    if prompt_effective is not None and completion_list is not None:
        blended_effective = blend_token_price(prompt_effective, completion_list)

    throughput_best = max(throughputs) if throughputs else None

    return {
        "throughput": round(throughput_best, 1) if throughput_best is not None else None,
        "ttft": min(latencies) if latencies else None,
        "prompt_list": prompt_list,
        "completion_list": completion_list,
        "prompt_effective": prompt_effective,
        "cache_read": cache_read_avg,
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
    blended_list = endpoint_metrics.get("blended_list")
    if blended_list is None and prompt_list is not None and completion_list is not None:
        blended_list = blend_token_price(prompt_list, completion_list)
    if blended_list is None:
        blended_list = get_list_blended_price(catalog_pricing)
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


def normalize_permaslug(slug):
    """Normalize OpenRouter permaslugs for benchmark lookup."""
    if not slug:
        return ""
    normalized = slug.lower().split(":")[0]
    normalized = normalized.replace(".", "-")
    normalized = re.sub(r"-\d{4}-\d{2}-\d{2}$", "", normalized)
    normalized = re.sub(r"-\d{8}$", "", normalized)
    return normalized


def slug_tokens(slug):
    """Tokenize a slug for fuzzy matching (handles claude-5-fable vs claude-fable-5)."""
    normalized = normalize_permaslug(slug)
    tokens = []
    for segment in normalized.split("/"):
        tokens.extend(part for part in segment.split("-") if part)
    return tuple(sorted(tokens))


def extract_embedded_aa_score(model):
    """Read AA capability score (coding_index) attached to an OpenRouter model record."""
    benchmarks = model.get("benchmarks") or {}
    artificial_analysis = benchmarks.get("artificial_analysis") or {}
    value = artificial_analysis.get(AA_CAPABILITY_FIELD)
    if value is None:
        return None
    return round(float(value))


def benchmark_match_score(model_slug, benchmark_slug):
    """Score slug similarity for benchmark fallback (exact or token-reorder only)."""
    if not model_slug or not benchmark_slug:
        return 0

    left = normalize_permaslug(model_slug)
    right = normalize_permaslug(benchmark_slug)
    if left == right:
        return 100
    if slug_tokens(left) == slug_tokens(right):
        return 90
    return 0


def build_intelligence_map(benchmark_rows, openrouter_models):
    """Map OpenRouter model IDs to AA coding_index via embedded data + exact slug fallback."""
    scored_rows = [
        row
        for row in benchmark_rows
        if row.get(AA_CAPABILITY_FIELD) is not None and row.get("model_permaslug")
    ]
    intelligence_map = {}
    embedded_count = 0
    slug_count = 0

    for model in openrouter_models:
        model_id = model.get("id")
        if not model_id:
            continue

        embedded = extract_embedded_aa_score(model)
        if embedded is not None:
            intelligence_map[model_id] = embedded
            embedded_count += 1

    for model in openrouter_models:
        model_id = model.get("id")
        if not model_id or model_id in intelligence_map:
            continue

        best_score = 0
        best_intel = None
        for row in scored_rows:
            permaslug = row["model_permaslug"]
            score = max(
                benchmark_match_score(model_id, permaslug),
                benchmark_match_score(model.get("canonical_slug"), permaslug),
            )
            if score > best_score:
                best_score = score
                best_intel = round(float(row[AA_CAPABILITY_FIELD]))

        if best_score >= 90 and best_intel is not None:
            intelligence_map[model_id] = best_intel
            slug_count += 1

    print(f"  Embedded AA {AA_CAPABILITY_FIELD}: {embedded_count}, slug fallback: {slug_count}")
    return intelligence_map



def fetch_openrouter_intelligence_scores(openrouter_models):
    """
    Build capability scores from OpenRouter model records and benchmarks API.

    Uses AA coding_index; prefers per-model embedded scores, exact slug fallback only.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("  Warning: OPENROUTER_API_KEY not set; skipping OpenRouter benchmark scores")
        return {}

    print(f"Fetching AA {AA_CAPABILITY_FIELD} from OpenRouter...")
    session = make_http_session()
    try:
        response = session.get(
            OPENROUTER_BENCHMARKS_API,
            params={
                "source": "artificial-analysis",
                "max_results": 100,
            },
            headers=get_openrouter_headers(),
            timeout=ENDPOINT_FETCH_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        print(f"  Error fetching OpenRouter benchmarks: {exc}")
        return {}

    rows = payload.get("data", [])
    intelligence_map = build_intelligence_map(rows, openrouter_models)
    with_scores = sum(1 for row in rows if row.get(AA_CAPABILITY_FIELD) is not None)

    meta = payload.get("meta") or {}
    as_of = meta.get("as_of")
    print(f"  Loaded {len(rows)} benchmark rows ({with_scores} with {AA_CAPABILITY_FIELD})")
    print(f"  Matched {len(intelligence_map)} OpenRouter models")
    if as_of:
        print(f"  Benchmark snapshot: {as_of}")
    return intelligence_map


def fetch_intelligence_scores(openrouter_models):
    """Fetch intelligence scores from OpenRouter."""
    return fetch_openrouter_intelligence_scores(openrouter_models)


def compute_avg_intelligence(intelligence_map):
    """Mean intelligence across models with AA benchmark scores."""
    values = list(intelligence_map.values())
    if not values:
        return None
    return sum(values) / len(values)


def lookup_intelligence_score(model_id, intelligence_map):
    """Resolve intelligence for an OpenRouter model."""
    return intelligence_map.get(model_id)


def calculate_value_scores(intelligence, price, speed, avg_intelligence=None):
    """
    Calculate raw value score: intelligence⁵ × speed^0.8 / price.

    Models below the intelligence average receive an extra (I/avg)² penalty.
    Normalized to a 0–100 scale in rank_models(). Models below MIN_INTELLIGENCE are excluded.
    """
    if intelligence is None or price is None or price <= 0:
        return None

    if intelligence < MIN_INTELLIGENCE:
        return None

    if speed is None or speed <= 0:
        return None

    base = (intelligence ** INTELLIGENCE_EXPONENT) * (speed ** SPEED_EXPONENT) / price

    if avg_intelligence and avg_intelligence > 0 and intelligence < avg_intelligence:
        base *= (intelligence / avg_intelligence) ** 2

    return base


def process_models(openrouter_models, intelligence_map, endpoints_map, page_stats_map):
    """Process and combine model data from OpenRouter + endpoint/page stats."""
    processed = []
    seen = set()
    avg_intelligence = compute_avg_intelligence(intelligence_map)

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

        page_stats = page_stats_map.get(model_id) or {}
        intelligence = lookup_intelligence_score(model_id, intelligence_map)
        speed = endpoint_metrics.get("throughput") or page_stats.get("throughput")
        ttft = endpoint_metrics.get("ttft") or page_stats.get("ttft")

        if "distill" in model_id.lower():
            value_score = None
        else:
            value_score = calculate_value_scores(
                intelligence, blended_price, speed, avg_intelligence
            )

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
    load_local_env()
    print("=" * 60)
    print("LLM Value Rankings - Data Fetcher")
    print("=" * 60)

    # Fetch data
    openrouter_models = fetch_openrouter_models()
    if not openrouter_models:
        print("Error: No models fetched from OpenRouter")
        sys.exit(1)

    intelligence_map = fetch_intelligence_scores(openrouter_models)

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
    page_stats_map = fetch_page_stats_batch(candidate_ids, endpoints_map)

    # Process and rank
    processed = process_models(openrouter_models, intelligence_map, endpoints_map, page_stats_map)
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
