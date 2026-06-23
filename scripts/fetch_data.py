#!/usr/bin/env python3
"""
Fetch LLM model data from OpenRouter and Artificial Analysis
to calculate value rankings.
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# Configuration
OPENROUTER_API = "https://openrouter.ai/api/v1/models"
ARTIFICIAL_ANALYSIS_URL = "https://artificialanalysis.ai/leaderboards/models"
OUTPUT_DIR = Path(__file__).parent.parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "models.json"

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


def get_blended_price(pricing):
    """Calculate blended price from input and output pricing."""
    if not pricing:
        return None

    prompt_price = float(pricing.get("prompt", 0))
    completion_price = float(pricing.get("completion", 0))

    if prompt_price == 0 and completion_price == 0:
        return None

    # Blended: average of input and output, converted to per 1M tokens
    # OpenRouter prices are per token
    blended = ((prompt_price + completion_price) / 2) * 1_000_000
    return round(blended, 4)


def fetch_intelligence_scores():
    """
    Fetch intelligence scores and speed data from Artificial Analysis.
    
    Returns dict mapping model names to their data.
    Source: https://artificialanalysis.ai/leaderboards/models (June 2026)
    """
    print("Loading model data from Artificial Analysis...")
    
    # Intelligence scores (0-100) and speed (tokens/second)
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
    Try to match a model to its data (intelligence + speed).
    Returns dict with intelligence and speed, or None.
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
        (r"gemini-3(?!-).*flash", "gemini-3-flash"),
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


def calculate_value_scores(intelligence, price, speed, avg_intelligence=40):
    """
    Calculate value score: intelligence² × speed / price
    
    With penalty for below-average intelligence models.
    """
    if intelligence is None or price is None or price <= 0:
        return None
    
    # Default speed if not available
    if speed is None:
        speed = 80  # Average speed
    
    base = (intelligence ** 2) * speed / price
    
    if intelligence < avg_intelligence:
        penalty = (intelligence / avg_intelligence) ** 2
        return round(base * penalty, 2)
    
    return round(base, 2)


def process_models(openrouter_models, model_data):
    """Process and combine model data."""
    processed = []
    seen = set()
    
    # First pass: calculate average intelligence
    matched_intelligences = []
    for model in openrouter_models:
        model_id = model.get("id", "")
        model_name = model.get("name", "")
        data = match_model_data(model_id, model_name, model_data)
        if data and data.get("intelligence"):
            matched_intelligences.append(data["intelligence"])
    avg_intelligence = sum(matched_intelligences) / len(matched_intelligences) if matched_intelligences else 40
    print(f"  Average intelligence score: {avg_intelligence:.1f}")

    for model in openrouter_models:
        model_id = model.get("id", "")
        provider = extract_provider(model_id)
        model_name = model.get("name", "")

        pricing = model.get("pricing")
        if not pricing:
            continue

        blended_price = get_blended_price(pricing)
        if blended_price is None or blended_price <= 0:
            continue

        data = match_model_data(model_id, model_name, model_data)
        intelligence = data["intelligence"] if data else None
        speed = data["speed"] if data else None
        value_score = calculate_value_scores(intelligence, blended_price, speed, avg_intelligence)

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
            "pricing": {
                "prompt": float(pricing.get("prompt", 0)) * 1_000_000,
                "completion": float(pricing.get("completion", 0)) * 1_000_000,
                "blended": blended_price,
            },
            "intelligence_score": intelligence,
            "speed": speed,
            "value_score": value_score,
            "created": model.get("created"),
            "description": model.get("description", ""),
        })

    return processed


def rank_models(models):
    """Rank models by value score, excluding distill models."""
    ranked = [m for m in models if m["value_score"] is not None and "distill" not in m["id"].lower()]
    unranked = [m for m in models if m["value_score"] is None or "distill" in m["id"].lower()]

    ranked.sort(key=lambda x: x["value_score"], reverse=True)
    for i, model in enumerate(ranked, 1):
        model["rank"] = i

    for model in unranked:
        model["rank"] = None

    return ranked + unranked


def save_data(models):
    """Save processed data to JSON file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    data = {
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "total_models": len(models),
        "ranked_models": len([m for m in models if m["rank"] is not None]),
        "models": models,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nData saved to {OUTPUT_FILE}")
    print(f"  Total models: {data['total_models']}")
    print(f"  Ranked models: {data['ranked_models']}")
    print(f"  Updated at: {data['updated_at']}")


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

    # Process and rank
    processed = process_models(openrouter_models, model_data)
    ranked = rank_models(processed)

    # Save
    save_data(ranked)

    # Print top 10
    print("\n" + "=" * 60)
    print("Top 10 Best Value Models:")
    print("=" * 60)
    top10 = [m for m in ranked if m["rank"] is not None][:10]
    for m in top10:
        speed_str = f"{m['speed']:>3d} tok/s" if m['speed'] else "N/A"
        print(f"  #{m['rank']:2d} {m['name']:<30s} "
              f"Score: {m['intelligence_score'] or 'N/A':>3} "
              f"Speed: {speed_str:>10s} "
              f"Price: ${m['pricing']['blended']:>8.2f}/1M "
              f"Value: {m['value_score']:>8.2f}")


if __name__ == "__main__":
    main()
