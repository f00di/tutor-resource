import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { detectLang, loadCatalog } from "./lib/i18n";

// The starting language's text is loaded first, so an Arabic start never flashes English.
const lang = detectLang();
void loadCatalog(lang)
  .catch(() => undefined)
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App initialLang={lang} />
      </StrictMode>
    );
  });
