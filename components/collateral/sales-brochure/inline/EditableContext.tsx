"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";

export type BrochureImageSlot =
  | "hero"
  | { kind: "page_one"; index: number }
  | { kind: "page_two"; index: number }
  | { kind: "gallery"; index: number };

export type EditableContextValue = {
  editable: boolean;
  blurbBlocks: BrochureBlurbBlock[];
  brandPrimaryColour: string;
  setField: (path: BrochureCopyFieldPath, value: string) => void;
  setBlurbBlocks: (blocks: BrochureBlurbBlock[]) => void;
  openImagePicker: (slot: BrochureImageSlot) => void;
  onFieldFocus?: (path: BrochureCopyFieldPath | null) => void;
};

const defaultValue: EditableContextValue = {
  editable: false,
  blurbBlocks: [],
  brandPrimaryColour: "var(--hiline-green)",
  setField: () => {},
  setBlurbBlocks: () => {},
  openImagePicker: () => {},
};

const EditableContext = createContext<EditableContextValue>(defaultValue);

export function useEditableContext() {
  return useContext(EditableContext);
}

export function EditableProvider({
  children,
  blurbBlocks,
  brandPrimaryColour,
  setField,
  setBlurbBlocks,
  openImagePicker,
  onFieldFocus,
}: {
  children: ReactNode;
  blurbBlocks: BrochureBlurbBlock[];
  brandPrimaryColour: string;
  setField: (path: BrochureCopyFieldPath, value: string) => void;
  setBlurbBlocks: (blocks: BrochureBlurbBlock[]) => void;
  openImagePicker: (slot: BrochureImageSlot) => void;
  onFieldFocus?: (path: BrochureCopyFieldPath | null) => void;
}) {
  const value = useMemo(
    (): EditableContextValue => ({
      editable: true,
      blurbBlocks,
      brandPrimaryColour,
      setField,
      setBlurbBlocks,
      openImagePicker,
      onFieldFocus,
    }),
    [
      blurbBlocks,
      brandPrimaryColour,
      setField,
      setBlurbBlocks,
      openImagePicker,
      onFieldFocus,
    ],
  );

  return (
    <EditableContext.Provider value={value}>{children}</EditableContext.Provider>
  );
}

export function useEditableSetField() {
  const { editable, setField } = useEditableContext();
  return useCallback(
    (path: BrochureCopyFieldPath, value: string) => {
      if (editable) {
        setField(path, value);
      }
    },
    [editable, setField],
  );
}
