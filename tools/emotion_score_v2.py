#!/usr/bin/env python3
"""Deterministic V2 scoring for the 50-point market-emotion sleeve.

The old score had a fixed 10-point emotional baseline and a separate expert
sentiment allowance. V2 removes both and scores only two observable sleeves:

* previous-day strong-stock premium *and quality*;
* today's sealing success *and quality*.

The functions deliberately return both points and auditable reasons, so the
daily report can never show a score without the data that led to it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, int(value)))


def _number(source: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = source.get(key)
    return float(value) if value is not None else default


@dataclass(frozen=True)
class Component:
    label: str
    score: int
    maximum: int
    reason: str


def strong_stock_quality(short_term: dict[str, Any]) -> Component:
    """Score yesterday's sealed names by return *and* their intraday outcome.

    A positive close is a prerequisite.  This stops a small group of repaired
    limit-ups from offsetting the majority of prior leaders that failed to make
    money. It is the entire first 25-point pillar, rather than a small
    adjustment hidden beside a fixed emotional baseline.
    """
    feedback = short_term.get("feedback") or {}
    quality = feedback.get("quality") or {}
    sample = _number(feedback, "sample")
    median = _number(feedback, "median")
    positive = _number(feedback, "positiveRate")
    sealed = quality.get("sealedAgain") or {}
    broken = quality.get("brokenUnsealed") or {}
    sealed_rate = (_number(sealed, "count") / sample * 100) if sample else 0
    broken_rate = (_number(broken, "count") / sample * 100) if sample else 0
    low_return = _number(quality, "lowReturnRate")
    reclosed_break = _number(quality, "reclosedAfterBreakRate")

    one_to_two = _number(short_term.get("promotion") or {}, "oneToTwo")

    # The close-payout gate: no aggregate reward if the typical prior winner
    # failed to earn money today. A few re-sealed names cannot cover for the
    # majority of yesterday's leaders failing to make money.
    if median <= 0 or positive < 50:
        score = 0
    else:
        score = 2 if median >= 4 else 1 if median >= 2 else 0
        score += 4 if positive >= 70 else 3 if positive >= 60 else 2
        score += 5 if sealed_rate >= 30 else 3 if sealed_rate >= 20 else 2 if sealed_rate >= 15 else 1 if sealed_rate >= 10 else 0
        score += 4 if low_return <= 30 else 2 if low_return <= 45 else 0
        score += 3 if broken_rate <= 5 and reclosed_break <= 35 else 1 if broken_rate <= 10 and reclosed_break <= 50 else 0
        score += 3 if one_to_two >= 30 else 2 if one_to_two >= 20 else 1 if one_to_two >= 10 else 0
    score = clamp(score, 0, 25)
    reason = (
        f"样本{int(sample)}只，收盘中位{median:+.2f}%、收红{positive:.1f}%；"
        f"最终再封{int(_number(sealed, 'count'))}只（{sealed_rate:.1f}%）、"
        f"炸板未回封{int(_number(broken, 'count'))}只（{broken_rate:.1f}%）、"
        f"收益低于+2%占{low_return:.1f}%，再封中曾炸板占{reclosed_break:.1f}%。"
    )
    return Component("强势股次日溢价与质量", score, 25, reason)


def sealing_quality(short_term: dict[str, Any]) -> Component:
    """Score today's board ecology; high board count alone earns no points."""
    emotion = short_term.get("emotion") or {}
    promotion = short_term.get("promotion") or {}
    quality = short_term.get("sealQuality") or {}
    seal_rate = _number(emotion, "sealRate")
    one_to_two = _number(promotion, "oneToTwo")
    break_rate = _number(quality, "sealedWithBreakRate")
    avg_breaks = _number(quality, "averageBreaksOnSealed")

    dt = _number(emotion, "dt")
    score = 10 if seal_rate >= 80 else 8 if seal_rate >= 70 else 6 if seal_rate >= 60 else 3 if seal_rate >= 50 else 0
    score += 5 if break_rate <= 20 else 3 if break_rate <= 35 else 1 if break_rate <= 45 else 0
    score += 5 if avg_breaks <= 0.5 else 3 if avg_breaks <= 1.2 else 1 if avg_breaks <= 2 else 0
    score += 3 if one_to_two >= 30 else 2 if one_to_two >= 20 else 1 if one_to_two >= 10 else 0
    score += 2 if dt == 0 else 1 if dt <= 10 else 0
    score = clamp(score, 0, 25)
    reason = (
        f"封板率{seal_rate:.2f}%、1进2 {one_to_two:.2f}%；"
        f"最终封板中{break_rate:.2f}%曾炸板，平均炸板{avg_breaks:.2f}次。"
    )
    return Component("当日封板成功率与质量", score, 25, reason)


def score_emotion(*, short_term: dict[str, Any]) -> dict[str, Any]:
    """Return the new 50-point emotion score and all component evidence."""
    prior = strong_stock_quality(short_term)
    sealing = sealing_quality(short_term)
    components = [prior, sealing]
    total = sum(item.score for item in components)
    return {
        "version": "emotion-v2",
        "total": total,
        "maximum": 50,
        "components": [item.__dict__ for item in components],
    }
