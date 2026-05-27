import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency, AgencyRole } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function getAgencyMembership(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agency_members")
    .select("role, agency:agencies(*)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.agency) {
    return null;
  }

  const agency = Array.isArray(data.agency) ? data.agency[0] : data.agency;

  if (!agency) {
    return null;
  }

  return {
    role: data.role as AgencyRole,
    agency: agency as Agency,
  };
}

export async function requireAgency() {
  const { supabase, user } = await requireUser();
  const membership = await getAgencyMembership(user.id);

  if (!membership) {
    redirect("/onboarding");
  }

  return { supabase, user, ...membership };
}

export async function requireAgencyAdmin() {
  const context = await requireAgency();

  if (!["owner", "admin"].includes(context.role)) {
    throw new Error("Admin access required");
  }

  return context;
}

export async function requireReportAccess(reportId: string) {
  const context = await requireAgency();
  const { data: report, error } = await context.supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("agency_id", context.agency.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!report) {
    throw new Error("Report not found");
  }

  return { ...context, report };
}
