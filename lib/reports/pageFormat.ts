export type ReportPageOrientation = "portrait" | "landscape";

export type ReportPageFormat = {
  orientation: ReportPageOrientation;
  width: string;
  height: string;
  widthMm: number;
  heightMm: number;
  pdfLandscape: boolean;
};

const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;

export function getReportPageFormat(
  orientation: ReportPageOrientation = "portrait",
): ReportPageFormat {
  if (orientation === "landscape") {
    return {
      orientation: "landscape",
      width: `${A4_LONG_MM}mm`,
      height: `${A4_SHORT_MM}mm`,
      widthMm: A4_LONG_MM,
      heightMm: A4_SHORT_MM,
      pdfLandscape: true,
    };
  }

  return {
    orientation: "portrait",
    width: `${A4_SHORT_MM}mm`,
    height: `${A4_LONG_MM}mm`,
    widthMm: A4_SHORT_MM,
    heightMm: A4_LONG_MM,
    pdfLandscape: false,
  };
}

export function mmToPx(mm: number) {
  return mm * 3.7795275591;
}

export function getReportPageFormatStyle(format: ReportPageFormat) {
  return {
    ["--report-page-width" as string]: format.width,
    ["--report-page-height" as string]: format.height,
  };
}

export function getPdfOptionsForFormat(format: ReportPageFormat) {
  return {
    format: "A4" as const,
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
