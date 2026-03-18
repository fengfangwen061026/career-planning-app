#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
重新生成所有岗位画像（适配 V3 Schema）
用法：
    python regenerate_all_profiles.py              # 重新生成全部
    python regenerate_all_profiles.py --role "测试" # 处理单个 role
"""

import argparse
import asyncio
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import select, delete
from app.database import async_session_factory
from app.models.job import Role, JobProfile
from app.services.job_profile import generate_role_profile


async def regenerate_all(specific_role: str | None = None):
    """删除并重新生成所有岗位画像."""
    # 获取所有 role
    async with async_session_factory() as session:
        stmt = select(Role).order_by(Role.name)
        if specific_role:
            stmt = stmt.where(Role.name == specific_role)
        result = await session.execute(stmt)
        roles = list(result.scalars().all())

    if not roles:
        print("No roles found")
        return

    print(f"Found {len(roles)} roles to process")

    for role in roles:
        async with async_session_factory() as session:
            # 删除旧画像
            await session.execute(
                delete(JobProfile).where(JobProfile.role_id == role.id)
            )
            await session.commit()

        print(f"\nRegenerating: {role.name} (id={role.id})")
        try:
            async with async_session_factory() as session:
                result = await generate_role_profile(role.id, session)
                await session.commit()
                print(f"  [OK] Profile v{result['profile'].version} saved")
                print(f"  Stats: {result['stats']}")
        except Exception as e:
            print(f"  [FAIL] {e}")
            import traceback
            traceback.print_exc()

        # 避免 LLM 限流
        await asyncio.sleep(2)

    print("\nDone!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="重新生成所有岗位画像（V3 Schema）")
    parser.add_argument('--role', type=str, help='指定单个 role 名称')
    args = parser.parse_args()

    asyncio.run(regenerate_all(args.role))
