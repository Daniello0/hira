'use client';

import type { TextareaHTMLAttributes } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';
import { EmploymentType, SeniorityLevel, WorkFormat, type UpdateProfileRequest } from '@hira/contracts';
import { useEffect } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { employmentLabel, seniorityLabel, workFormatLabel } from '../../common/utils/enum-labels';
import { emptyProfileForm, profileSchema, toProfileRequest, type ProfileFormValues } from './profile.schema';

interface ProfileFormProps {
  values: ProfileFormValues | null;
  notice: string | null;
  onSave: (body: UpdateProfileRequest) => Promise<void>;
}

/** Profile fields except cities, which the location picker saves on its own. */
export function ProfileForm({ values, notice, onSave }: ProfileFormProps) {
  const form = useForm<ProfileFormValues>({ resolver: yupResolver(profileSchema), defaultValues: emptyProfileForm() });
  useEffect(() => {
    if (values !== null) form.reset(values);
  }, [values, form]);
  const formats = form.watch('preferredWorkFormat');
  const employment = form.watch('preferredEmployment');
  return (
    <form className="space-y-3" onSubmit={form.handleSubmit((next) => void onSave(toProfileRequest(next)))}>
      <TextField label="Headline" {...form.register('headline')} />
      <TextArea label="About" {...form.register('about')} />
      <SeniorityField field={form.register('seniority')} />
      <TextField label="Desired roles" placeholder="QA, Python" {...form.register('desiredRoles')} />
      <Checks legend="Work format" options={Object.values(WorkFormat)} labelOf={workFormatLabel} selected={formats} onChange={(next) => form.setValue('preferredWorkFormat', next)} />
      <Checks legend="Employment" options={Object.values(EmploymentType)} labelOf={employmentLabel} selected={employment} onChange={(next) => form.setValue('preferredEmployment', next)} />
      <TextField label="Minimum salary" inputMode="decimal" {...form.register('salaryExpectationMin')} />
      <TextField label="Currency" maxLength={3} {...form.register('currency')} />
      <TextArea label="Education" {...form.register('education')} />
      {form.formState.errors.seniority !== undefined ? <p role="alert">Choose a seniority from the list</p> : null}
      {form.formState.errors.salaryExpectationMin !== undefined ? <p role="alert">{form.formState.errors.salaryExpectationMin.message}</p> : null}
      {notice !== null ? <p role="status">{notice}</p> : null}
      <Button type="submit">Save profile</Button>
    </form>
  );
}

function SeniorityField({ field }: { field: UseFormRegisterReturn }) {
  return (
    <label className="block text-sm text-hira-muted">
      Seniority
      <select className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" {...field}>
        <option value="">Not set</option>
        {Object.values(SeniorityLevel).map((level) => <option key={level} value={level}>{seniorityLabel(level)}</option>)}
      </select>
    </label>
  );
}

function Checks<T extends string>({ legend, options, labelOf, selected, onChange }: { legend: string; options: readonly T[]; labelOf: (option: T) => string; selected: readonly T[]; onChange: (next: T[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm text-hira-muted">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-3 text-sm">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(toggle(selected, option))} />
            {labelOf(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function toggle<T extends string>(selected: readonly T[], option: T): T[] {
  if (selected.includes(option)) return selected.filter((item) => item !== option);
  return [...selected, option];
}

function TextArea({ label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-sm text-hira-muted">
      {label}
      <textarea className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" rows={3} {...rest} />
    </label>
  );
}
