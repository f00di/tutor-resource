import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { listenForErrors } from "./lib/errors";
import { detectLang, loadCatalog } from "./lib/i18n";

// Errors nothing else catches (a failed save, a file that didn't load) are shown instead of ignored.
listenForErrors();

// The starting language's text is loaded first, so an Arabic start never flashes English.
const lang = detectLang();
void loadCatalog(lang)
  .catch(() => undefined)
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        {/* The last safety net: never a blank window. */}
        <ErrorBoundary scope="app">
          <App initialLang={lang} />
        </ErrorBoundary>
      </StrictMode>
    );
  });
