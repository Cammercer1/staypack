"""Run after the cache fixture/migration in an empty disposable PostgreSQL Docker container.

Usage: python3 supabase/tests/airroi_calculator_cache_concurrency.py CONTAINER
Never connect this fixture test to the application database.
"""

import concurrent.futures
import json
import secrets
import subprocess
import sys
import uuid


container = sys.argv[1]


def query(sql):
    result = subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=sql, text=True, capture_output=True, check=True,
    )
    return result.stdout.strip()


# Fail closed unless the explicitly supplied container contains our fixture.
assert query("select final_report_json->>'published' from public.reports where id=1") == "unchanged"
key = secrets.token_hex(32)
owners = [str(uuid.uuid4()) for _ in range(12)]


def claim(owner):
    response = query(f"set role service_role; select public.claim_airroi_calculator_cache('{key}','{owner}');")
    return owner, json.loads(response)


try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(claim, owners))
    winners = [owner for owner, result in results if result["status"] == "claimed"]
    assert len(winners) == 1, results
    assert sum(result["status"] == "pending" for _, result in results) == 11, results
    query(f"set role service_role; select public.complete_airroi_calculator_cache('{key}','{winners[0]}','{{\"revenue\":123}}');")
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(claim, owners))
    assert all(result["status"] == "hit" for _, result in results), results
    assert query(f"select fetch_count || ':' || hit_count from public.airroi_calculator_cache where request_key='{key}'") == "1:12"
    print("Cache concurrency passed: 12 contenders, one provider lease; 12 subsequent cache hits.")
finally:
    query(f"set role service_role; delete from public.airroi_calculator_cache where request_key='{key}';")
