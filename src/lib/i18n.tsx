// Translations, same rules as Tutorcat: strings live in i18n/<lang>.json as flat keys; a plural string
// is an object keyed by Intl.PluralRules categories ({ one, other }; Arabic also zero/two/few/many).
// Never pass what the tutor typed (names, notes, topics) through t(): it's shown as written.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import en from "../../i18n/en.json";
import type { CurrencyCode, Lang } from "./types";
import { formatMoney } from "./money";

type Catalog = Record<string, unknown>;
type Params = Record<string, string | number>;

export type { Lang };
export const LANGS = {
  en: { locale: "en-GB", dir: "ltr", name: "English" },
  // UAE convention, as on Tutorcat: Western digits (0-9) in Arabic text.
  ar: { locale: "ar-AE-u-nu-latn", dir: "rtl", name: "العربية" },
} as const;
export const DEFAULT_LANG: Lang = "en";
export const LANG_STORAGE_KEY = "tutorcat-desk.lang";
export const isLang = (value: unknown): value is Lang => value === "en" || value === "ar";

// English is bundled; Arabic is its own small file, loaded when needed (and cached for offline use).
const catalogs: Partial<Record<Lang, Catalog>> = { en };
export async function loadCatalog(lang: Lang): Promise<Catalog> {
  const loaded = catalogs[lang];
  if (loaded) return loaded;
  const catalog = (await import("../../i18n/ar.json")).default as Catalog;
  return (catalogs[lang] = catalog);
}
export const loadedCatalog = (lang: Lang) => catalogs[lang];

export type DateStyle = "short" | "medium" | "long" | "weekday" | "weekdayShort" | "month" | "dayMonth";
const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "long", day: "numeric", month: "long" },
  weekdayShort: { weekday: "short", day: "numeric", month: "short" },
  month: { month: "long", year: "numeric" },
  dayMonth: { day: "numeric", month: "long" },
};

export function createTranslator(lang: Lang, catalog: Catalog = catalogs[lang] ?? en, { hour12 = true }: { hour12?: boolean } = {}) {
  const { locale, dir, name } = LANGS[lang];
  const lookup = (key: string) => catalog[key] ?? (en as Catalog)[key];
  const plurals = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  const hoursFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const lists = new Intl.ListFormat(locale, { type: "conjunction" });
  const cache = new Map<string, Intl.DateTimeFormat>();
  const dateTime = (options: Intl.DateTimeFormatOptions) => {
    const key = JSON.stringify(options);
    let formatter = cache.get(key);
    if (!formatter) cache.set(key, (formatter = new Intl.DateTimeFormat(locale, options)));
    return formatter;
  };

  const t = (key: string, params: Params = {}) => {
    let value = lookup(key);
    if (value && typeof value === "object") {
      const forms = value as Record<string, string>;
      value = forms[plurals.select(Number(params["count"]) || 0)] ?? forms["other"];
    }
    if (typeof value !== "string") return key;
    // In right-to-left text, inserted names are isolated so Latin words and digits keep their order.
    return value.replace(/\{(\w+)\}/g, (match, param: string) => {
      const replacement = params[param];
      if (replacement === undefined) return match;
      if (typeof replacement === "number") return numbers.format(replacement);
      return dir === "rtl" ? `⁨${replacement}⁩` : replacement;
    });
  };

  return {
    lang,
    dir,
    locale,
    langName: name,
    hour12,
    t,
    /** True when a key exists (used for optional hints). */
    has: (key: string) => lookup(key) !== undefined,
    number: (value: number) => numbers.format(value),
    hours: (minutes: number) => hoursFormat.format(Math.round((minutes / 60) * 100) / 100),
    list: (items: string[]) => lists.format(items),
    money: (minor: number, currency: CurrencyCode) => formatMoney(minor, currency, locale),
    /** "5:30 pm" in a zone (the device's by default). */
    time: (ms: number, zone?: string) => dateTime({ hour: "numeric", minute: "2-digit", hour12, ...(zone ? { timeZone: zone } : {}) }).format(ms),
    /** An instant's date in a zone (the device's by default). */
    date: (ms: number, style: DateStyle = "medium", zone?: string) => dateTime({ ...DATE_STYLES[style], ...(zone ? { timeZone: zone } : {}) }).format(ms),
    /** A "YYYY-MM-DD" date, as written (no zone shift). */
    day: (key: string, style: DateStyle = "medium") => {
      const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
      return dateTime({ ...DATE_STYLES[style], timeZone: "UTC" }).format(Date.UTC(year, month - 1, day, 12));
    },
    /** Weekday name for 0 = Sunday ... 6 = Saturday. */
    weekday: (index: number, width: "short" | "long" = "short") => dateTime({ weekday: width, timeZone: "UTC" }).format(Date.UTC(2023, 0, 1 + index, 12)),
  };
}

export type Translator = ReturnType<typeof createTranslator>;

// ?lang=ar wins, then the remembered choice, then English. Mirrors the boot script in index.html.
export function detectLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (isLang(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Storage blocked: fall back to English.
  }
  return DEFAULT_LANG;
}

export function applyDocumentLang(lang: Lang, remember = false) {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = LANGS[lang].dir;
  if (!remember) return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
  const url = new URL(window.location.href);
  if (url.searchParams.has("lang")) {
    url.searchParams.delete("lang");
    window.history.replaceState(window.history.state, "", url);
  }
}

type I18nValue = Translator & { setLang: (lang: Lang) => void };
const I18nContext = createContext<I18nValue | null>(null);

/** main.tsx loads the starting language's text before the first render, so nothing flashes in English. */
export function I18nProvider({ initialLang, hour12, children }: { initialLang: Lang; hour12: boolean; children: ReactNode }) {
  const [state, setState] = useState(() => ({ lang: initialLang, catalog: catalogs[initialLang] ?? en }));

  const setLang = useCallback((next: Lang) => {
    void loadCatalog(next).then((catalog) => {
      setState({ lang: next, catalog });
      applyDocumentLang(next, true);
    });
  }, []);

  useEffect(() => applyDocumentLang(state.lang), [state.lang]);

  const value = useMemo<I18nValue>(() => ({ ...createTranslator(state.lang, state.catalog, { hour12 }), setLang }), [state, hour12, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

/** A translator for another language than the app's (an invoice or a message in the family's language). */
export function useTranslator(lang: Lang): Translator | null {
  const { hour12 } = useI18n();
  const [loaded, setLoaded] = useState<{ lang: Lang; catalog: Catalog } | null>(() => (catalogs[lang] ? { lang, catalog: catalogs[lang]! } : null));
  useEffect(() => {
    let live = true;
    void loadCatalog(lang).then((catalog) => live && setLoaded({ lang, catalog }));
    return () => {
      live = false;
    };
  }, [lang]);
  return useMemo(() => (loaded && loaded.lang === lang ? createTranslator(lang, loaded.catalog, { hour12 }) : null), [loaded, lang, hour12]);
}
