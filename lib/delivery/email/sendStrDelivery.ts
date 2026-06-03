import type { DeliveryTenant } from "@/lib/delivery/types";
import {
  resolveDeliveryFromEmail,
  sendDeliveryEmail,
} from "@/lib/delivery/email/client";

export function renderEmailSubject(
  template: string | null,
  address: string,
) {
  const base = template ?? "STR report: {{address}}";
  return base.replace(/\{\{address\}\}/g, address || "Property");
}

export async function sendStrDeliveryEmail({
  tenant,
  address,
  pdfBuffer,
  pdfFilename,
}: {
  tenant: DeliveryTenant;
  address: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}) {
  const subject = renderEmailSubject(tenant.email_subject_template, address);

  return sendDeliveryEmail({
    from: resolveDeliveryFromEmail(tenant.email_from),
    to: tenant.email_recipients,
    subject,
    text: `Please find the short-term rental report for ${address} attached.`,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
