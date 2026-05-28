export type TextMeasureInput = {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  maxWidth: number;
  lineHeightRatio?: number;
  padX?: number;
  padY?: number;
};

function estimateWrappedTextBox(input: TextMeasureInput) {
  const {
    text,
    fontSize,
    fontWeight,
    maxWidth,
    lineHeightRatio = 1.2,
    padX = 8,
    padY = 4,
  } = input;

  const contentWidth = Math.max(1, maxWidth - padX * 2);
  const weight = typeof fontWeight === "number" ? fontWeight : fontWeight;
  const avgChar =
    weight === "bold" || weight === 700 || weight === "700" ? 0.58 : 0.5;
  const spaceWidth = fontSize * 0.28;

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return {
      width: maxWidth,
      height: fontSize + padY * 2,
    };
  }

  let lineWidth = 0;
  let maxLineWidth = 0;
  let lines = 1;

  for (const word of words) {
    const wordWidth = word.length * fontSize * avgChar;
    const nextWidth =
      lineWidth === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth;

    if (nextWidth > contentWidth && lineWidth > 0) {
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
      lines += 1;
      lineWidth = wordWidth;
    } else {
      lineWidth = nextWidth;
    }
  }

  maxLineWidth = Math.max(maxLineWidth, lineWidth);

  return {
    width: maxWidth,
    height: Math.ceil(lines * fontSize * lineHeightRatio + padY * 2),
    contentWidth: Math.ceil(Math.min(contentWidth, maxLineWidth)),
  };
}

function measureWrappedTextWithCanvas(input: TextMeasureInput) {
  const {
    text,
    fontSize,
    fontFamily,
    fontWeight,
    maxWidth,
    lineHeightRatio = 1.2,
    padX = 8,
    padY = 4,
  } = input;

  const contentWidth = Math.max(1, maxWidth - padX * 2);
  const trimmed = text.trim();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return estimateWrappedTextBox(input);

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  if (!trimmed) {
    return {
      width: maxWidth,
      height: fontSize + padY * 2,
    };
  }

  const lines: string[] = [];
  let current = "";

  for (const word of trimmed.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > contentWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);

  let maxLineWidth = 0;
  for (const line of lines) {
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
  }

  const lineHeight = fontSize * lineHeightRatio;

  return {
    width: maxWidth,
    height: Math.ceil(lines.length * lineHeight + padY * 2),
    contentWidth: Math.ceil(Math.min(contentWidth, maxLineWidth) + padX * 2),
  };
}

export function measureSocialPostTextBox(input: TextMeasureInput) {
  if (typeof document !== "undefined") {
    try {
      return measureWrappedTextWithCanvas(input);
    } catch {
      return estimateWrappedTextBox(input);
    }
  }

  return estimateWrappedTextBox(input);
}
