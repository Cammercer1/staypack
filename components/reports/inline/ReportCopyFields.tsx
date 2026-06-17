"use client";

import { createElement, type CSSProperties, type ElementType } from "react";
import { ReportEditable } from "@/components/reports/inline/ReportEditable";
import { ReportEditableBlurbField } from "@/components/reports/inline/ReportEditableBlurbField";
import { useReportEditableContext } from "@/components/reports/inline/ReportEditableContext";
import type { ReportCopyFieldPath } from "@/lib/reports/editable/reportCopyPaths";
import { PAGE_ONE_HEADING_MAX } from "@/lib/copy/pageOneMarketingCopy";
import { cn } from "@/lib/utils";

function stripLineClampForEditor(className?: string) {
  if (!className) {
    return undefined;
  }
  const stripped = className
    .split(/\s+/)
    .filter((token) => token && !token.startsWith("line-clamp-"))
    .join(" ");
  return stripped || undefined;
}

type TextFieldProps = {
  text: string;
  path: ReportCopyFieldPath;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  recommendedMaxLength?: number;
};

export function ReportCopyTextField({
  text,
  path,
  as = "p",
  className,
  style,
  recommendedMaxLength,
}: TextFieldProps) {
  const { editable } = useReportEditableContext();
  if (!text && !editable) {
    return null;
  }

  if (editable) {
    return (
      <ReportEditable
        as={as}
        path={path}
        className={className}
        style={style}
        recommendedMaxLength={recommendedMaxLength}
      >
        {text}
      </ReportEditable>
    );
  }

  return createElement(as, { className, style }, text);
}

export function ReportCopyHeading(props: Omit<TextFieldProps, "path">) {
  return (
    <ReportCopyTextField
      {...props}
      path="copy.heading"
      recommendedMaxLength={props.recommendedMaxLength ?? PAGE_ONE_HEADING_MAX}
    />
  );
}

export function ReportCopyBlurb({
  blurb,
  className,
  paraClassName,
  style,
}: {
  blurb: string;
  className?: string;
  paraClassName?: string;
  style?: CSSProperties;
}) {
  const { editable, setField } = useReportEditableContext();
  if (!blurb && !editable) {
    return null;
  }

  if (editable) {
    const blurbClassName = stripLineClampForEditor(
      cn("relative z-10 min-w-0 shrink-0 overflow-visible", className, paraClassName),
    );
    return (
      <ReportEditableBlurbField
        blurb={blurb}
        onChange={(value) => setField("copy.blurb", value)}
        className={blurbClassName}
        paragraphClassName={paraClassName}
      />
    );
  }

  const paragraphs = blurb.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length <= 1) {
    return (
      <p className={cn(paraClassName, className)} style={style}>
        {blurb}
      </p>
    );
  }

  return (
    <>
      {paragraphs.map((para) => (
        <p
          key={para.slice(0, 48)}
          className={cn(paraClassName, className)}
          style={style}
        >
          {para.trim()}
        </p>
      ))}
    </>
  );
}

export function ReportCopyDisclaimer(props: Omit<TextFieldProps, "path" | "text"> & { text: string }) {
  return <ReportCopyTextField {...props} path="copy.disclaimer" />;
}

export function ReportCopyComparableEvidence({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { editable } = useReportEditableContext();
  if (!text && !editable) {
    return null;
  }

  if (editable) {
    return (
      <ReportEditable
        as="div"
        path="copy.comparable_evidence"
        className={cn("whitespace-pre-wrap", className)}
        style={style}
      >
        {text}
      </ReportEditable>
    );
  }

  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return (
    <>
      {paragraphs.map((para) => (
        <p
          key={para.slice(0, 48)}
          className={className}
          style={style}
        >
          {para.trim()}
        </p>
      ))}
    </>
  );
}

export function ReportCopyComparableDisclaimer(
  props: Omit<TextFieldProps, "path">,
) {
  return <ReportCopyTextField {...props} path="copy.comparable_disclaimer" />;
}

export function ReportCopyAppealPoint({
  index,
  text,
  className,
  style,
  as = "span",
}: {
  index: number;
  text: string;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}) {
  return (
    <ReportCopyTextField
      text={text}
      path={`copy.appeal_points.${index}`}
      as={as}
      className={className}
      style={style}
    />
  );
}

export function ReportCopySupportingFactor({
  index,
  text,
  className,
  style,
  as = "span",
}: {
  index: number;
  text: string;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
}) {
  return (
    <ReportCopyTextField
      text={text}
      path={`copy.supporting_factors.${index}`}
      as={as}
      className={className}
      style={style}
    />
  );
}

export function ReportCopyCta(props: Omit<TextFieldProps, "path">) {
  return <ReportCopyTextField {...props} path="copy.cta" />;
}

export function ReportCopyKeyMetricsLine(props: Omit<TextFieldProps, "path">) {
  return <ReportCopyTextField {...props} path="copy.key_metrics_line" />;
}
