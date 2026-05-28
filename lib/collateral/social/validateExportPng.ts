/** Reject empty or obviously broken captures before upload. */
export function validateSocialPostPngBytes(byteLength: number) {
  const MIN_BYTES = 15_000;
  if (byteLength < MIN_BYTES) {
    throw new Error(
      "Export looks empty or incomplete — check images load in the preview, then try again.",
    );
  }
}
