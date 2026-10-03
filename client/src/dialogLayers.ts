import { useSyncExternalStore } from "react";

type DialogLayer = { element: HTMLDialogElement; busy: boolean };
const layers: DialogLayer[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const current = () => layers.at(-1) ?? null;

// Native modal dialogs occupy the browser's top layer. The floating controls
// must live inside the active dialog to stay visible and interactive above it.
export function registerDialog(element: HTMLDialogElement) {
  layers.push({ element, busy: false });
  notify();
  return () => {
    const index = layers.findIndex((layer) => layer.element === element);
    if (index !== -1) layers.splice(index, 1);
    notify();
  };
}

export function setDialogBusy(element: HTMLDialogElement, busy: boolean) {
  const index = layers.findIndex((layer) => layer.element === element);
  if (index === -1 || layers[index].busy === busy) return;
  layers[index] = { element, busy };
  notify();
}

export function useDialogLayer() {
  return useSyncExternalStore(subscribe, current, () => null);
}
