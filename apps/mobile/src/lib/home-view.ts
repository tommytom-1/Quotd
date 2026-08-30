import { useSyncExternalStore } from "react";

export type HomeView = "wall" | "people";

// Kept outside React so the bottom bar on any screen can read and switch it.
let current: HomeView = "wall";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setHomeView(view: HomeView) {
  if (view !== current) {
    current = view;
    for (const listener of listeners) {
      listener();
    }
  }
}

/** Which of its two views the home screen shows. */
export function useHomeView() {
  return useSyncExternalStore(subscribe, () => current);
}
