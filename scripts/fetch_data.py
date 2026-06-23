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
    Returns dict mapping model names to their intelligence scores.
    
    These scores are from the Artificial Analysis Intelligence Index (0-100 scale),
    which combines multiple benchmarks including MMLU, HumanEval, MATH, etc.
    """
    print("Fetching intelligence scores from Artificial Analysis...")
    
    # Scores from Artificial Analysis Intelligence Index (June 2026)
    # Source: https://artificialanalysis.ai/leaderboards/models
    # Scale: 0-100, where higher is better
    scores = {
        # ===== Tier 1: Top Frontier (60+) =====
        # Anthropic
        "claude-opus-4": 76,
        "claude-opus-4.7": 76,
        "claude-opus-4.8": 76,
        "claude-fable-5": 78,
        "claude-sonnet-4": 72,
        "claude-sonnet-4.6": 72,
        "claude-3.5-sonnet": 69,
        "claude-3-opus": 67,
        "claude-4-5-haiku": 62,
        "claude-3.5-haiku": 60,
        
        # OpenAI
        "gpt-5.5": 75,
        "o3": 74,
        "o4-mini": 70,
        "gpt-4.1": 70,
        "gpt-4o": 68,
        "gpt-4-turbo": 65,
        "gpt-5.4-mini": 65,
        "gpt-4.1-mini": 63,
        "gpt-4o-mini": 62,
        "gpt-4.1-nano": 58,
        "gpt-5.4-nano": 60,
        
        # Google
        "gemini-2.5-pro": 74,
        "gemini-3.1-pro": 72,
        "gemini-3.5-flash": 70,
        "gemini-2.0-pro": 68,
        "gemini-2.5-flash": 66,
        "gemini-2.0-flash": 64,
        "gemini-1.5-pro": 63,
        "gemini-3.1-flash-lite": 55,
        "gemini-1.5-flash": 58,
        
        # DeepSeek
        "deepseek-r1": 72,
        "deepseek-v4-pro": 70,
        "deepseek-v3": 64,
        "deepseek-v4-flash": 62,
        "deepseek-chat": 60,
        "deepseek-coder": 62,
        
        # xAI
        "grok-4.3": 72,
        "grok-3": 70,
        "grok-2": 63,
        
        # ===== Tier 2: Strong (50-59) =====
        # Meta
        "llama-4-maverick": 65,
        "llama-4-scout": 60,
        "llama-3.1-405b": 61,
        "llama-3.1-70b": 57,
        "llama-3.3-70b": 58,
        "llama-3.1-8b": 45,
        "llama-3-8b": 42,
        
        # Mistral
        "mistral-large": 59,
        "mistral-medium": 54,
        "mistral-small": 50,
        "codestral": 58,
        
        # Qwen / Alibaba
        "qwen-2.5-72b": 58,
        "qwen-2.5-coder-32b": 56,
        "qwq-32b": 61,
        "qwen3.7-max": 68,
        "qwen3.6-plus": 62,
        "qwen3.5-397b": 60,
        
        # Cohere
        "command-r-plus": 55,
        "command-r": 50,
        "command-a": 58,
        
        # Amazon
        "nova-pro": 52,
        "nova-lite": 45,
        
        # NVIDIA
        "nemotron-3-ultra": 58,
        "nemotron-3-super": 52,
        
        # Others
        "minimax-m3": 65,
        "glm-5.2": 66,
        "glm-5.1": 60,
        "kimi-k2.6": 64,
        "kimi-k2.7": 66,
        "mimo-v2.5-pro": 64,
        "step-3.7-flash": 55,
        "hy3": 58,
    }
    
    print(f"  Using intelligence scores for {len(scores)} models")
    return scores


def match_intelligence_score(model_id, model_name, scores):
    """Try to match a model to its intelligence score."""
    model_id_lower = model_id.lower()
    model_name_lower = model_name.lower() if model_name else ""
    
    # Extract the model part after the provider slash
    model_part = model_id_lower.split("/")[-1] if "/" in model_id_lower else model_id_lower
    
    # Direct match - check if key is in model_id or model_name
    for key, score in scores.items():
        if key in model_id_lower or key in model_name_lower:
            return score
    
    # Try matching model part
    for key, score in scores.items():
        if key in model_part:
            return score
    
    # Version-aware partial matches
    for key, score in scores.items():
        # Normalize version separators
        key_normalized = key.replace(".", "-").replace("_", "-")
        model_normalized = model_part.replace(".", "-").replace("_", "-")
        
        # Check if key parts are in model
        key_parts = key_normalized.split("-")
        if len(key_parts) >= 2:
            # Check first two significant parts
            if key_parts[0] in model_normalized and key_parts[1] in model_normalized:
                return score
    
    # Special handling for common patterns
    # Claude models
    if "claude" in model_id_lower:
        if "opus" in model_id_lower:
            return scores.get("claude-opus-4", 76)
        elif "sonnet" in model_id_lower:
            return scores.get("claude-sonnet-4", 72)
        elif "haiku" in model_id_lower:
            return scores.get("claude-4-5-haiku", 62)
    
    # GPT models
    if "gpt-5" in model_id_lower:
        if "mini" in model_id_lower:
            return 65
        elif "nano" in model_id_lower:
            return 60
        return 75
    if "gpt-4o" in model_id_lower:
        if "mini" in model_id_lower:
            return 62
        return 68
    if "gpt-4.1" in model_id_lower:
        if "mini" in model_id_lower:
            return 63
        if "nano" in model_id_lower:
            return 58
        return 70
    
    # Gemini models
    if "gemini" in model_id_lower:
        if "2.5-pro" in model_id_lower or "3" in model_id_lower:
            return 74
        if "flash" in model_id_lower:
            if "lite" in model_id_lower:
                return 55
            return 66
        if "pro" in model_id_lower:
            return 68
        return 60
    
    # DeepSeek models
    if "deepseek" in model_id_lower:
        if "r1" in model_id_lower:
            return 72
        if "v4" in model_id_lower:
            if "flash" in model_id_lower:
                return 62
            return 70
        if "v3" in model_id_lower:
            return 64
        return 60
    
    # Llama models
    if "llama" in model_id_lower:
        if "4" in model_id_lower:
            if "maverick" in model_id_lower:
                return 65
            return 60
        if "3.1" in model_id_lower or "3.2" in model_id_lower:
            if "405" in model_id_lower:
                return 61
            if "70" in model_id_lower:
                return 57
            if "8" in model_id_lower:
                return 45
        return 50
    
    # Qwen models
    if "qwen" in model_id_lower:
        if "3.7" in model_id_lower or "3.6" in model_id_lower:
            return 65
        if "2.5" in model_id_lower:
            if "72" in model_id_lower or "70" in model_id_lower:
                return 58
            if "coder" in model_id_lower:
                return 56
        return 55
    
    # Grok models
    if "grok" in model_id_lower:
        if "4" in model_id_lower:
            return 72
        if "3" in model_id_lower:
            return 70
        return 63
    
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
