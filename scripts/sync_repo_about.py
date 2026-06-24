#!/usr/bin/env python3
"""Sync repository About (homepage, description, topics) from .github/about.json."""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ABOUT_FILE = ROOT / ".github" / "about.json"
REPO = os.environ.get("GITHUB_REPOSITORY", "yyh-001/llm-value-rankings")


def run(args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.stdout:
        print(result.stdout.strip())
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.strip(), file=sys.stderr)
        sys.exit(result.returncode)


def main():
    with open(ABOUT_FILE, encoding="utf-8") as f:
        about = json.load(f)

    if not os.environ.get("GH_TOKEN") and not shutil_which("gh"):
        print("Install GitHub CLI and run: gh auth login", file=sys.stderr)
        sys.exit(1)

    print(f"Updating About for {REPO}...")
    run([
        "gh", "api", "--method", "PATCH", f"/repos/{REPO}",
        "-f", f"homepage={about['homepage']}",
        "-f", f"description={about['description']}",
    ])

    topics_file = ROOT / "topics.json"
    topics_file.write_text(json.dumps({"names": about["topics"]}), encoding="utf-8")
    run([
        "gh", "api", "--method", "PUT", f"/repos/{REPO}/topics",
        "--input", str(topics_file),
        "-H", "Accept: application/vnd.github.mercy-preview+json",
    ])
    topics_file.unlink(missing_ok=True)
    print("Done.")


def shutil_which(cmd):
    from shutil import which
    return which(cmd)


if __name__ == "__main__":
    main()
