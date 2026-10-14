import { createPrintAccessToken, verifyPrintAccessToken } from "@/lib/reports/printAccessToken";

/** Namespace tokens so a legacy report print token cannot open a proposal version. */
export function proposalPrintUrl(versionId: string, base: string) {
  const token = createPrintAccessToken(`proposal-version:${versionId}`);
  return `${base.replace(/\/$/, "")}/proposal/print/${versionId}?token=${encodeURIComponent(token)}`;
}
export function verifyProposalPrintToken(versionId: string, token: string) {
  return verifyPrintAccessToken(`proposal-version:${versionId}`, token);
}
