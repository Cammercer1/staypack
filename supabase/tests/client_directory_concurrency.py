"""Exercise independent concurrent sessions in the disposable client QA database."""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
import uuid

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
widget = str(uuid.uuid4())
lead = str(uuid.uuid4())
email = f"lead-{uuid.uuid4()}@example.test"
query(f"""set role service_role;
insert into public.str_calculator_widgets(id,agency_id,enabled) values('{widget}','{agency}',true);
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
delete from public.str_calculator_widgets where id='{widget}';
delete from public.collateral_items where report_id='{report}';
delete from public.reports where id='{report}';
delete from public.listings where id='{listing}';
delete from public.agency_contacts where agency_id='{agency}' and email='{email}';""")
print("PASS 12 concurrent Create report clicks created one report and one client")
