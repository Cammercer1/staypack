"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  EditableProvider,
  type BrochureImageSlot,
} from "@/components/collateral/sales-brochure/inline/EditableContext";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import {
  blurbBlocksToPlainText,
  getBlurbBlocksForEditor,
  normalizeBlurbBlocksForEditor,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { finalReportToBrochureShape } from "@/lib/reports/finalReportToBrochureShape";
import type { ReportCopyFieldPath } from "@/lib/reports/editable/reportCopyPaths";
import type { ReportImageSlot } from "@/lib/reports/editable/reportImageSlots";
import {
  resolveReportPageVariant,
  type ReportPageVariant,
} from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

export type ReportBrochureInlineEditConfig = {
  setField: (path: ReportCopyFieldPath, value: string) => void;
  openImagePicker: (slot: ReportImageSlot) => void;
  brandPrimaryColour?: string;
  onFieldFocus?: (path: ReportCopyFieldPath | null) => void;
  blurbFlushRef?: MutableRefObject<(() => string | null) | null>;
};

const ReportBrochureInlineEditContext = createContext<ReportBrochureInlineEditConfig | null>(
  null,
);

export function ReportBrochureInlineEditProvider({
  config,
  children,
}: {
  config: ReportBrochureInlineEditConfig;
  children: ReactNode;
}) {
  return (
    <ReportBrochureInlineEditContext.Provider value={config}>
      {children}
    </ReportBrochureInlineEditContext.Provider>
  );
}

export function useReportBrochureInlineEdit() {
  return useContext(ReportBrochureInlineEditContext);
}

function brochurePathToReportPath(path: BrochureCopyFieldPath): ReportCopyFieldPath {
  if (path.startsWith("copy.property_highlights.")) {
    const index = path.split(".")[2];
    return `copy.appeal_points.${index}` as ReportCopyFieldPath;
  }
  if (path === "copy.inspection_cta") {
    return "copy.cta";
  }
  return path as ReportCopyFieldPath;
}

function brochureSlotToReportSlot(slot: BrochureImageSlot): ReportImageSlot {
  if (slot === "hero") {
    return "hero";
  }
  if (slot.kind === "page_one") {
    if (slot.index === 0) {
      return "hero";
    }
    return { kind: "secondary", index: slot.index - 1 };
  }
  if (slot.kind === "gallery") {
    return { kind: "selected", index: slot.index };
  }
  if (slot.kind === "page_two") {
    return { kind: "selected", index: slot.index };
  }
  return "hero";
}

function useBrochureEditableFromReport(
  report: FinalReportJson,
  reportVariant: ReportPageVariant | undefined,
  editable: ReportBrochureInlineEditConfig,
) {
  const document = useMemo(
    () => finalReportToBrochureShape(report, reportVariant),
    [report, reportVariant],
  );
  const blurbBlocks = useMemo(
    () => getBlurbBlocksForEditor(document.copy),
    [document.copy],
  );
  const brochureBlurbFlushRef = useRef<(() => BrochureBlurbBlock[] | null) | null>(null);

  const setField = useCallback(
    (path: BrochureCopyFieldPath, value: string) => {
      editable.setField(brochurePathToReportPath(path), value);
    },
    [editable],
  );

  const setBlurbBlocks = useCallback(
    (blocks: BrochureBlurbBlock[]) => {
      const text = blurbBlocksToPlainText(normalizeBlurbBlocksForEditor(blocks));
      editable.setField("copy.blurb", text);
    },
    [editable],
  );

  const openImagePicker = useCallback(
    (slot: BrochureImageSlot) => {
      editable.openImagePicker(brochureSlotToReportSlot(slot));
    },
    [editable],
  );

  const onFieldFocus = useCallback(
    (path: BrochureCopyFieldPath | null) => {
      editable.onFieldFocus?.(path ? brochurePathToReportPath(path) : null);
    },
    [editable],
  );

  useEffect(() => {
    const reportFlushRef = editable.blurbFlushRef;
    if (!reportFlushRef) {
      return;
    }
    reportFlushRef.current = () => {
      const blocks = brochureBlurbFlushRef.current?.();
      if (!blocks) {
        return null;
      }
      return blurbBlocksToPlainText(normalizeBlurbBlocksForEditor(blocks));
    };
    return () => {
      reportFlushRef.current = null;
    };
  }, [editable.blurbFlushRef]);

  return {
    blurbBlocks,
    brandPrimaryColour:
      editable.brandPrimaryColour ?? report.agency.primary_colour ?? "var(--hiline-green)",
    setField,
    setBlurbBlocks,
    openImagePicker,
    onFieldFocus,
    brochureBlurbFlushRef,
  };
}

function ReportBrochureEditableLayerInner({
  report,
  reportVariant,
  editable,
  children,
}: {
  report: FinalReportJson;
  reportVariant?: ReportPageVariant;
  editable: ReportBrochureInlineEditConfig;
  children: ReactNode;
}) {
  const resolvedVariant = resolveReportPageVariant(report, reportVariant);
  const bridge = useBrochureEditableFromReport(report, resolvedVariant, editable);

  return (
    <EditableProvider
      blurbBlocks={bridge.blurbBlocks}
      brandPrimaryColour={bridge.brandPrimaryColour}
      setField={bridge.setField}
      setBlurbBlocks={bridge.setBlurbBlocks}
      openImagePicker={bridge.openImagePicker}
      onFieldFocus={bridge.onFieldFocus}
      blurbFlushRef={bridge.brochureBlurbFlushRef}
    >
      {children}
    </EditableProvider>
  );
}

/**
 * Wraps brochure page-1 layout with EditableProvider when inline edit is active.
 * Must sit directly above Split/Bold/etc. layout components (inside ReportBrochureStylePageOne).
 */
export function ReportBrochureEditableLayer({
  report,
  reportVariant,
  children,
}: {
  report: FinalReportJson;
  reportVariant?: ReportPageVariant;
  children: ReactNode;
}) {
  const editable = useReportBrochureInlineEdit();

  if (!editable) {
    return <>{children}</>;
  }

  return (
    <ReportBrochureEditableLayerInner
      report={report}
      reportVariant={reportVariant}
      editable={editable}
    >
      {children}
    </ReportBrochureEditableLayerInner>
  );
}
