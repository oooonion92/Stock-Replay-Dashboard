#!/usr/bin/env python3
r"""Convert daily short-term collection workbooks into the Pages data layer.

Example (Windows):
  python tools\import_short_term_data.py --source "D:\OneDrive\Stock\短线数据采集"

The script only rewrites short-term-data.js. It never changes data.js or the
source collection files, so the short-term layer can be validated separately
from the existing 100-point market score.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd


def clean(value: Any) -> Any:
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def percent(value: Any) -> float | None:
    value = clean(value)
    return round(float(value), 2) if value is not None else None


def number(value: Any) -> int | float | None:
    value = clean(value)
    if value is None:
        return None
    value = float(value)
    return int(value) if value.is_integer() else value


def seal_time(value: Any) -> str | None:
    """Normalize collector time values such as 92500 / '092500' to HH:MM."""
    value = clean(value)
    if value is None:
        return None
    text = str(value).replace(".0", "").zfill(6)
    return f"{text[:2]}:{text[2:4]}" if text.isdigit() and len(text) == 6 else None


def normalize_code(value: Any) -> str | None:
    """Return a six-digit A-share code or None for an unusable value."""
    value = clean(value)
    if value is None:
        return None
    digits = "".join(char for char in str(value) if char.isdigit())
    return digits[-6:].zfill(6) if digits else None


def summary_row(summary: pd.DataFrame, compact_date: str) -> pd.Series | None:
    if summary.empty or "交易日期" not in summary:
        return None
    dates = summary["交易日期"].astype("string").str.replace(r"\.0$", "", regex=True)
    match = summary.loc[dates.eq(compact_date)]
    return match.iloc[-1] if not match.empty else None


def value(frame: pd.DataFrame, column: str, fallback: Any = None) -> Any:
    return frame.iloc[0][column] if column in frame and not frame.empty else fallback


def load_day(day_dir: Path, summary: pd.DataFrame) -> tuple[str, dict[str, Any]]:
    compact_date = day_dir.name
    workbook = day_dir / f"短线数据_{compact_date}.xlsx"
    if not workbook.exists():
        raise FileNotFoundError(workbook)
    date = f"{compact_date[:4]}-{compact_date[4:6]}-{compact_date[6:]}"
    overview = pd.read_excel(workbook, sheet_name="概览")
    status = pd.read_excel(workbook, sheet_name="数据源状态")
    promotion = pd.read_excel(workbook, sheet_name="晋级率")
    ladder = pd.read_excel(workbook, sheet_name="连板梯队", dtype={"代码": "string"})
    feedback = pd.read_excel(workbook, sheet_name="昨日涨停反馈", dtype={"代码": "string"})
    zt_pool = pd.read_excel(workbook, sheet_name="涨停池", dtype={"代码": "string"})
    zb_pool = pd.read_excel(workbook, sheet_name="炸板池", dtype={"代码": "string"})
    row = summary_row(summary, compact_date)

    def summary_value(name: str, fallback: Any = None) -> Any:
        return row[name] if row is not None and name in row else fallback

    promo = {str(item["层级"]): item for _, item in promotion.iterrows()}
    feedback_change = pd.to_numeric(feedback.get("涨跌幅"), errors="coerce").dropna()
    feedback_status = feedback.get("反馈数据状态", pd.Series("接口返回", index=feedback.index)).astype("string")

    # The feedback sheet records yesterday's sealed names and today's close.
    # Joining it to today's final limit-up and broken-board pools captures the
    # path quality that a close-only median cannot see.
    feedback = feedback.copy()
    zt_pool = zt_pool.copy()
    zb_pool = zb_pool.copy()
    for frame in (feedback, zt_pool, zb_pool):
        frame["_code"] = frame.get("代码", pd.Series(index=frame.index, dtype="string")).map(normalize_code)
    feedback_valid = feedback.loc[feedback["_code"].notna()].copy()
    zt_codes = set(zt_pool.loc[zt_pool["_code"].notna(), "_code"])
    zb_codes = set(zb_pool.loc[zb_pool["_code"].notna(), "_code"])
    feedback_valid["_change"] = pd.to_numeric(feedback_valid.get("涨跌幅"), errors="coerce")
    feedback_valid["_sealed_again"] = feedback_valid["_code"].isin(zt_codes)
    feedback_valid["_broken_unsealed"] = feedback_valid["_code"].isin(zb_codes - zt_codes)
    feedback_valid["_low_return"] = feedback_valid["_change"].lt(2)
    zt_breaks = pd.to_numeric(zt_pool.get("炸板次数"), errors="coerce").fillna(0)
    reclosed_codes = set(zt_pool.loc[zt_breaks.gt(0) & zt_pool["_code"].notna(), "_code"])

    def bucket_summary(mask: pd.Series) -> dict[str, Any]:
        bucket = feedback_valid.loc[mask, "_change"].dropna()
        return {
            "count": int(len(bucket)),
            "median": percent(bucket.median()),
            "positiveRate": percent((bucket.gt(0).mean() * 100) if len(bucket) else None),
        }

    sealed_again = feedback_valid["_sealed_again"]
    broken_unsealed = feedback_valid["_broken_unsealed"]
    sealed_count = int(sealed_again.sum())
    feedback_quality = {
        "sealedAgain": bucket_summary(sealed_again),
        "brokenUnsealed": bucket_summary(broken_unsealed),
        "other": bucket_summary(~sealed_again & ~broken_unsealed),
        "lowReturnCount": int(feedback_valid["_low_return"].sum()),
        "lowReturnRate": percent((feedback_valid["_low_return"].mean() * 100) if len(feedback_valid) else None),
        "reclosedAfterBreakCount": int((feedback_valid["_code"].isin(reclosed_codes) & sealed_again).sum()),
        "reclosedAfterBreakRate": percent(
            ((feedback_valid["_code"].isin(reclosed_codes) & sealed_again).sum() / sealed_count * 100)
            if sealed_count else None
        ),
    }
    current_zt_breaks = pd.to_numeric(zt_pool.get("炸板次数"), errors="coerce").fillna(0)
    current_quality = {
        "sealedWithBreakCount": int(current_zt_breaks.gt(0).sum()),
        "sealedWithBreakRate": percent((current_zt_breaks.gt(0).mean() * 100) if len(current_zt_breaks) else None),
        "averageBreaksOnSealed": percent(current_zt_breaks.mean()),
    }
    ladder_items = []
    if not ladder.empty and "连板数" in ladder:
        for level, group in ladder.groupby("连板数", sort=False):
            ladder_items.append({
                "level": int(level),
                "count": int(len(group)),
                "names": [str(name) for name in group.get("名称", pd.Series(dtype="string")).dropna().tolist()],
            })

    industry_relay: list[dict[str, Any]] = []
    if {"所属行业", "连板数"}.issubset(zt_pool.columns):
        zt_pool = zt_pool.copy()
        zt_pool["连板数"] = pd.to_numeric(zt_pool["连板数"], errors="coerce")
        industry = zt_pool.groupby("所属行业", dropna=True).agg(
            limitUps=("代码", "size"),
            firstBoards=("连板数", lambda values: int(values.eq(1).sum())),
            maxBoards=("连板数", "max"),
        ).reset_index()
        if "所属行业" in zb_pool:
            broken = zb_pool.groupby("所属行业", dropna=True).size().rename("brokenPool").reset_index()
            industry = industry.merge(broken, on="所属行业", how="left")
        else:
            industry["brokenPool"] = 0
        industry["brokenPool"] = industry["brokenPool"].fillna(0).astype(int)
        industry = industry.sort_values(["limitUps", "maxBoards", "firstBoards"], ascending=[False, False, False]).head(6)
        industry_relay = []
        for _, item in industry.iterrows():
            industry_name = str(item["所属行业"])
            limit_ups = zt_pool.loc[zt_pool["所属行业"].eq(industry_name)].copy()
            broken_pool = zb_pool.loc[zb_pool.get("所属行业", pd.Series(index=zb_pool.index, dtype="string")).eq(industry_name)].copy()

            def stock_rows(frame: pd.DataFrame, kind: str) -> list[dict[str, Any]]:
                rows: list[dict[str, Any]] = []
                for _, stock in frame.iterrows():
                    rows.append({
                        "kind": kind,
                        "code": str(stock.get("代码", "")),
                        "name": str(stock.get("名称", "")),
                        "boards": number(stock.get("连板数")),
                        "firstSeal": seal_time(stock.get("首次封板时间")),
                        "lastSeal": seal_time(stock.get("最后封板时间")),
                        "sealAmount": number(stock.get("封板资金")),
                        "breaks": number(stock.get("炸板次数")) or 0,
                        "amount": number(stock.get("成交额")),
                        "turnover": percent(stock.get("换手率")),
                    })
                return rows

            stocks = stock_rows(limit_ups, "limitUp") + stock_rows(broken_pool, "broken")
            stocks.sort(key=lambda stock: (stock["kind"] != "limitUp", -(stock["boards"] or 0), stock["firstSeal"] or "99:99"))
            industry_relay.append({
                "name": industry_name,
                "limitUps": int(item["limitUps"]),
                "firstBoards": int(item["firstBoards"]),
                "maxBoards": int(item["maxBoards"]),
                "brokenPool": int(item["brokenPool"]),
                "stocks": stocks,
            })

    success_states = {"success", "success_empty"}
    state = "complete" if status.get("state", pd.Series(dtype="string")).isin(success_states).all() else "partial"
    data = {
        "source": "东方财富收盘涨停/炸板/跌停池",
        "state": state,
        "emotion": {
            "zt": number(value(overview, "涨停家数")),
            "zb": number(value(overview, "炸板家数")),
            "dt": number(value(overview, "跌停家数")),
            "sealRate": percent(value(overview, "封板率_pct")),
            "breakRate": percent(value(overview, "炸板率_pct")),
            "firstBoard": number(value(overview, "首板家数")),
            "maxBoards": number(value(overview, "最高连板")),
            "lianban": number(value(overview, "连板家数")),
        },
        "promotion": {
            "oneToTwo": percent(promo.get("1进2", {}).get("晋级率_pct")),
            "oneToTwoNumerator": number(promo.get("1进2", {}).get("晋级数")),
            "oneToTwoDenominator": number(promo.get("1进2", {}).get("昨日样本数")),
            "twoToThree": percent(promo.get("2进3", {}).get("晋级率_pct")),
            "threePlus": percent(promo.get("3板及以上", {}).get("晋级率_pct")),
        },
        "feedback": {
            "sample": int(len(feedback_change)),
            "median": percent(feedback_change.median()),
            "average": percent(feedback_change.mean()),
            "positiveRate": percent((feedback_change.gt(0).mean() * 100) if len(feedback_change) else None),
            "limitUpAgainRate": percent(summary_value("昨日涨停再次涨停率_pct")),
            "deepLoss5": int(feedback_change.le(-5).sum()),
            "deepLoss7": int(feedback_change.le(-7).sum()),
            "worst": percent(feedback_change.min()),
            "missingFeedback": int(feedback_status.eq("反馈接口缺失").sum()),
            "quality": feedback_quality,
        },
        "sealQuality": current_quality,
        "ladder": ladder_items,
        "industryRelay": industry_relay,
    }
    return date, data


def main() -> int:
    parser = argparse.ArgumentParser(description="更新 Pages 的短线生态静态数据")
    parser.add_argument("--source", type=Path, required=True, help="短线数据采集目录")
    parser.add_argument("--output", type=Path, default=Path("short-term-data.js"), help="输出 JS 文件")
    args = parser.parse_args()

    summary_path = args.source / "DB_Short_Term_Summary.csv"
    summary = pd.read_csv(summary_path, dtype={"交易日期": "string"}) if summary_path.exists() else pd.DataFrame()
    payload: dict[str, Any] = {}
    for day_dir in sorted(args.source.iterdir()):
        if day_dir.is_dir() and day_dir.name.isdigit() and len(day_dir.name) == 8:
            date, data = load_day(day_dir, summary)
            payload[date] = data

    output = "/* Generated by tools/import_short_term_data.py. */\n"
    output += "window.REPLAY_DATA = window.REPLAY_DATA || {};\n"
    output += "window.REPLAY_DATA.shortTerm = "
    output += json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False)
    output += ";\n"
    temp = args.output.with_suffix(args.output.suffix + ".tmp")
    temp.write_text(output, encoding="utf-8")
    os.replace(temp, args.output)
    print(f"updated {args.output} with {len(payload)} trading days")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
