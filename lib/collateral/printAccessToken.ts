import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

function getPrintTokenSecret() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    "staypack-dev-print-token-secret"
  );
}

export function createCollateralPrintAccessToken(collateralId: string) {
  const expiresAt = Math.floor((Date.now() + TOKEN_TTL_MS) / 1000);
  const signature = createHmac("sha256", getPrintTokenSecret())
    .update(`collateral:${collateralId}:${expiresAt}`)
    .digest("hex");

  return `${expiresAt}.${signature}`;
}

export function verifyCollateralPrintAccessToken(
  collateralId: string,
  token: string,
) {
  const [expiresAtRaw, signature] = token.split(".");

  if (!expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = createHmac("sha256", getPrintTokenSecret())
    .update(`collateral:${collateralId}:${expiresAt}`)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function buildCollateralPreviewPrintUrl(
  collateralId: string,
  baseUrl: string,
  options?: { variant?: string },
) {
  const token = createCollateralPrintAccessToken(collateralId);
  const origin = baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ token });

  if (options?.variant) {
    params.set("variant", options.variant);
  }

  return `${origin}/p/collateral/${collateralId}/print?${params.toString()}`;
}
