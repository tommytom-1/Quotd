import { useSyncExternalStore } from "react";

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
