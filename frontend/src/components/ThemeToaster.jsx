import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";

function subscribe(cb) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

function getToastTheme() {
  return document.documentElement.classList.contains("theme-light") ? "light" : "dark";
}

/** Sonner toaster that follows the app light/dark theme. */
export function ThemeToaster({ position = "top-center", ...props }) {
  const theme = useSyncExternalStore(subscribe, getToastTheme, () => "dark");
  return <Toaster theme={theme} position={position} {...props} />;
}
