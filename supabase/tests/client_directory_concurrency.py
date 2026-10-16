"""Exercise independent concurrent sessions in the disposable client QA database."""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import uuid
from threading import Barrier

container = sys.argv[1]
if not container.startswith("staypack-clients-qa"):
    raise SystemExit("Use a dedicated staypack-clients-qa Docker container.")
agency = "20000000-0000-4000-8000-000000000001"
email = f"concurrent-{uuid.uuid4()}@example.test"

def query(sql):
    result = subprocess.run(["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", "client_directory_qa", "-v", "ON_ERROR_STOP=1", "-qAt"], input=sql, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def resolve(_):
    return query(f"set role service_role; select public.resolve_agency_client('{agency}','{{\"name\":\"Concurrent Client\",\"email\":\"{email}\"}}');")

with ThreadPoolExecutor(max_workers=12) as pool:
    ids = list(pool.map(resolve, range(12)))
assert len(set(ids)) == 1, ids
assert query(f"select count(*) from public.agency_contacts where agency_id='{agency}' and email='{email}';") == "1"
query(f"delete from public.agency_contacts where agency_id='{agency}' and email='{email}';")
print("PASS 12 concurrent report/lead client resolutions created one shared client")

# Direct writes are also serialized: only one succeeds, all others return PT409.
email = f"direct-{uuid.uuid4()}@example.test"
def insert(_):
    try:
        query(f"set role service_role; insert into public.agency_contacts(agency_id,name,email) values('{agency}','Direct concurrent','{email}');")
        return "created"
    except RuntimeError as error:
        if "A client with this email already exists" in str(error):
            return "duplicate"
        raise
with ThreadPoolExecutor(max_workers=12) as pool:
    outcomes = list(pool.map(insert, range(12)))
assert outcomes.count("created") == 1, outcomes
assert outcomes.count("duplicate") == 11, outcomes
query(f"delete from public.agency_contacts where agency_id='{agency}' and email='{email}';")
print("PASS 12 direct concurrent inserts accepted one and rejected 11 duplicates")

# Simultaneous Create report clicks must resolve the client once, preserve the
# idempotent report link, and avoid creating orphan contacts or property drafts.
widget = query(f"select id from public.str_calculator_widgets where agency_id='{agency}';")
created_widget = not widget
if created_widget:
    widget = str(uuid.uuid4())
    query(f"set role service_role; insert into public.str_calculator_widgets(id,agency_id,enabled) values('{widget}','{agency}',true);")
lead = str(uuid.uuid4())
email = f"lead-{uuid.uuid4()}@example.test"
query(f"""set role service_role;
insert into public.str_calculator_leads(id,agency_id,widget_id,request_id,input_hash,client_hash,address,bedrooms,email,full_name,country,input_json,consent_version,consent_text)
values('{lead}','{agency}','{widget}',gen_random_uuid(),'hash','client','2/24 Cliffbrook Parade, Coogee NSW 2034',2,'{email}','Lead Client','AU','{{}}','v3','Consent');
""")
draft = '{"source_address":"2/24 Cliffbrook Parade, Coogee NSW 2034","property":{"property_address":"2/24 Cliffbrook Parade, Coogee NSW 2034","bedrooms":2,"bathrooms":1,"country":"Australia","accommodates":4}}'
def convert(_):
    return query(f"set role service_role; select public.create_str_calculator_lead_report('{agency}','{lead}','10000000-0000-4000-8000-000000000001','classic-detailed','{draft}')->>'report_id';")
with ThreadPoolExecutor(max_workers=12) as pool:
    reports = list(pool.map(convert, range(12)))
assert len(set(reports)) == 1, reports
assert query(f"select count(*) from public.agency_contacts where agency_id='{agency}' and email='{email}';") == "1"
report = reports[0]
listing = query(f"select listing_id from public.reports where id='{report}';")
query(f"""delete from public.str_calculator_leads where id='{lead}';
delete from public.collateral_items where report_id='{report}';
delete from public.reports where id='{report}';
delete from public.listings where id='{listing}';
delete from public.agency_contacts where agency_id='{agency}' and email='{email}';""")
if created_widget:
    query(f"delete from public.str_calculator_widgets where id='{widget}';")
print("PASS 12 concurrent Create report clicks created one report and one client")

# Each independent transaction sees the same EMPTY snapshot before the barrier.
# Advisory locks alone cannot see another session's later insert at REPEATABLE
# READ. The unique index must reject the eleven invisible committed duplicates.
email = f"snapshot-{uuid.uuid4()}@example.test"
barrier = Barrier(12)
def repeatable_insert(number):
    proc = subprocess.Popen(["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", "client_directory_qa", "-v", "ON_ERROR_STOP=1", "-qAt"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        proc.stdin.write(f"set role service_role; begin isolation level repeatable read; select count(*) from public.agency_contacts where agency_id='{agency}' and lower(btrim(email))='{email}';\n")
        proc.stdin.flush()
        assert proc.stdout.readline().strip() == "0", "Did not establish the empty snapshot"
        barrier.wait(timeout=20)
        variant = f" {email.upper()} " if number % 2 else email
        proc.stdin.write(f"insert into public.agency_contacts(agency_id,name,email) values('{agency}','Snapshot race','{variant}'); commit;\n")
        proc.stdin.close()
        stderr = proc.stderr.read()
        code = proc.wait(timeout=30)
        if code == 0:
            return "created"
        if 'duplicate key value violates unique constraint "agency_contacts_agency_normalized_email_key"' in stderr:
            return "duplicate"
        raise RuntimeError(stderr)
    finally:
        if proc.poll() is None:
            proc.kill()
with ThreadPoolExecutor(max_workers=12) as pool:
    outcomes = list(pool.map(repeatable_insert, range(12)))
assert outcomes.count("created") == 1 and outcomes.count("duplicate") == 11, outcomes
assert query(f"select count(*) from public.agency_contacts where agency_id='{agency}' and lower(btrim(email))='{email}';") == "1"
query(f"delete from public.agency_contacts where agency_id='{agency}' and lower(btrim(email))='{email}';")
print("PASS 12 REPEATABLE READ inserts with mixed-case/whitespace emails created one client; unique index rejected 11")
