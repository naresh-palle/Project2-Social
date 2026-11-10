import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "@/index.css";

// Ensure vibrant light theme class before first paint of React tree
(function ensureTheme() {
  try {
    const root = document.documentElement;
    if (!root.classList.contains("theme-light") && !root.classList.contains("theme-dark")) {
      const theme = localStorage.getItem("cr8_theme") || "light";
      let resolved = theme;
      if (theme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      root.classList.add(resolved === "dark" ? "theme-dark" : "theme-light");
      root.style.colorScheme = resolved === "dark" ? "dark" : "light";
    }
  } catch (_) {}
})();

import App from "@/App";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "858111971322-uf792cb63b4u97u1fu494kngaajuaibr.apps.googleusercontent.com";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  });
}
