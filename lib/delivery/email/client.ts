import { isDevelopment } from "@/lib/env";

export type SendEmailParams = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType: string;
  }[];
};

export type SendEmailResult = {
  id: string;
  provider: "resend" | "log";
};

function getResendApiKey() {
  return process.env.RESEND_API_KEY?.trim() ?? null;
}

function getDefaultFromEmail() {
  return (
    process.env.DELIVERY_FROM_EMAIL?.trim() ??
    "StayPacks Delivery <reports@staypack.app>"
  );
}

export function resolveDeliveryFromEmail(tenantFrom?: string | null) {
  return tenantFrom?.trim() || getDefaultFromEmail();
}

export async function sendDeliveryEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    if (!isDevelopment()) {
      throw new Error(
        "RESEND_API_KEY is not configured. Set RESEND_API_KEY and DELIVERY_FROM_EMAIL for outbound delivery email.",
      );
    }

    console.info("[delivery/email] (dev log only)", {
      to: params.to,
      subject: params.subject,
      attachmentCount: params.attachments?.length ?? 0,
    });

    return { id: `dev-${Date.now()}`, provider: "log" };
  }

  const attachments = params.attachments?.map((file) => ({
    filename: file.filename,
    content: file.content.toString("base64"),
  }));

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { id?: string };
  return { id: json.id ?? `resend-${Date.now()}`, provider: "resend" };
}
