"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ListingImageMetaMap } from "@/lib/types";

const BrochureImageMetaContext = createContext<ListingImageMetaMap>({});

export function BrochureImageMetaProvider({
  meta,
  children,
}: {
  meta?: ListingImageMetaMap | null;
  children: ReactNode;
}) {
  return (
    <BrochureImageMetaContext.Provider value={meta ?? {}}>
      {children}
    </BrochureImageMetaContext.Provider>
  );
}

export function useBrochureListingImageMeta() {
  return useContext(BrochureImageMetaContext);
}
