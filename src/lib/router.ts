// A small hash router (#/schedule, #/students/<id>): works on GitHub Pages and offline with no server
// rules, and the installed app always opens on the same page.
import { useEffect, useState } from "react";

export type RouteName = "today" | "schedule" | "blackouts" | "students" | "student" | "invoices" | "invoice" | "settings";
export interface Route {
  name: RouteName;
  id?: string;
}

export function parseHash(hash: string): Route {
  const [first = "", second] = hash.replace(/^#\/?/, "").split("?")[0]!.split("/").filter(Boolean);
  if (first === "students" && second) return { name: "student", id: decodeURIComponent(second) };
  if (first === "invoices" && second) return { name: "invoice", id: decodeURIComponent(second) };
  if (["schedule", "blackouts", "students", "invoices", "settings"].includes(first)) return { name: first as RouteName };
  return { name: "today" };
}

export const hrefFor = (route: Route) => {
  if (route.name === "student") return `#/students/${encodeURIComponent(route.id ?? "")}`;
  if (route.name === "invoice") return `#/invoices/${encodeURIComponent(route.id ?? "")}`;
  return route.name === "today" ? "#/" : `#/${route.name}`;
};

export function navigate(route: Route) {
  window.location.hash = hrefFor(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const update = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}
