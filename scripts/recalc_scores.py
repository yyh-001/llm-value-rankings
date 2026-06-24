#!/usr/bin/env python3
"""Recalculate value scores from existing models.json (offline)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fetch_data import (
    OUTPUT_FILE,
    apply_rank_changes,
    calculate_value_scores,
    compute_avg_intelligence,
    load_rank_history,
    rank_models,
    refresh_pricing_blended,
    save_data,
)


def main():
    with open(OUTPUT_FILE, encoding="utf-8") as f:
        data = json.load(f)

    models = data["models"]
    intelligence_map = {
        model["id"]: model["intelligence_score"]
        for model in models
        if model.get("intelligence_score") is not None
    }
    avg_intelligence = compute_avg_intelligence(intelligence_map)

    for model in models:
        pricing = refresh_pricing_blended(model.get("pricing") or {})
        model["pricing"] = pricing
        blended = pricing.get("blended")
        if "distill" in model["id"].lower():
            model["value_score"] = None
        else:
            model["value_score"] = calculate_value_scores(
                model.get("intelligence_score"),
                blended,
                model.get("speed"),
                avg_intelligence,
            )

    models = rank_models(models)
    history = load_rank_history()
    compare_day = apply_rank_changes(models, history)
    save_data(models, compare_day)

    ranked = [m for m in models if m.get("rank")]
    print(f"Ranked: {len(ranked)} / {len(models)}")
    print("Top 5:")
    for model in ranked[:5]:
        print(
            f"  #{model['rank']} {model['name'][:45]} | "
            f"intel={model.get('intelligence_score')} | value={model.get('value_score')}"
        )
    excluded = sum(
        1
        for m in models
        if m.get("intelligence_score") is not None
        and m["intelligence_score"] < 25
        and m.get("value_score") is None
    )
    print(f"Excluded (intel < 25): {excluded}")


if __name__ == "__main__":
    main()
