export function logDelivery(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>,
) {
  const payload = {
    ts: new Date().toISOString(),
    scope: "managed-delivery",
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export async function alertDeliveryFailure(
  tenantSlug: string,
  error: string,
  runId?: string,
) {
  const webhook = process.env.DELIVERY_ALERT_WEBHOOK_URL?.trim();
  logDelivery("error", error, { tenantSlug, runId });

  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, error, runId }),
    });
  } catch {
    // non-fatal
  }
}
