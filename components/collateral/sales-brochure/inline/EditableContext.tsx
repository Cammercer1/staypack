"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { BrochureCopyFieldPath } from "@/lib/collateral/sales-brochure/editablePaths";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";

export type BrochureImageSlot =
  | "hero"
  | { kind: "page_one"; index: number }
  | { kind: "page_two"; index: number }
  | { kind: "gallery"; index: number };

export type EditableContextValue = {
  editable: boolean;
  /** Screen preview: show full blurb instead of print line-clamp truncation. */
  showFullBlurb: boolean;
  blurbBlocks: BrochureBlurbBlock[];
  brandPrimaryColour: string;
  setField: (path: BrochureCopyFieldPath, value: string) => void;
  setBlurbBlocks: (blocks: BrochureBlurbBlock[]) => void;
  openImagePicker: (slot: BrochureImageSlot) => void;
  onFieldFocus?: (path: BrochureCopyFieldPath | null) => void;
  blurbFlushRef?: MutableRefObject<(() => BrochureBlurbBlock[] | null) | null>;
};

const defaultValue: EditableContextValue = {
  editable: false,
  showFullBlurb: false,
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
  blurbFlushRef,
}: {
  children: ReactNode;
  blurbBlocks: BrochureBlurbBlock[];
  brandPrimaryColour: string;
  setField: (path: BrochureCopyFieldPath, value: string) => void;
  setBlurbBlocks: (blocks: BrochureBlurbBlock[]) => void;
  openImagePicker: (slot: BrochureImageSlot) => void;
  onFieldFocus?: (path: BrochureCopyFieldPath | null) => void;
  blurbFlushRef?: MutableRefObject<(() => BrochureBlurbBlock[] | null) | null>;
}) {
  const value = useMemo(
    (): EditableContextValue => ({
      editable: true,
      showFullBlurb: true,
      blurbBlocks,
      brandPrimaryColour,
      setField,
      setBlurbBlocks,
      openImagePicker,
      onFieldFocus,
      blurbFlushRef,
    }),
    [
      blurbBlocks,
      brandPrimaryColour,
      setField,
      setBlurbBlocks,
      openImagePicker,
      onFieldFocus,
      blurbFlushRef,
    ],
  );

  return (
    <EditableContext.Provider value={value}>{children}</EditableContext.Provider>
  );
}

export function BrochureScreenPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const parent = useContext(EditableContext);
  const value = useMemo(
    (): EditableContextValue => ({
      ...parent,
      showFullBlurb: true,
    }),
    [parent],
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
