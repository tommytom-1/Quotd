import { useSyncExternalStore } from "react";

import type { Frame } from "@/lib/polaroid";

// Kept outside React so the bottom bar on any screen can read and change them.
let personId: string | null = null;
let pickerOpen = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Shows one person's wall, or everyone's quotes for null. */
export function setWallPerson(id: string | null) {
  if (id !== personId) {
    personId = id;
    notify();
  }
}

/** ID of the person whose wall the home screen shows, null for all quotes. */
export function useWallPerson() {
  return useSyncExternalStore(subscribe, () => personId);
}

export function setPeoplePickerOpen(open: boolean) {
  if (open !== pickerOpen) {
    pickerOpen = open;
    notify();
  }
}

/** Whether the picker for whose quotes to show is open over the wall. */
export function usePeoplePickerOpen() {
  return useSyncExternalStore(subscribe, () => pickerOpen);
}

/** A quote just saved, on its way from the capture screen to the wall. */
export interface ArrivingQuote {
  id: string;
  /** Where its developed print was on screen, untilted. */
  from: Frame;
  /** The print's tilt, in degrees. */
  rotate: number;
}

let arriving: ArrivingQuote | null = null;

/** Hands a saved quote's print over to the wall, which flies it into place. */
export function setArrivingQuote(next: ArrivingQuote | null) {
  if (next !== arriving) {
    arriving = next;
    notify();
  }
}

/** The quote flying onto the wall, or null once it has landed. */
export function useArrivingQuote() {
  return useSyncExternalStore(subscribe, () => arriving);
}
