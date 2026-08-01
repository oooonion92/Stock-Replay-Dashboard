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
        industry_relay = [{
            "name": str(item["所属行业"]),
            "limitUps": int(item["limitUps"]),
            "firstBoards": int(item["firstBoards"]),
            "maxBoards": int(item["maxBoards"]),
            "brokenPool": int(item["brokenPool"]),
        } for _, item in industry.iterrows()]

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
        },
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
