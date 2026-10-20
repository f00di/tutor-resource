import { lazy, Suspense } from "react";

import { DialogHost } from "./components/dialog-host";
import { Shell } from "./components/shell";
import { I18nProvider, type Lang } from "./lib/i18n";
import { useRoute, type Route } from "./lib/router";
import { useSettings } from "./lib/settings";
import { BlackoutsPage } from "./pages/blackouts";
import { InvoicePage } from "./pages/invoice";
import { InvoicesPage } from "./pages/invoices";
import { SettingsPage } from "./pages/settings";
import { StudentPage } from "./pages/student";
import { StudentsPage } from "./pages/students";
import { TodayPage } from "./pages/today";

// The calendar library only loads with the Schedule page; the service worker caches it for offline use.
const SchedulePage = lazy(() => import("./pages/schedule"));
// Update prompts only exist in the built app (the service worker isn't registered in development or tests).
const UpdateToast = import.meta.env.PROD ? lazy(() => import("./components/update-toast")) : null;

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "schedule":
      return (
        <Suspense fallback={<div className="calendar-page" />}>
          <SchedulePage />
        </Suspense>
      );
    case "blackouts":
      return <BlackoutsPage />;
    case "students":
      return <StudentsPage />;
    case "student":
      return <StudentPage id={route.id ?? ""} />;
    case "invoices":
      return <InvoicesPage />;
    case "invoice":
      return <InvoicePage id={route.id ?? ""} />;
    case "settings":
      return <SettingsPage />;
    default:
      return <TodayPage />;
  }
}

export function App({ initialLang }: { initialLang: Lang }) {
  const settings = useSettings();
  const route = useRoute();
  return (
    <I18nProvider initialLang={initialLang} hour12={settings.hour12}>
      <DialogHost>
        <Shell route={route}>
          <Page route={route} />
        </Shell>
        {UpdateToast && (
          <Suspense fallback={null}>
            <UpdateToast />
          </Suspense>
        )}
      </DialogHost>
    </I18nProvider>
  );
}
