import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { restorePrintEmails } from "./restorePrintEmails";

const protectedEmail =
  "3c485453515d4f1250505345587c5e595050594c4e534c594e4845125f5351";

describe("restorePrintEmails", () => {
  it("restores the real print-page email and a working mail link", () => {
    const html = `<div class="report-print-root"><a href="/cdn-cgi/l/email-protection" class="contact __cf_email__" data-cfemail="${protectedEmail}">[email&#160;protected]</a><svg viewBox="0 0 12 12"><path d="M1 1L4 4"/></svg></div>`;
    const $ = load(restorePrintEmails(html));
    expect($("a").text()).toBe("thomas.lloyd@belleproperty.com");
    expect($("a").attr("href")).toBe("mailto:thomas.lloyd@belleproperty.com");
    expect($("a").hasClass("contact")).toBe(true);
    expect($("[data-cfemail]")).toHaveLength(0);
    expect($("svg").attr("viewBox")).toBe("0 0 12 12");
  });

  it("restores nested protected text without replacing the surrounding content", () => {
    const html = `<a href="/cdn-cgi/l/email-protection#${protectedEmail}">Email <span class="__cf_email__" data-cfemail="${protectedEmail}">[email protected]</span></a>`;
    const $ = load(restorePrintEmails(html));
    expect($("a").text()).toBe("Email thomas.lloyd@belleproperty.com");
    expect($("a").attr("href")).toBe("mailto:thomas.lloyd@belleproperty.com");
  });

  it("keeps malformed values intact and leaves ordinary print HTML byte-for-byte unchanged", () => {
    const ordinary =
      '<div class="report-print-root"><a href="mailto:agent@example.com">agent@example.com</a></div>';
    expect(restorePrintEmails(ordinary)).toBe(ordinary);
    for (const encoded of ["zz", "a12", "", "3c"])
      expect(
        restorePrintEmails(
          `<span data-cfemail="${encoded}">[email protected]</span>`,
        ),
      ).toContain("[email protected]");
  });

  it("escapes decoded content as text and supports Unicode addresses", () => {
    const value = "José+<script>@example.com";
    const encoded = Buffer.from([
      42,
      ...Buffer.from(value).map((byte) => byte ^ 42),
    ]).toString("hex");
    const $ = load(
      restorePrintEmails(
        `<span data-cfemail="${encoded}">[email protected]</span>`,
      ),
    );
    expect($("span").text()).toBe(value);
    expect($("script")).toHaveLength(0);
  });
});
