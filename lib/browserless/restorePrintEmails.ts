import { load } from "cheerio";

function decodeEmail(encoded: string | undefined): string | null {
  if (!encoded || !/^(?:[\da-f]{2}){2,}$/i.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "hex");
  const key = bytes[0];
  const email = new TextDecoder("utf-8", { fatal: true });
  try {
    const decoded = email.decode(bytes.subarray(1).map((byte) => byte ^ key));
    return decoded.includes("@") && !/[\u0000-\u001f\u007f]/.test(decoded)
      ? decoded
      : null;
  } catch {
    return null;
  }
}

/** Static PDF HTML cannot run the edge's relative email-decoding script. */
export function restorePrintEmails(html: string): string {
  if (!html.includes("data-cfemail")) return html;
  const $ = load(html, {}, false);
  $("[data-cfemail]").each((_, element) => {
    const node = $(element);
    const email = decodeEmail(node.attr("data-cfemail"));
    if (!email) return;
    node.text(email).removeAttr("data-cfemail").removeClass("__cf_email__");
    if (
      node.is("a") &&
      node.attr("href")?.startsWith("/cdn-cgi/l/email-protection")
    ) {
      node.attr("href", `mailto:${email}`);
    }
  });
  $('a[href^="/cdn-cgi/l/email-protection#"]').each((_, element) => {
    const node = $(element);
    const email = decodeEmail(node.attr("href")?.split("#")[1]);
    if (email) node.attr("href", `mailto:${email}`);
  });
  return $.html();
}
