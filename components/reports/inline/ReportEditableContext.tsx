"use client";

import {
  createContext,
  useContext,
  useMemo,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { ReportCopyFieldPath } from "@/lib/reports/editable/reportCopyPaths";
import type { ReportImageSlot } from "@/lib/reports/editable/reportImageSlots";

export type ReportEditableContextValue = {
  editable: boolean;
  brandPrimaryColour: string;
  setField: (path: ReportCopyFieldPath, value: string) => void;
  onFieldFocus?: (path: ReportCopyFieldPath | null) => void;
  openImagePicker: (slot: ReportImageSlot) => void;
  blurbFlushRef?: MutableRefObject<(() => string | null) | null>;
};

const defaultValue: ReportEditableContextValue = {
  editable: false,
  brandPrimaryColour: "var(--hiline-green)",
  setField: () => {},
  openImagePicker: () => {},
};

const ReportEditableContext = createContext<ReportEditableContextValue>(defaultValue);

export function useReportEditableContext() {
  return useContext(ReportEditableContext);
}

export function ReportEditableProvider({
  children,
  brandPrimaryColour,
  setField,
  onFieldFocus,
  openImagePicker,
  blurbFlushRef,
}: {
  children: ReactNode;
  brandPrimaryColour: string;
  setField: (path: ReportCopyFieldPath, value: string) => void;
  onFieldFocus?: (path: ReportCopyFieldPath | null) => void;
  openImagePicker: (slot: ReportImageSlot) => void;
  blurbFlushRef?: MutableRefObject<(() => string | null) | null>;
}) {
  const value = useMemo(
    (): ReportEditableContextValue => ({
      editable: true,
      brandPrimaryColour,
      setField,
      onFieldFocus,
      openImagePicker,
      blurbFlushRef,
    }),
    [brandPrimaryColour, setField, onFieldFocus, openImagePicker, blurbFlushRef],
  );

  return (
    <ReportEditableContext.Provider value={value}>
      {children}
    </ReportEditableContext.Provider>
  );
}
