export function assertDeliveryCronAuth(request: Request) {
  const secret = process.env.DELIVERY_CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("DELIVERY_CRON_SECRET is not configured");
  }

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const querySecret = new URL(request.url).searchParams.get("secret");

  if (bearer !== secret && querySecret !== secret) {
    throw new Error("Unauthorized");
  }
}
