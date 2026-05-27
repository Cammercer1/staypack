import QRCode from "qrcode";

export function resolveQrCodeTargetUrl(listingUrl: string | null | undefined) {
  const url = listingUrl?.trim();
  return url || null;
}

export async function generateQrCodeDataUrl(url: string) {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 512,
  });
}

export async function generateQrCodeBuffer(url: string) {
  return QRCode.toBuffer(url, {
    margin: 1,
    width: 512,
    type: "png",
  });
}
