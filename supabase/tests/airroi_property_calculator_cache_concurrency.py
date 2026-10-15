"""Exercise property-cache leases in independent PostgreSQL 17 sessions.

Run only after the disposable cache fixture and both cache migrations:
python3 supabase/tests/airroi_property_calculator_cache_concurrency.py CONTAINER
"""

import concurrent.futures
import hashlib
import json
import subprocess
import sys
import uuid


container = sys.argv[1]
run_id = str(uuid.uuid4())
owners = [str(uuid.uuid4()) for _ in range(12)]
created_keys = set()


def key(label):
    return hashlib.sha256(f"{run_id}:{label}".encode()).hexdigest()


def query(sql):
    result = subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=sql, text=True, capture_output=True, check=True,
    )
    return result.stdout.strip()


def claim(request_key, legacy_key, owner, property_key, provider_input):
    created_keys.add(request_key)
    payload = json.dumps(provider_input)
    result = query(
        "set role service_role; select public.claim_airroi_property_calculator_cache("
        f"'{request_key}','{legacy_key}','{owner}','{property_key}','{key('config')}','{payload}');"
    )
    return json.loads(result)


def run_concurrent(function):
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        return list(pool.map(function, range(12)))


# Fail closed unless the caller explicitly supplies the disposable fixture container.
assert query("select final_report_json->>'published' from public.reports where id=1") == "unchanged"
assert query("select not metering_enabled from public.billing_accounts where id=1") == "t"
base = dict(latitude=-33.9, longitude=151.2, bedrooms=3, bathrooms=1.5,
            accommodates=6, radiusM=2000, currency="AUD")
inputs = [dict(base, latitude=base["latitude"] + n * 0.00002) for n in range(12)]


try:
    # Different exact coordinate keys for one property must share one provider lease.
    def fuzzy_claim(n):
        return claim(key(f"fuzzy-{n}"), key(f"legacy-fuzzy-{n}"), owners[n], key("property"), inputs[n])

    results = run_concurrent(fuzzy_claim)
    winners = [n for n, result in enumerate(results) if result["status"] == "claimed"]
    assert len(winners) == 1, results
    assert sum(result["status"] == "pending" for result in results) == 11, results
    winner = winners[0]
    actual_key = results[winner]["request_key"]
    assert all(result["request_key"] == actual_key for result in results), results
    assert all(result["provider_input"] == inputs[winner] for result in results), results
    query(f"set role service_role; select public.complete_airroi_calculator_cache('{actual_key}','{owners[winner]}','{{\"revenue\":123,\"comps\":[\"retained\"]}}');")
    results = run_concurrent(fuzzy_claim)
    assert all(result["status"] == "hit" and result["response"]["comps"] == ["retained"] for result in results), results
    assert query(f"select fetch_count || ':' || hit_count from public.airroi_calculator_cache where request_key='{actual_key}'") == "1:12"
    assert len(set((result["fetched_at"], result["expires_at"]) for result in results)) == 1
    assert query(f"select count(*) from public.airroi_calculator_cache where property_key='{key('property')}'") == "1"
    print("PASS 12 nearby coordinate contenders: one provider lease, then 12 hits with original evidence/TTL.")

    # Recovering an abandoned lease must also coalesce across coordinate keys.
    query(f"set role service_role; update public.airroi_calculator_cache set fetched_at=now()-interval '721 hours', expires_at=now()-interval '1 hour' where request_key='{actual_key}';")
    results = run_concurrent(fuzzy_claim)
    winners = [n for n, result in enumerate(results) if result["status"] == "claimed"]
    assert len(winners) == 1, results
    replacement_key = results[winners[0]]["request_key"]
    assert sum(result["status"] == "pending" for result in results) == 11, results
    query(f"set role service_role; update public.airroi_calculator_cache set lease_expires_at=now()-interval '1 second' where request_key='{replacement_key}';")
    results = run_concurrent(fuzzy_claim)
    assert sum(result["status"] == "claimed" for result in results) == 1, results
    assert sum(result["status"] == "pending" for result in results) == 11, results
    print("PASS Expired results and abandoned leases each elect only one replacement provider worker.")

    # Two units at identical coordinates compete to adopt one unowned legacy row.
    # Only one unit may adopt it; the other must get one separate new lease.
    legacy_key = key("legacy-shared-building")
    created_keys.add(legacy_key)
    query(f"set role service_role; select public.claim_airroi_calculator_cache('{legacy_key}','{owners[0]}'); select public.complete_airroi_calculator_cache('{legacy_key}','{owners[0]}','{{\"revenue\":456}}');")

    def legacy_claim(n):
        unit = n % 2
        return claim(key(f"unit-{unit}-exact"), legacy_key, owners[n], key(f"unit-{unit}"), base)

    results = run_concurrent(legacy_claim)
    adopted_unit = next(n % 2 for n, result in enumerate(results) if result["status"] == "hit")
    for n, result in enumerate(results):
        if n % 2 == adopted_unit:
            assert result["status"] == "hit" and result["request_key"] == legacy_key, results
        else:
            assert result["status"] in ("claimed", "pending") and result["request_key"] != legacy_key, results
    assert sum(result["status"] == "claimed" for result in results) == 1, results
    assert sum(result["status"] == "pending" for result in results) == 5, results
    assert sum(result["status"] == "hit" for result in results) == 6, results
    assert query(f"select property_key from public.airroi_calculator_cache where request_key='{legacy_key}'") == key(f"unit-{adopted_unit}")
    print("PASS Concurrent legacy adoption: one unit retains the original result; the other gets one distinct lease.")

    assert query("select final_report_json->>'published' from public.reports where id=1") == "unchanged"
    assert query("select not metering_enabled from public.billing_accounts where id=1") == "t"
finally:
    keys = ",".join(f"'{value}'" for value in created_keys)
    if keys:
        query(f"set role service_role; delete from public.airroi_calculator_cache where request_key in ({keys});")
