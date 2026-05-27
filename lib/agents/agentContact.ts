import type { ParsedListing } from "@/lib/types";

export type ListingAgentFields = ParsedListing["agents"][number];

export function isMaskedPhone(phone?: string | null) {
  if (!phone?.trim()) {
    return false;
  }

  return /\*/.test(phone) || /x{3,}/i.test(phone);
}

export function phoneDigitCount(phone?: string | null) {
  return phone?.replace(/\D/g, "").length ?? 0;
}

/** Prefer complete dialable numbers over masked portal display text. */
export function preferAgentPhone(
  primary?: string | null,
  secondary?: string | null,
) {
  const candidates = [primary, secondary]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (!candidates.length) {
    return undefined;
  }

  const ranked = [...candidates].sort((left, right) => {
    const leftMasked = isMaskedPhone(left);
    const rightMasked = isMaskedPhone(right);
    if (leftMasked !== rightMasked) {
      return leftMasked ? 1 : -1;
    }

    return phoneDigitCount(right) - phoneDigitCount(left);
  });

  const best = ranked[0];
  return isMaskedPhone(best) ? undefined : best;
}

export function sanitizeAgentPhone(phone?: string | null) {
  return preferAgentPhone(phone) ?? "";
}

function normalizeAgentName(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function agentsMatch(left: ListingAgentFields, right: ListingAgentFields) {
  const leftName = normalizeAgentName(left.name);
  const rightName = normalizeAgentName(right.name);
  if (leftName && rightName && leftName === rightName) {
    return true;
  }

  const leftEmail = left.email?.trim().toLowerCase();
  const rightEmail = right.email?.trim().toLowerCase();
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    return true;
  }

  const leftDigits = phoneDigitCount(left.phone);
  const rightDigits = phoneDigitCount(right.phone);
  if (leftDigits >= 8 && leftDigits === rightDigits) {
    return left.phone?.replace(/\D/g, "") === right.phone?.replace(/\D/g, "");
  }

  return false;
}

export function mergeAgentFields(
  base: ListingAgentFields,
  next: ListingAgentFields,
): ListingAgentFields {
  return {
    name: next.name?.trim() || base.name?.trim() || undefined,
    email: next.email?.trim() || base.email?.trim() || undefined,
    phone: preferAgentPhone(base.phone, next.phone),
    photo_url: next.photo_url?.trim() || base.photo_url?.trim() || undefined,
    role_title: next.role_title?.trim() || base.role_title?.trim() || undefined,
  };
}

export function mergeListingAgents(
  base: ListingAgentFields[],
  next: ListingAgentFields[],
) {
  if (!next.length) {
    return base.map((agent) => ({
      ...agent,
      phone: preferAgentPhone(agent.phone),
    }));
  }

  if (!base.length) {
    return next.map((agent) => mergeAgentFields({}, agent));
  }

  const merged: ListingAgentFields[] = [];
  const usedNextIndexes = new Set<number>();

  for (const baseAgent of base) {
    const matchIndex = next.findIndex(
      (nextAgent, index) =>
        !usedNextIndexes.has(index) && agentsMatch(baseAgent, nextAgent),
    );

    if (matchIndex >= 0) {
      usedNextIndexes.add(matchIndex);
      merged.push(mergeAgentFields(baseAgent, next[matchIndex]));
    } else {
      merged.push(mergeAgentFields(baseAgent, {}));
    }
  }

  for (let index = 0; index < next.length; index += 1) {
    if (!usedNextIndexes.has(index)) {
      merged.push(mergeAgentFields({}, next[index]));
    }
  }

  return merged;
}
