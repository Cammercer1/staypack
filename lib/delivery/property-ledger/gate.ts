import type {
  DeliveryTenant,
  LedgerGateResult,
  TenantPropertyRecord,
} from "@/lib/delivery/types";
import { computeListingFingerprint } from "@/lib/delivery/property-ledger/fingerprint";

const MAX_RETRIES = 3;

export function evaluateLedgerGate(
  tenant: DeliveryTenant,
  existing: TenantPropertyRecord | null,
  fingerprint: string,
): LedgerGateResult {
  if (!existing) {
    return { action: "process", record: null };
  }

  if (existing.status === "processing") {
    return {
      action: "skip",
      reason: "already_processing",
      record: existing,
    };
  }

  if (existing.status === "failed") {
    if (existing.retry_count < MAX_RETRIES) {
      return { action: "retry", record: existing };
    }
    return {
      action: "skip",
      reason: "max_retries_exceeded",
      record: existing,
    };
  }

  if (existing.status === "delivered") {
    if (existing.content_fingerprint === fingerprint) {
      return {
        action: "skip",
        reason: "already_delivered_unchanged",
        record: existing,
      };
    }

    if (tenant.reprocess_on_material_change) {
      return { action: "process", record: existing };
    }

    return {
      action: "skip",
      reason: "content_changed_reprocess_disabled",
      record: existing,
    };
  }

  return { action: "process", record: existing };
}

export function fingerprintForParsed(
  parsed: Parameters<typeof computeListingFingerprint>[0],
) {
  return computeListingFingerprint(parsed);
}
