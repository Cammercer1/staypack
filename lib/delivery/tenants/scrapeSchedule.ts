import type { DeliveryTenant, ScrapeSchedule } from "@/lib/delivery/types";

/** Daily cron only: "M H * * *" (minute hour). */
function parseDailyCron(cron: string): { minute: number; hour: number } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  if (parts[2] !== "*" || parts[3] !== "*" || parts[4] !== "*") return null;
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  if (
    !Number.isInteger(minute) ||
    !Number.isInteger(hour) ||
    minute < 0 ||
    minute > 59 ||
    hour < 0 ||
    hour > 23
  ) {
    return null;
  }
  return { minute, hour };
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function isScrapeDue(
  schedule: ScrapeSchedule,
  timezone: string,
  lastScrapeAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastScrapeAt) return true;

  const last = new Date(lastScrapeAt);
  if (Number.isNaN(last.getTime())) return true;

  if (schedule.type === "interval") {
    const ms = schedule.intervalHours * 60 * 60 * 1000;
    return now.getTime() - last.getTime() >= ms;
  }

  const daily = parseDailyCron(schedule.cron);
  if (!daily) {
    return now.getTime() - last.getTime() >= 24 * 60 * 60 * 1000;
  }

  const zoned = zonedParts(now, timezone);
  const lastZoned = zonedParts(last, timezone);

  const afterScheduledTime =
    zoned.hour > daily.hour ||
    (zoned.hour === daily.hour && zoned.minute >= daily.minute);

  if (!afterScheduledTime) return false;

  const alreadyRanToday =
    lastZoned.year === zoned.year &&
    lastZoned.month === zoned.month &&
    lastZoned.day === zoned.day &&
    (lastZoned.hour > daily.hour ||
      (lastZoned.hour === daily.hour && lastZoned.minute >= daily.minute));

  return !alreadyRanToday;
}

export function listDueTenants(
  tenants: DeliveryTenant[],
  now: Date = new Date(),
): DeliveryTenant[] {
  return tenants.filter((tenant) => {
    if (!tenant.enabled || !tenant.scrape_enabled) return false;
    return isScrapeDue(
      tenant.scrape_schedule,
      tenant.timezone,
      tenant.last_scrape_at,
      now,
    );
  });
}
