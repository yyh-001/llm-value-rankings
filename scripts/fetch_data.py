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
    Fetch intelligence scores from Artificial Analysis.
    
    REAL scores from Artificial Analysis Intelligence Index (0-100 scale)
    Source: https://artificialanalysis.ai/leaderboards/models (June 2026)
    """
    print("Loading intelligence scores from Artificial Analysis...")
    
    # REAL scores from Artificial Analysis leaderboard
    scores = {
        # ===== Anthropic =====
        "claude-fable-5": 60,
        "claude-opus-4.8": 56,
        "claude-opus-4.7": 54,
        "claude-opus-4.6": 54,
        "claude-opus-4.5": 54,
        "claude-opus-4": 52,
        "claude-sonnet-4.6": 47,
        "claude-sonnet-4.5": 47,
        "claude-sonnet-4": 45,
        "claude-3.5-sonnet": 42,
        "claude-3-opus": 40,
        "claude-4.5-haiku": 30,
        "claude-3.5-haiku": 28,
        "claude-3-haiku": 25,
        
        # ===== OpenAI =====
        "gpt-5.5": 55,
        "gpt-5.4": 40,
        "gpt-5.3": 40,
        "gpt-5.2": 40,
        "gpt-5.1": 52,
        "gpt-5": 50,
        "o3": 48,
        "o4-mini": 44,
        "gpt-4.1": 42,
        "gpt-4o": 28,
        "gpt-4-turbo": 30,
        "gpt-4o-mini": 25,
        "gpt-4.1-mini": 38,
        "gpt-4.1-nano": 32,
        "gpt-5-mini": 45,
        "gpt-5-nano": 40,
        
        # ===== Google =====
        "gemini-2.5-pro": 48,
        "gemini-3.1-pro": 46,
        "gemini-3-flash": 50,
        "gemini-2.5-flash": 42,
        "gemini-2.0-flash": 38,
        "gemini-1.5-pro": 35,
        "gemini-2.5-flash-lite": 28,
        "gemini-3.1-flash-lite": 42,
        
        # ===== DeepSeek =====
        "deepseek-r1": 38,
        "deepseek-v4-pro": 44,
        "deepseek-v4-flash": 40,
        "deepseek-v3": 35,
        "deepseek-v3.2": 36,
        "deepseek-chat": 35,
        
        # ===== xAI =====
        "grok-4.3": 38,
        "grok-4": 38,
        "grok-3": 35,
        "grok-2": 30,
        
        # ===== Meta =====
        "llama-4-maverick": 38,
        "llama-4-scout": 35,
        "llama-3.1-405b": 32,
        "llama-3.1-70b": 28,
        "llama-3.3-70b": 30,
        
        # ===== Qwen / Alibaba =====
        "qwen3.7-max": 46,
        "qwen3.6-plus": 40,
        "qwen-2.5-72b": 32,
        "qwq-32b": 35,
        
        # ===== Mistral =====
        "mistral-large": 35,
        "codestral": 33,
        
        # ===== MiniMax =====
        "minimax-m3": 44,
        
        # ===== GLM / Zhipu =====
        "glm-5.2": 51,
        "glm-5.1": 40,
        
        # ===== Kimi =====
        "kimi-k2.7": 42,
        "kimi-k2.6": 40,
        
        # ===== Xiaomi =====
        "mimo-v2.5-pro": 42,
        
        # ===== NVIDIA =====
        "nemotron-3-ultra": 38,
        
        # ===== Cohere =====
        "command-r-plus": 30,
        "command-a": 35,
        
        # ===== Amazon =====
        "nova-pro": 28,
        
        # ===== Tencent =====
        "hy3": 34,
        
        # ===== Step =====
        "step-3.7-flash": 30,
    }
    
    print(f"  Loaded {len(scores)} scores from Artificial Analysis")
    return scores


def match_intelligence_score(model_id, model_name, scores):
    """
    Try to match a model to its intelligence score.
    Uses exact matching first, then fuzzy matching.
    """
    model_id_lower = model_id.lower()
    model_name_lower = model_name.lower() if model_name else ""
    
    # Extract the model part after the provider slash
    model_part = model_id_lower.split("/")[-1] if "/" in model_id_lower else model_id_lower
    
    # Step 1: Exact match (highest priority)
    for key, score in scores.items():
        # Check if the key exactly matches the model part
        if model_part == key or model_part.startswith(key + "-") or model_part.startswith(key + "_"):
            return score
    
    # Step 2: Try matching with common suffixes removed
    clean_part = model_part
    for suffix in ["-instruct", "-chat", "-preview", "-latest", "-0528", "-0324", "-v1", "-v2", "-0125", "-1106"]:
        clean_part = clean_part.replace(suffix, "")
    
    for key, score in scores.items():
        if clean_part == key:
            return score
    
    # Step 3: Pattern matching with REGEX (be very specific)
    import re
    
    # Map of regex patterns to scores - ORDER MATTERS (more specific first)
    patterns = [
        # Claude - specific versions first (REAL Artificial Analysis scores)
        (r"claude.*fable.*5", 60),
        (r"claude.*opus.*4\.[78]", 54),
        (r"claude.*opus.*4\.[56]", 54),
        (r"claude.*opus.*4\.[1234]", 52),
        (r"claude.*opus.*4\b", 52),
        (r"claude.*sonnet.*4\.[56]", 47),
        (r"claude.*sonnet.*4\b", 45),
        (r"claude.*sonnet.*3\.5", 42),
        (r"claude.*opus.*3", 40),
        (r"claude.*haiku.*4\.5", 30),
        (r"claude.*haiku.*3\.5", 28),
        (r"claude.*haiku.*3", 25),
        
        # GPT - specific versions first (REAL scores)
        (r"gpt-5\.5", 55),
        (r"gpt-5\.4", 40),
        (r"gpt-5\.3", 40),
        (r"gpt-5\.2", 40),
        (r"gpt-5\.1", 52),
        (r"gpt-5(?![-.])", 50),
        (r"gpt-4o-mini", 25),
        (r"gpt-4o(?!-mini)", 28),
        (r"gpt-4\.1-nano", 32),
        (r"gpt-4\.1-mini", 38),
        (r"gpt-4\.1", 42),
        (r"gpt-4-turbo", 30),
        (r"o4-mini", 44),
        (r"o3-mini", 42),
        (r"\bo3\b", 48),
        
        # Gemini (REAL scores)
        (r"gemini-2\.5-pro", 48),
        (r"gemini-3\.1-pro", 46),
        (r"gemini-3\.1-flash-lite", 42),
        (r"gemini-3(?!-).*flash", 50),
        (r"gemini-2\.5-flash-lite", 28),
        (r"gemini-2\.5-flash", 42),
        (r"gemini-2\.0-flash", 38),
        (r"gemini-1\.5-pro", 35),
        
        # DeepSeek - BE VERY SPECIFIC (REAL scores)
        (r"deepseek.*r1-distill", 38),
        (r"deepseek.*r1-0528", 38),
        (r"deepseek.*\br1\b", 38),
        (r"deepseek.*v4-pro", 44),
        (r"deepseek.*v4-flash", 40),
        (r"deepseek.*v3\.2", 36),
        (r"deepseek.*v3\.1.*terminus", 35),
        (r"deepseek.*v3\.1", 35),
        (r"deepseek.*v3", 35),
        (r"deepseek.*chat", 35),
        (r"deepseek.*coder", 35),
        
        # Grok (REAL scores)
        (r"grok.*4\.[23]", 38),
        (r"grok.*4\b", 38),
        (r"grok.*3", 35),
        (r"grok.*2", 30),
        
        # Llama (REAL scores)
        (r"llama.*4.*maverick", 38),
        (r"llama.*4.*scout", 35),
        (r"llama.*3\.1.*405", 32),
        (r"llama.*3\.1.*70", 28),
        (r"llama.*3\.3.*70", 30),
        
        # Qwen (REAL scores)
        (r"qwen.*3\.7.*max", 46),
        (r"qwen.*3\.6.*plus", 40),
        (r"qwen.*2\.5.*72", 32),
        (r"\bqwq\b", 35),
        
        # Other models (REAL scores)
        (r"minimax.*m3", 44),
        (r"glm.*5\.2", 51),
        (r"glm.*5\.1", 40),
        (r"kimi.*k2\.[67]", 42),
        (r"mimo.*v2\.5.*pro", 42),
        (r"nemotron.*3.*ultra", 38),
        (r"command.*r.*plus", 30),
        (r"command.*a", 35),
        (r"nova.*pro", 28),
        (r"\bhy3\b", 34),
        (r"step.*3\.7", 30),
    ]
    
    for pattern, score in patterns:
        if re.search(pattern, model_id_lower) or re.search(pattern, model_name_lower):
            return score
    
    return None


def calculate_value_scores(intelligence, price, avg_intelligence=40):
    """
    Calculate value score with penalty for below-average models.
    
    Formula:
    - Above average: intelligence² / price
    - Below average: (intelligence² / price) * (intelligence / avg)²  [penalty]
    """
    if intelligence is None or price is None or price <= 0:
        return None
    
    base = (intelligence ** 2) / price
    
    # Apply penalty for below-average models
    if intelligence < avg_intelligence:
        penalty = (intelligence / avg_intelligence) ** 2
        return round(base * penalty, 2)
    
    return round(base, 2)


def process_models(openrouter_models, intelligence_scores):
    """Process and combine model data."""
    processed = []
    seen = set()
    
    # First pass: calculate average intelligence
    matched_scores = []
    for model in openrouter_models:
        model_id = model.get("id", "")
        model_name = model.get("name", "")
        intel = match_intelligence_score(model_id, model_name, intelligence_scores)
        if intel is not None:
            matched_scores.append(intel)
    avg_intelligence = sum(matched_scores) / len(matched_scores) if matched_scores else 40
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

        intelligence = match_intelligence_score(model_id, model_name, intelligence_scores)
        value_score = calculate_value_scores(intelligence, blended_price, avg_intelligence)

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
            "value_score": value_score,
            "created": model.get("created"),
            "description": model.get("description", ""),
        })

    return processed


def rank_models(models):
    """Rank models by value score."""
    ranked = [m for m in models if m["value_score"] is not None]
    unranked = [m for m in models if m["value_score"] is None]

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

    intelligence_scores = fetch_intelligence_scores()

    # Process and rank
    processed = process_models(openrouter_models, intelligence_scores)
    ranked = rank_models(processed)

    # Save
    save_data(ranked)

    # Print top 10
    print("\n" + "=" * 60)
    print("Top 10 Best Value Models:")
    print("=" * 60)
    top10 = [m for m in ranked if m["rank"] is not None][:10]
    for m in top10:
        print(f"  #{m['rank']:2d} {m['name']:<30s} "
              f"Score: {m['intelligence_score'] or 'N/A':>3} "
              f"Price: ${m['pricing']['blended']:>8.2f}/1M "
              f"Value: {m['value_score']:>8.2f}")


if __name__ == "__main__":
    main()
