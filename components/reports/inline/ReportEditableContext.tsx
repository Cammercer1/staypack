"use client";

import {
  createContext,
  useContext,
  useMemo,
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
}: {
  children: ReactNode;
  brandPrimaryColour: string;
  setField: (path: ReportCopyFieldPath, value: string) => void;
  onFieldFocus?: (path: ReportCopyFieldPath | null) => void;
  openImagePicker: (slot: ReportImageSlot) => void;
}) {
  const value = useMemo(
    (): ReportEditableContextValue => ({
      editable: true,
      brandPrimaryColour,
      setField,
      onFieldFocus,
      openImagePicker,
    }),
    [brandPrimaryColour, setField, onFieldFocus, openImagePicker],
  );

  return (
    <ReportEditableContext.Provider value={value}>
      {children}
    </ReportEditableContext.Provider>
  );
}
