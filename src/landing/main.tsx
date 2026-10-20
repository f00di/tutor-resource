// The information page at the site root: what Tutorcat Desk does and the sign-up form. The app itself
// lives at app/ (app/index.html → src/main.tsx). This page stores nothing and registers no service worker.
import "../styles.css";
import "./landing.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { detectLang, I18nProvider, loadCatalog } from "@/lib/i18n";
import { Landing } from "./landing";

const lang = detectLang();
void loadCatalog(lang)
  .catch(() => undefined)
  .then(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <I18nProvider initialLang={lang} hour12>
          <Landing />
        </I18nProvider>
      </StrictMode>
    );
  });
