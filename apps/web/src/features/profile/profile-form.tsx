'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { EmploymentType, SeniorityLevel, WorkFormat, type UpdateProfileRequest } from '@hira/contracts';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../common/components/button';
import { Checkbox } from '../../common/components/checkbox';
import { AlertText } from '../../common/components/feedback';
import { Select } from '../../common/components/select';
import { TextArea, TextField } from '../../common/components/text-field';
import { employmentLabel, seniorityLabel, workFormatLabel } from '../../common/utils/enum-labels';
import { emptyProfileForm, profileSchema, toProfileRequest, type ProfileFormValues } from './profile.schema';

interface ProfileFormProps {
  values: ProfileFormValues | null;
  notice: string | null;
  onSave: (body: UpdateProfileRequest) => Promise<void>;
}

const SENIORITY_OPTIONS = [{ value: '', label: 'Not set' }, ...Object.values(SeniorityLevel).map((level) => ({ value: level as string, label: seniorityLabel(level) }))];

/** Profile fields except cities, which the location picker saves on its own. */
export function ProfileForm({ values, notice, onSave }: ProfileFormProps) {
  const form = useForm<ProfileFormValues>({ resolver: yupResolver(profileSchema), defaultValues: emptyProfileForm() });
  useEffect(() => {
    if (values !== null) form.reset(values);
  }, [values, form]);
  const formats = form.watch('preferredWorkFormat');
  const employment = form.watch('preferredEmployment');
  const seniority = form.watch('seniority');
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((next) => void onSave(toProfileRequest(next)))}>
      <TextField label="Headline" {...form.register('headline')} />
      <TextArea label="About" {...form.register('about')} />
      <Select label="Seniority" value={seniority} options={SENIORITY_OPTIONS} onChange={(next) => form.setValue('seniority', next as ProfileFormValues['seniority'], { shouldValidate: true })} />
      <TextField label="Desired roles" placeholder="QA, Python" {...form.register('desiredRoles')} />
      <Checks legend="Work format" options={Object.values(WorkFormat)} labelOf={workFormatLabel} selected={formats} onChange={(next) => form.setValue('preferredWorkFormat', next)} />
      <Checks legend="Employment" options={Object.values(EmploymentType)} labelOf={employmentLabel} selected={employment} onChange={(next) => form.setValue('preferredEmployment', next)} />
      <TextField label="Minimum salary" inputMode="decimal" {...form.register('salaryExpectationMin')} />
      <TextField label="Currency" maxLength={3} {...form.register('currency')} />
      <TextArea label="Education" {...form.register('education')} />
      {form.formState.errors.seniority !== undefined ? <AlertText>Choose a seniority from the list</AlertText> : null}
      {form.formState.errors.salaryExpectationMin !== undefined ? <AlertText>{form.formState.errors.salaryExpectationMin.message}</AlertText> : null}
      {notice !== null ? <p role="status" className="motion-fade text-sm text-ink-secondary">{notice}</p> : null}
      <Button type="submit">Save profile</Button>
    </form>
  );
}

function Checks<T extends string>({ legend, options, labelOf, selected, onChange }: { legend: string; options: readonly T[]; labelOf: (option: T) => string; selected: readonly T[]; onChange: (next: T[]) => void }) {
  return (
    <fieldset>
      <legend className="text-sm text-ink-secondary">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-4">
        {options.map((option) => (
          <Checkbox key={option} checked={selected.includes(option)} onChange={() => onChange(toggle(selected, option))}>{labelOf(option)}</Checkbox>
        ))}
      </div>
    </fieldset>
  );
}

function toggle<T extends string>(selected: readonly T[], option: T): T[] {
  if (selected.includes(option)) return selected.filter((item) => item !== option);
  return [...selected, option];
}
