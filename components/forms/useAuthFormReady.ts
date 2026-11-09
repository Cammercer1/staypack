"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const ready = () => true;
const waiting = () => false;

/** Keep prerendered forms inert until their client submit handler is attached. */
export function useAuthFormReady() {
  return useSyncExternalStore(subscribe, ready, waiting);
}
