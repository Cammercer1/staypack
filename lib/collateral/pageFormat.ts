export type CollateralPageFormat = {
  id: string;
  width: string;
  height: string;
  widthMm: number;
  heightMm: number;
  pdfLandscape: boolean;
  pdfFormat?: string;
};

const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;
const BUSINESS_CARD_WIDTH_MM = 90;
const BUSINESS_CARD_HEIGHT_MM = 55;

export function getCollateralPageFormat(id: string): CollateralPageFormat {
  switch (id) {
    case "a4-landscape":
      return {
        id: "a4-landscape",
        width: `${A4_LONG_MM}mm`,
        height: `${A4_SHORT_MM}mm`,
        widthMm: A4_LONG_MM,
        heightMm: A4_SHORT_MM,
        pdfLandscape: true,
        pdfFormat: "A4",
      };
    case "business-card-au":
      return {
        id: "business-card-au",
        width: `${BUSINESS_CARD_WIDTH_MM}mm`,
        height: `${BUSINESS_CARD_HEIGHT_MM}mm`,
        widthMm: BUSINESS_CARD_WIDTH_MM,
        heightMm: BUSINESS_CARD_HEIGHT_MM,
        pdfLandscape: true,
      };
    case "a4-portrait":
    default:
      return {
        id: "a4-portrait",
        width: `${A4_SHORT_MM}mm`,
        height: `${A4_LONG_MM}mm`,
        widthMm: A4_SHORT_MM,
        heightMm: A4_LONG_MM,
        pdfLandscape: false,
        pdfFormat: "A4",
      };
  }
}

export function getCollateralPageFormatStyle(format: CollateralPageFormat) {
  return {
    ["--collateral-page-width" as string]: format.width,
    ["--collateral-page-height" as string]: format.height,
  };
}

export function getPdfOptionsForCollateralFormat(format: CollateralPageFormat) {
  if (format.pdfFormat) {
    return {
      format: format.pdfFormat as "A4",
      landscape: format.pdfLandscape,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
    };
  }

  return {
    width: format.width,
    height: format.height,
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: "0px",
      right: "0px",
      bottom: "0px",
      left: "0px",
    },
  };
}
