import { documentLinkLabel, type DocumentLinkFields } from "@/lib/documents/documentLink";

/** Optional slot for templates that historically had no QR. Legacy layouts stay unchanged. */
export function DocumentQr({ document }: { document: DocumentLinkFields & { assets: { qr_code_url?: string } } }) {
  if (!document.document_link || document.document_link.mode === "none" || !document.assets.qr_code_url) return null;
  return (
    <div className="shrink-0 bg-white p-1 text-center text-black" style={{ width: "23mm" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={document.assets.qr_code_url} alt="Document QR code" style={{ width: "19mm", height: "19mm", margin: "0 auto" }} />
      <p style={{ fontSize: "6pt", lineHeight: 1.2, marginTop: "1mm" }}>{documentLinkLabel(document)}</p>
    </div>
  );
}
