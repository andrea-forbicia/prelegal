"use client";

import type { ReactNode } from "react";
import type { NdaForm, Party } from "@/lib/cover-page";

type Props = {
  form: NdaForm;
  onChange: (form: NdaForm) => void;
};

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      {children}
    </label>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function YearsInput({
  value,
  disabled,
  onChange,
  label,
}: {
  value: number;
  disabled: boolean;
  onChange: (years: number) => void;
  label: string;
}) {
  return (
    <input
      type="number"
      min={1}
      max={99}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

export function NdaFormFields({ form, onChange }: Props) {
  function update<K extends keyof NdaForm>(key: K, value: NdaForm[K]) {
    onChange({ ...form, [key]: value });
  }

  function updateParty(index: 0 | 1, key: keyof Party, value: string) {
    const parties: NdaForm["parties"] = [...form.parties];
    parties[index] = { ...parties[index], [key]: value };
    onChange({ ...form, parties });
  }

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      {([0, 1] as const).map((index) => (
        <Card key={index} title={`Party ${index + 1}`}>
          <Field label="Company">
            <input
              className={inputClass}
              value={form.parties[index].company}
              onChange={(e) => updateParty(index, "company", e.target.value)}
              autoComplete="organization"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signatory name">
              <input
                className={inputClass}
                value={form.parties[index].name}
                onChange={(e) => updateParty(index, "name", e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field label="Title">
              <input
                className={inputClass}
                value={form.parties[index].title}
                onChange={(e) => updateParty(index, "title", e.target.value)}
                autoComplete="organization-title"
              />
            </Field>
          </div>
          <Field label="Notice address" hint="Use either email or postal address">
            <input
              className={inputClass}
              value={form.parties[index].noticeAddress}
              onChange={(e) => updateParty(index, "noticeAddress", e.target.value)}
            />
          </Field>
        </Card>
      ))}

      <Card title="Agreement terms">
        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea
            className={inputClass}
            rows={3}
            value={form.purpose}
            onChange={(e) => update("purpose", e.target.value)}
          />
        </Field>

        <Field label="Effective Date">
          <input
            type="date"
            className={inputClass}
            value={form.effectiveDate}
            onChange={(e) => update("effectiveDate", e.target.value)}
          />
        </Field>

        <div className="text-sm" role="radiogroup" aria-labelledby="mnda-term-label">
          <span id="mnda-term-label" className="font-medium text-slate-800">MNDA Term</span>
          <span className="block text-xs text-slate-500">The length of this MNDA</span>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="mndaTerm"
              checked={form.mndaTerm === "expires"}
              onChange={() => update("mndaTerm", "expires")}
            />
            Expires
            <YearsInput
              label="MNDA Term in years"
              value={form.mndaTermYears}
              disabled={form.mndaTerm !== "expires"}
              onChange={(years) => update("mndaTermYears", years)}
            />
            year(s) from Effective Date
          </label>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="mndaTerm"
              checked={form.mndaTerm === "untilTerminated"}
              onChange={() => update("mndaTerm", "untilTerminated")}
            />
            Continues until terminated
          </label>
        </div>

        <div className="text-sm" role="radiogroup" aria-labelledby="confidentiality-label">
          <span id="confidentiality-label" className="font-medium text-slate-800">
            Term of Confidentiality
          </span>
          <span className="block text-xs text-slate-500">
            How long Confidential Information is protected
          </span>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="confidentialityTerm"
              checked={form.confidentialityTerm === "years"}
              onChange={() => update("confidentialityTerm", "years")}
            />
            <YearsInput
              label="Term of Confidentiality in years"
              value={form.confidentialityYears}
              disabled={form.confidentialityTerm !== "years"}
              onChange={(years) => update("confidentialityYears", years)}
            />
            year(s) from Effective Date
          </label>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="confidentialityTerm"
              checked={form.confidentialityTerm === "perpetual"}
              onChange={() => update("confidentialityTerm", "perpetual")}
            />
            In perpetuity
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Governing Law" hint="State, e.g. Delaware">
            <input
              className={inputClass}
              value={form.governingLaw}
              onChange={(e) => update("governingLaw", e.target.value)}
            />
          </Field>
          <Field label="Jurisdiction" hint="City or county and state, e.g. New Castle, DE">
            <input
              className={inputClass}
              value={form.jurisdiction}
              onChange={(e) => update("jurisdiction", e.target.value)}
            />
          </Field>
        </div>

        <Field label="MNDA Modifications" hint="List any modifications to the MNDA">
          <textarea
            className={inputClass}
            rows={3}
            value={form.modifications}
            onChange={(e) => update("modifications", e.target.value)}
          />
        </Field>
      </Card>
    </form>
  );
}
