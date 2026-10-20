import { useEffect } from "react";

/** "Schedule · Tutorcat Desk" in the tab (and the installed app's title bar). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Tutorcat Desk` : "Tutorcat Desk";
  }, [title]);
}
