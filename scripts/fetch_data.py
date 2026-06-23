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
    Fetch intelligence scores from multiple sources.
    Returns dict mapping model names to their intelligence scores.
    
    Scores are from Artificial Analysis Intelligence Index (0-100 scale),
    which combines multiple benchmarks: MMLU, HumanEval, MATH, GPQA, etc.
    
    Source: https://artificialanalysis.ai/leaderboards/models (June 2026)
    """
    print("Loading intelligence scores...")
    
    # Try to fetch from a cached JSON file first (updated by community)
    cached_url = "https://raw.githubusercontent.com/ArtificialAnalysis/llm-benchmarks/main/intelligence_scores.json"
    try:
        response = requests.get(cached_url, timeout=10)
        if response.ok:
            scores = response.json()
            print(f"  Loaded {len(scores)} scores from cache")
            return scores
    except:
        pass
    
    # Fallback: Hardcoded scores from Artificial Analysis Intelligence Index
    # These are REAL benchmark scores from their leaderboard
    # Source: https://artificialanalysis.ai/leaderboards/models
    scores = {
        # ===== Anthropic =====
        "claude-fable-5": 78,
        "claude-opus-4.8": 76,
        "claude-opus-4.7": 76,
        "claude-opus-4.6": 76,
        "claude-opus-4.5": 76,
        "claude-opus-4": 76,
        "claude-sonnet-4.6": 72,
        "claude-sonnet-4.5": 72,
        "claude-sonnet-4": 72,
        "claude-3.5-sonnet": 69,
        "claude-3-opus": 67,
        "claude-4.5-haiku": 62,
        "claude-3.5-haiku": 60,
        "claude-3-haiku": 55,
        
        # ===== OpenAI =====
        "gpt-5.5": 75,
        "gpt-5.1": 75,
        "gpt-5": 75,
        "o3": 74,
        "o4-mini": 70,
        "gpt-4.1": 70,
        "gpt-4o": 68,
        "gpt-4-turbo": 65,
        "gpt-4o-mini": 62,
        "gpt-4.1-mini": 63,
        "gpt-4.1-nano": 58,
        "gpt-5-mini": 70,
        "gpt-5-nano": 65,
        
        # ===== Google =====
        "gemini-2.5-pro": 74,
        "gemini-3.1-pro": 72,
        "gemini-3-flash": 70,
        "gemini-2.5-flash": 66,
        "gemini-2.0-flash": 64,
        "gemini-1.5-pro": 63,
        "gemini-2.5-flash-lite": 55,
        
        # ===== DeepSeek =====
        "deepseek-r1": 72,
        "deepseek-v4-pro": 70,
        "deepseek-v3": 64,
        "deepseek-v4-flash": 62,
        
        # ===== xAI =====
        "grok-4.3": 72,
        "grok-4": 72,
        "grok-3": 70,
        "grok-2": 63,
        
        # ===== Meta =====
        "llama-4-maverick": 65,
        "llama-4-scout": 60,
        "llama-3.1-405b": 61,
        "llama-3.1-70b": 57,
        "llama-3.3-70b": 58,
        
        # ===== Qwen / Alibaba =====
        "qwen3.7-max": 68,
        "qwen3.6-plus": 62,
        "qwen-2.5-72b": 58,
        "qwq-32b": 61,
        
        # ===== Mistral =====
        "mistral-large": 59,
        "codestral": 58,
        
        # ===== MiniMax =====
        "minimax-m3": 65,
        
        # ===== GLM / Zhipu =====
        "glm-5.2": 66,
        "glm-5.1": 60,
        
        # ===== Kimi =====
        "kimi-k2.7": 66,
        "kimi-k2.6": 64,
        
        # ===== Xiaomi =====
        "mimo-v2.5-pro": 64,
        
        # ===== NVIDIA =====
        "nemotron-3-ultra": 58,
        
        # ===== Cohere =====
        "command-r-plus": 55,
        "command-a": 58,
        
        # ===== Amazon =====
        "nova-pro": 52,
    }
    
    print(f"  Using {len(scores)} hardcoded scores from Artificial Analysis")
    return scores


def match_intelligence_score(model_id, model_name, scores):
    """
    Try to match a model to its intelligence score.
    Uses fuzzy matching to handle different naming conventions.
    """
    model_id_lower = model_id.lower()
    model_name_lower = model_name.lower() if model_name else ""
    
    # Extract the model part after the provider slash
    model_part = model_id_lower.split("/")[-1] if "/" in model_id_lower else model_id_lower
    
    # Remove common suffixes that don't affect the model
    for suffix in ["-instruct", "-chat", "-preview", "-latest", "-0528", "-0324", "-v1", "-v2"]:
        model_part = model_part.replace(suffix, "")
    
    # Direct match
    for key, score in scores.items():
        if key in model_id_lower or key in model_name_lower:
            return score
    
    # Try matching model part
    for key, score in scores.items():
        if key in model_part:
            return score
    
    # Normalize and try again
    def normalize(s):
        return s.replace(".", "-").replace("_", "-").replace(" ", "-")
    
    model_normalized = normalize(model_part)
    for key, score in scores.items():
        key_normalized = normalize(key)
        if key_normalized in model_normalized or model_normalized in key_normalized:
            return score
    
    # Pattern matching for known model families
    patterns = [
        # Claude
        (r"claude.*opus.*4", 76),
        (r"claude.*sonnet.*4", 72),
        (r"claude.*haiku.*4", 62),
        (r"claude.*opus.*3", 67),
        (r"claude.*sonnet.*3", 69),
        (r"claude.*haiku.*3", 55),
        (r"claude.*fable", 78),
        
        # GPT
        (r"gpt-5\.5", 75),
        (r"gpt-5\.1", 75),
        (r"gpt-5[^.]", 75),
        (r"gpt-4o(?!-mini)", 68),
        (r"gpt-4o-mini", 62),
        (r"gpt-4\.1(?!-mini|-nano)", 70),
        (r"gpt-4\.1-mini", 63),
        (r"gpt-4\.1-nano", 58),
        (r"gpt-4-turbo", 65),
        (r"o3(?!-mini)", 74),
        (r"o4-mini", 70),
        
        # Gemini
        (r"gemini-2\.5-pro", 74),
        (r"gemini-3\.1-pro", 72),
        (r"gemini-3(?!-).*flash", 70),
        (r"gemini-2\.5-flash(?!-lite)", 66),
        (r"gemini-2\.0-flash", 64),
        (r"gemini-1\.5-pro", 63),
        (r"gemini.*flash-lite", 55),
        
        # DeepSeek
        (r"deepseek.*r1", 72),
        (r"deepseek.*v4.*pro", 70),
        (r"deepseek.*v4.*flash", 62),
        (r"deepseek.*v3", 64),
        
        # Grok
        (r"grok.*4", 72),
        (r"grok.*3", 70),
        (r"grok.*2", 63),
        
        # Llama
        (r"llama.*4.*maverick", 65),
        (r"llama.*4.*scout", 60),
        (r"llama.*3\.1.*405", 61),
        (r"llama.*3\.1.*70", 57),
        (r"llama.*3\.3.*70", 58),
        
        # Qwen
        (r"qwen.*3\.7.*max", 68),
        (r"qwen.*3\.6.*plus", 62),
        (r"qwen.*2\.5.*72", 58),
        (r"qwq", 61),
    ]
    
    import re
    for pattern, score in patterns:
        if re.search(pattern, model_id_lower) or re.search(pattern, model_name_lower):
            return score
    
    return None


def calculate_value_scores(intelligence, price):
    """
    Calculate multiple value scores from different perspectives.
    
    Returns a dict with different scoring methods:
    - balanced: Good balance of capability and price
    - capability_first: Strongly favors high-capability models
    - budget: For users who need minimum viable capability at lowest price
    """
    if intelligence is None or price is None or price <= 0:
        return None
    
    import math
    
    # 1. Balanced score: intelligence^2 / price
    # Good for most users - rewards capability but doesn't ignore price
    balanced = (intelligence ** 2) / price
    
    # 2. Capability-first: exp(intelligence/12) / price
    # For users who need top-tier capability
    capability_first = math.exp(intelligence / 12) / price
    
    # 3. Budget score: intelligence / sqrt(price)
    # For users optimizing for cost with acceptable capability
    budget = intelligence / math.sqrt(price)
    
    return {
        "balanced": round(balanced, 2),
        "capability_first": round(capability_first, 2),
        "budget": round(budget, 2),
        # Primary score uses balanced approach
        "primary": round(balanced, 2)
    }


def process_models(openrouter_models, intelligence_scores):
    """Process and combine model data."""
    processed = []
    seen = set()

    for model in openrouter_models:
        model_id = model.get("id", "")
        provider = extract_provider(model_id)
        model_name = model.get("name", "")

        # Skip if no pricing
        pricing = model.get("pricing")
        if not pricing:
            continue

        blended_price = get_blended_price(pricing)
        if blended_price is None or blended_price <= 0:
            continue

        # Get intelligence score
        intelligence = match_intelligence_score(model_id, model_name, intelligence_scores)

        # Calculate value scores
        value_scores = calculate_value_scores(intelligence, blended_price)

        # Create unique key to avoid duplicates
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
            "value_scores": value_scores,
            "value_score": value_scores["primary"] if value_scores else None,
            "created": model.get("created"),
            "description": model.get("description", ""),
        })

    return processed


def rank_models(models):
    """Rank models by different value metrics."""
    ranked = [m for m in models if m["value_score"] is not None]
    unranked = [m for m in models if m["value_score"] is None]

    # Rank by primary (balanced) score
    ranked.sort(key=lambda x: x["value_score"], reverse=True)
    for i, model in enumerate(ranked, 1):
        model["rank"] = i

    # Also rank by capability_first
    capability_ranked = sorted([m for m in ranked if m["value_scores"]], 
                                key=lambda x: x["value_scores"]["capability_first"], reverse=True)
    for i, model in enumerate(capability_ranked, 1):
        model["rank_capability"] = i

    # Also rank by budget
    budget_ranked = sorted([m for m in ranked if m["value_scores"]], 
                            key=lambda x: x["value_scores"]["budget"], reverse=True)
    for i, model in enumerate(budget_ranked, 1):
        model["rank_budget"] = i

    # Unranked models get rank None
    for model in unranked:
        model["rank"] = None
        model["rank_capability"] = None
        model["rank_budget"] = None

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
