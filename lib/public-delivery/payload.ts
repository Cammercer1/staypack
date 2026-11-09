import type { ViewerSnapshot } from "@/lib/digital-proposals/viewerSnapshot";

/** Explicit browser projection; never include database rows, storage paths or credentials. */
export type PublicReportPayload = {
  snapshot: ViewerSnapshot;
  publicPath: string;
  initialPage?: string;
  exampleAgreement?: boolean;
  tracking?: { token: string; versionId: string };
  pdfHref?: string;
  attachments: { id: string; name: string; byte_size: number; href: string }[];
  title: string;
};
