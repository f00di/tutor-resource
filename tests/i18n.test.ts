import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import ar from "../i18n/ar.json";
import en from "../i18n/en.json";
import { createTranslator } from "@/lib/i18n";

type Catalog = Record<string, unknown>;
const keys = (catalog: Catalog) => Object.keys(catalog).filter((key) => !key.startsWith("_"));
const placeholders = (value: unknown): Set<string> => {
  const texts = typeof value === "string" ? [value] : Object.values(value as Record<string, string>);
  return new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!)));
};
const ARABIC_FORMS = ["zero", "one", "two", "few", "many", "other"];

describe("translations", () => {
  it("has the same keys in English and Arabic", () => {
    expect(keys(ar as Catalog).sort()).toEqual(keys(en as Catalog).sort());
  });

  it("has every plural form", () => {
    for (const key of keys(en as Catalog)) {
      const english = (en as Catalog)[key];
      const arabic = (ar as Catalog)[key];
      if (typeof english === "object") {
        expect(Object.keys(english as object).sort(), key).toEqual(["one", "other"]);
        expect(Object.keys(arabic as object).sort(), key).toEqual([...ARABIC_FORMS].sort());
      } else {
        expect(typeof arabic, key).toBe("string");
      }
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const key of keys(en as Catalog)) {
      const english = placeholders((en as Catalog)[key]);
      const arabic = placeholders((ar as Catalog)[key]);
      // Arabic singular and dual forms spell the number out, so {count} can be missing from some forms.
      english.delete("count");
      arabic.delete("count");
      expect([...arabic].sort(), key).toEqual([...english].sort());
    }
  });

  it("picks Arabic plural forms and keeps Western digits", () => {
    const { t, number } = createTranslator("ar", ar as Catalog);
    expect(t("today.lessonsCount", { count: 1 })).toBe("درس واحد");
    expect(t("today.lessonsCount", { count: 2 })).toBe("درسان");
    expect(t("today.lessonsCount", { count: 5 })).toBe("5 دروس");
    expect(t("today.lessonsCount", { count: 12 })).toBe("12 درسًا");
    expect(number(1234)).toBe("1,234");
  });

  it("isolates inserted names in Arabic so Latin text keeps its order", () => {
    const { t } = createTranslator("ar", ar as Catalog);
    expect(t("student.deleted", { name: "Sara A." })).toBe("تم حذف ⁨Sara A.⁩");
  });

  it("has no hard-coded English in visible text attributes", () => {
    // Labels, placeholders and titles must come from the catalogues (t()), not be typed in the code.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".tsx")) {
          const source = readFileSync(path, "utf8");
          for (const match of source.matchAll(/\b(aria-label|placeholder|title)="([^"]*[A-Za-z][^"]*)"/g)) {
            if (!/^https?:|^\+971/.test(match[2]!)) offenders.push(`${path}: ${match[0]}`);
          }
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});
