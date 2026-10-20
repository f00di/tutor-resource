import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import { CURRENCY_CODES, minorToInput, toMinor } from "@/lib/money";
import { allZones, deviceZone, zoneName, zoneOffsetLabel, zonePlace } from "@/lib/time";
import type { CurrencyCode, Tone } from "@/lib/types";

/** A labelled field; the label wraps its control. */
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className ?? ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

/** A labelled group of buttons or checkboxes (no single control to wrap). */
export function Group({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>
        {label}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (value: T) => void; label?: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A money amount typed as a normal number (1,200.50 or ١٢٠٠٫٥), kept as minor units. */
export function MoneyInput({ value, currency, onChange, ...rest }: { value: number; currency: CurrencyCode; onChange: (minor: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(() => minorToInput(value, currency));
  // Follow outside changes (another currency, a reset) unless the field already shows that amount.
  useEffect(() => {
    setText((current) => (toMinor(current, currency) === value ? current : minorToInput(value, currency)));
  }, [value, currency]);
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const minor = toMinor(event.target.value, currency);
        if (minor !== null && minor >= 0) onChange(minor);
      }}
      onBlur={() => setText(minorToInput(value, currency))}
    />
  );
}

export function CurrencySelect({ value, onChange, id }: { value: CurrencyCode; onChange: (value: CurrencyCode) => void; id?: string }) {
  const { t } = useI18n();
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as CurrencyCode)}>
      {CURRENCY_CODES.map((code) => (
        <option key={code} value={code}>
          {code} · {t(`currency.${code}`)}
        </option>
      ))}
    </select>
  );
}

/** Gulf zones first, then every zone, each with its readable name and offset. */
export function ZoneSelect({ value, onChange }: { value: string; onChange: (zone: string) => void }) {
  const { t, locale, lang } = useI18n();
  const [zones] = useState(allZones);
  const local = deviceZone();
  const label = (zone: string) => `${zonePlace(zone, lang)} · ${zoneName(zone, locale)} (${zoneOffsetLabel(zone, locale)})`;
  const gulf = zones.slice(0, 6);
  const rest = zones.slice(6);
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {!zones.includes(local) && <option value={local}>{label(local)}</option>}
      <optgroup label={t("zone.gulf")}>
        {gulf.map((zone) => (
          <option key={zone} value={zone}>
            {label(zone)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t("zone.all")}>
        {rest.map((zone) => (
          <option key={zone} value={zone}>
            {zone === local ? `${label(zone)} · ${t("zone.yours")}` : label(zone)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export const TONES: Tone[] = ["sage", "peach", "lavender", "sky", "rose", "sunshine"];

export function TonePicker({ value, onChange }: { value: Tone; onChange: (tone: Tone) => void }) {
  const { t } = useI18n();
  return (
    <div className="tone-picker">
      {TONES.map((tone) => (
        <button key={tone} type="button" className={`tone-${tone}`} aria-pressed={tone === value} aria-label={t(`tone.${tone}`)} onClick={() => onChange(tone)} />
      ))}
    </div>
  );
}

/** Mon Tue Wed… as toggles, in the week order the tutor chose. */
export function DayChips({ value, onChange, weekStart }: { value: number[]; onChange: (days: number[]) => void; weekStart: number }) {
  const { weekday } = useI18n();
  const order = Array.from({ length: 7 }, (_, index) => (weekStart + index) % 7);
  return (
    <div className="day-chips">
      {order.map((day) => {
        const on = value.includes(day);
        return (
          <button key={day} type="button" aria-pressed={on} aria-label={weekday(day, "long")} onClick={() => onChange(on ? value.filter((item) => item !== day) : [...value, day].sort())}>
            {weekday(day, "short")}
          </button>
        );
      })}
    </div>
  );
}

/** Lesson length choices in minutes, plus whatever the lesson already has. */
export function DurationSelect({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const { t } = useI18n();
  const options = [...new Set([30, 45, 60, 75, 90, 105, 120, 150, 180, value])].sort((a, b) => a - b);
  return (
    <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {options.map((minutes) => (
        <option key={minutes} value={minutes}>
          {t("duration.minutes", { count: minutes })}
        </option>
      ))}
    </select>
  );
}
