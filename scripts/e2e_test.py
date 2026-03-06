"""E2E Test"""
import asyncio, os, sys, time, uuid
from datetime import datetime
from pathlib import Path
import httpx
sys.path.insert(0, 'backend')

BASE = "http://localhost:8000"

async def main():
    print("="*50 + "\n  E2E Test\n" + "="*50)
    open("scripts/issues.md", "w").write(f"# Issues\n\n")
    t0 = time.time()
    
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as c:
        # Step 0: Service
        print("\n[0] Check Service")
        r = await c.get("/docs")
        print(f"  Service: {r.status_code == 200}")
        
        # Step 1: DB
        print("\n[1] DB Data")
        r = await c.get("/api/roles/")
        rc = len(r.json()) if r.status_code == 200 else 0
        print(f"  Roles: {rc}/20")
        r = await c.get("/api/jobs/?page_size=1")
        jc = r.json().get("total", 0) if r.status_code == 200 else 0
        print(f"  Jobs: {jc}/10000")
        
        # Step 2: Upload
        print("\n[2] Upload Resume")
        sid = str(uuid.uuid4())
        try:
            r = await c.post("/api/students/", json={"email": f"test{sid}@ex.com", "name": "Test"})
            if r.status_code == 201:
                sid = r.json()["id"]
        except Exception as e:
            print(f"  Error: {e}")
        
        # Step 3: Profile
        print("\n[3] Get Profile")
        r = await c.get(f"/api/students/{sid}/profile")
        print(f"  Status: {r.status_code}")
        
        # Step 4: Recommend
        print("\n[4] Recommend Jobs")
        r = await c.post(f"/api/matching/recommend/{sid}", json={"top_k": 5})
        if r.status_code == 200:
            m = r.json().get("results", [])
            print(f"  Found: {len(m)} jobs")
            jid = m[0].get("job_profile_id") if m else None
        else:
            jid = None
        
        # Step 5: Match
        print("\n[5] Match Job")
        if jid:
            r = await c.post("/api/matching/match", json={"student_id": sid, "job_profile_id": jid})
            print(f"  Status: {r.status_code}")
        
        # Step 6: Path
        print("\n[6] Career Path")
        r = await c.post("/api/graph/student-path", json={"student_profile": {}, "target_role": "SoftEng", "target_level": "expert"})
        print(f"  Status: {r.status_code}")
        
        # Step 7: Report
        print("\n[7] Generate Report")
        r = await c.post(f"/api/reports/generate/{sid}")
        if r.status_code == 200:
            rid = r.json().get("id", "")
            print(f"  Report ID: {rid[:8]}...")
        else:
            rid = None
        
        # Step 8: Export
        print("\n[8] Export PDF")
        if rid:
            r = await c.post(f"/api/reports/{rid}/export", params={"format": "pdf"})
            print(f"  Status: {r.status_code}")
    
    print(f"\n{'='*50}\nDone: {time.time()-t0:.1f}s")

if __name__ == "__main__": asyncio.run(main())
