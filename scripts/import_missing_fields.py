#!/usr/bin/env python3
"""
补导 published_at 和 source_url 字段

从原始 Excel 文件读取并更新到数据库
"""
import os
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


def find_excel_file():
    """查找 Excel 数据文件"""
    possible_paths = [
        "a13基于AI的大学生职业规划智能体-JD采样数据.xls",
        "../a13基于AI的大学生职业规划智能体-JD采样数据.xls",
        Path(__file__).parent.parent / "a13基于AI的大学生职业规划智能体-JD采样数据.xls",
    ]
    for p in possible_paths:
        if os.path.exists(p):
            return p
    return None


def import_missing_fields():
    """从 Excel 补导 published_at 和 source_url"""
    excel_file = find_excel_file()
    if not excel_file:
        print("ERROR: Excel file not found!")
        return

    print(f"Reading: {excel_file}")

    # 读取 Excel
    df = pd.read_excel(excel_file)

    # 打印列名（调试用）
    print(f"Columns: {list(df.columns)}")

    # 查找对应列
    # 岗位编码 -> job_code
    # 更新日期 -> published_at
    # 岗位来源地址 -> source_url
    col_map = {}
    for col in df.columns:
        col_lower = col.lower() if isinstance(col, str) else ""
        if "编码" in col or "code" in col_lower:
            col_map["job_code"] = col
        elif "更新" in col or "日期" in col:
            col_map["published_at"] = col
        elif "来源" in col or "地址" in col:
            col_map["source_url"] = col

    print(f"Column mapping: {col_map}")

    if "job_code" not in col_map:
        print("ERROR: Cannot find job_code column!")
        return

    # 连接到数据库
    engine = create_engine('postgresql+psycopg2://postgres:postgres@localhost:5433/career_planning')
    Session = sessionmaker(bind=engine)
    session = Session()

    # 批量更新
    updated = 0
    for _, row in df.iterrows():
        job_code = str(row.get(col_map.get("job_code", ""), ""))
        if not job_code or job_code == "nan":
            continue

        # 获取更新日期
        published_at = None
        if "published_at" in col_map:
            val = row.get(col_map["published_at"])
            if pd.notna(val) and str(val) != "nan":
                published_at = str(val)

        # 获取来源地址
        source_url = None
        if "source_url" in col_map:
            val = row.get(col_map["source_url"])
            if pd.notna(val) and str(val) != "nan":
                source_url = str(val)

        if published_at or source_url:
            session.execute(text("""
                UPDATE jobs
                SET published_at = COALESCE(:published_at, published_at),
                    source_url = COALESCE(:source_url, source_url)
                WHERE job_code = :job_code
            """), {
                "published_at": published_at,
                "source_url": source_url,
                "job_code": job_code,
            })
            updated += 1

        if updated % 1000 == 0:
            session.commit()
            print(f"  Processed {updated}...")

    session.commit()
    print(f"\nUpdated {updated} records")

    # 验证
    result = session.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(published_at) as has_date,
            COUNT(source_url) as has_url
        FROM jobs
    """)).first()
    print(f"\nVerification:")
    print(f"  Total jobs: {result[0]}")
    print(f"  Has published_at: {result[1]}")
    print(f"  Has source_url: {result[2]}")

    session.close()


if __name__ == "__main__":
    import_missing_fields()
