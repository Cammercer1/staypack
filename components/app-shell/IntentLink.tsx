"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/** Prefetch a private page when someone approaches its link, not every sidebar route at once. */
export function IntentLink({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent}
    onMouseEnter={event => { setIntent(true); onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); onFocus?.(event); }}
    onTouchStart={event => { setIntent(true); onTouchStart?.(event); }} />;
}
