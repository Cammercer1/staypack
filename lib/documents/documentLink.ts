import { z } from "zod";

const destinationSchema = z.string().trim().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}, "Use an http or https URL without a username or password");

export const documentLinkSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("report") }),
  z.object({ mode: z.literal("custom"), url: destinationSchema }),
]);

export type DocumentLink = z.infer<typeof documentLinkSchema>;
export type DocumentLinkDraft = {
  link: DocumentLink;
  target_url: string;
  qr_code_url: string;
};
export type DocumentLinkFields = {
  document_link?: DocumentLink;
  document_link_draft?: DocumentLinkDraft;
};
type LinkDocument = DocumentLinkFields & {
  assets: { qr_code_url?: string };
  qr_target_url?: string;
};

export function resolveDocumentLinkTarget(link: DocumentLink, reportUrl?: string) {
  if (link.mode === "none") return "";
  if (link.mode === "custom") return destinationSchema.parse(link.url);
  if (!reportUrl) throw new Error("This document does not have an online report");
  return destinationSchema.parse(reportUrl);
}

/** Keep legacy QR assets when metadata is absent; new documents start with no QR. */
export function preserveDocumentLink(value?: unknown): DocumentLinkFields {
  const document = value as Partial<LinkDocument> | null | undefined;
  return {
    ...(document?.document_link
      ? { document_link: document.document_link }
      : document?.assets?.qr_code_url ? {} : { document_link: { mode: "none" as const } }),
    ...(document?.document_link_draft ? { document_link_draft: document.document_link_draft } : {}),
  };
}

/** Used only by authenticated previews and explicit publishing, never public rendering. */
export function applyDocumentLinkDraft<T extends LinkDocument>(document: T): T {
  const draft = document.document_link_draft;
  if (!draft) return document;
  const published = { ...document };
  delete published.document_link_draft;
  return {
    ...published,
    document_link: draft.link,
    qr_target_url: draft.target_url,
    assets: { ...document.assets, qr_code_url: draft.qr_code_url, ...("pdf_url" in document.assets ? { pdf_url: "" } : {}) },
  } as T;
}

export function documentLinkLabel(document: DocumentLinkFields) {
  return document.document_link?.mode === "report"
    ? "Scan to view this report"
    : document.document_link?.mode === "custom"
      ? "Scan for more information"
      : "Scan to view the listing";
}

/** Do not serialize an unpublished destination into a public page's client props. */
export function publishedDocumentSnapshot<T extends object>(document: T): T {
  const snapshot = { ...document };
  delete (snapshot as DocumentLinkFields).document_link_draft;
  return snapshot;
}
