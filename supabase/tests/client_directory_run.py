"""Provision ONLY a fresh database in the explicitly named disposable Docker container.

Usage: python3 supabase/tests/client_directory_run.py staypack-clients-qa
Never point these synthetic fixture files at Supabase or an application database.
"""
import pathlib
import subprocess
import sys

container = sys.argv[1]
if not container.startswith("staypack-clients-qa"):
    raise SystemExit("Use a dedicated staypack-clients-qa Docker container.")
root = pathlib.Path(__file__).resolve().parents[2]
database = "client_directory_qa"
subprocess.run(["docker", "exec", container, "createdb", "-U", "postgres", database], check=True)
files = [
    "tests/str_workspace_fixture.sql",
    "tests/str_calculator_lead_reports_fixture.sql",
    "migrations/20261010232632_str_appraisal_workspace.sql",
    "migrations/20261010233726_str_recipient_conflict_http_status.sql",
    "tests/digital_proposal_fixture.sql",
    "migrations/20261012000950_digital_proposal_workspace.sql",
    "migrations/20261012002612_digital_proposal_draft_index.sql",
    "migrations/20261012020830_digital_proposal_integration.sql",
    "tests/client_directory_fixture.sql",
    "migrations/20261014062925_shared_appraisal_workspace.sql",
    "migrations/20261014104828_str_calculator_widget.sql",
    "migrations/20261014113703_str_calculator_optional_phone.sql",
    "migrations/20261015024032_str_calculator_lead_reports.sql",
    "migrations/20261015024716_str_calculator_lead_report_listing_slug.sql",
    "migrations/20261015025920_str_calculator_lead_report_market_occupancy_cost.sql",
    "migrations/20261015234716_client_directory_and_calculator_carry_through.sql",
    "tests/client_directory_assertions.sql",
    "tests/str_calculator_lead_reports.sql",
    "tests/client_merge_fixture.sql",
    "migrations/20261016002517_client_merge_and_email_identity.sql",
    "tests/client_merge_reviewed_merges.sql",
    "migrations/20261016002520_client_email_unique_index.sql",
    "tests/client_merge_assertions.sql",
    "migrations/20261016020354_contacts_and_calculator_enquiries.sql",
    "tests/contacts_enquiries_assertions.sql",
    "tests/stable_proposal_links_fixture.sql",
    "migrations/20261021065728_stable_proposal_share_links.sql",
    "tests/proposal_link_history_api_fixture.sql",
    "migrations/20261021084230_proposal_link_history_api_compatibility.sql",
    "tests/proposal_link_history_api_assertions.sql",
    "tests/stable_proposal_links_assertions.sql",
]
for name in files:
    sql = (root / "supabase" / name).read_text()
    # Roles belong to the cluster, not the fresh database. The fixture's only
    # cluster-wide mutations can be made idempotent without changing its schema.
    for role in ("anon", "authenticated", "service_role bypassrls"):
        sql = sql.replace(f"create role {role};", f"do $$ begin create role {role}; exception when duplicate_object then null; end $$;")
    result = subprocess.run(["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-q"], input=sql, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit(f"{name}\n{result.stderr}")
    print(f"PASS {name}")
