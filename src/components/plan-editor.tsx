import { Plus, X } from "lucide-react";
import { useState } from "react";

import { newId } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import type { PlanItem } from "@/lib/types";

/** "What to teach": a checklist the tutor ticks off in or after the lesson. */
export function PlanEditor({ items, onChange }: { items: PlanItem[]; onChange: (items: PlanItem[]) => void }) {
  const { t, date } = useI18n();
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId(), text, done: false }]);
    setDraft("");
  };
  const update = (id: string, patch: Partial<PlanItem>) => onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <div className="plan-editor">
      {items.map((item) => (
        <div key={item.id} className="plan-item">
          <input type="checkbox" checked={item.done} onChange={(event) => update(item.id, { done: event.target.checked })} aria-label={t("plan.done")} />
          <input className="input" value={item.text} onChange={(event) => update(item.id, { text: event.target.value })} aria-label={t("plan.topic")} />
          {item.carriedFrom && <span className="carried nowrap">{t("plan.from", { date: date(Date.parse(item.carriedFrom), "short") })}</span>}
          {item.movedOn && <span className="badge">{t("plan.movedOn")}</span>}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange(items.filter((other) => other.id !== item.id))} aria-label={t("plan.remove")}>
            <X />
          </button>
        </div>
      ))}
      <div className="plan-add">
        <input
          className="input"
          value={draft}
          placeholder={t("plan.placeholder")}
          aria-label={t("plan.add")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter adds the topic instead of saving the whole lesson.
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-outline" onClick={add} disabled={!draft.trim()}>
          <Plus />
          {t("plan.add")}
        </button>
      </div>
    </div>
  );
}
