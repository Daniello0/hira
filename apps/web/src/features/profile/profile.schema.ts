import {
  EmploymentType,
  SeniorityLevel,
  WorkFormat,
  type ProfileDto,
  type UpdateProfileRequest,
} from '@hira/contracts';
import * as yup from 'yup';

export interface ProfileFormValues {
  headline: string;
  about: string;
  seniority: string;
  desiredRoles: string;
  preferredWorkFormat: WorkFormat[];
  preferredEmployment: EmploymentType[];
  salaryExpectationMin: string;
  currency: string;
  education: string;
}

const seniorityValues = ['', ...Object.values(SeniorityLevel)];

/** Profile form. City ids stay on the server until a location picker exists. */
export const profileSchema: yup.ObjectSchema<ProfileFormValues> = yup.object({
  headline: yup.string().max(256).defined(),
  about: yup.string().defined(),
  seniority: yup.string().oneOf(seniorityValues).defined(),
  desiredRoles: yup.string().defined(),
  preferredWorkFormat: yup.array(yup.string().oneOf(Object.values(WorkFormat)).required()).defined(),
  preferredEmployment: yup.array(yup.string().oneOf(Object.values(EmploymentType)).required()).defined(),
  salaryExpectationMin: yup.string().defined().test('amount', 'Enter a number', (value) => amountOk(value)),
  currency: yup.string().max(3).defined(),
  education: yup.string().defined(),
});

/** Empty form before `GET /profile` returns. */
export function emptyProfileForm(): ProfileFormValues {
  return {
    headline: '',
    about: '',
    seniority: '',
    desiredRoles: '',
    preferredWorkFormat: [],
    preferredEmployment: [],
    salaryExpectationMin: '',
    currency: '',
    education: '',
  };
}

/** Copies a profile into the form. Locations are not edited here. */
export function profileFormValues(profile: ProfileDto): ProfileFormValues {
  return {
    headline: profile.headline ?? '',
    about: profile.about ?? '',
    seniority: profile.seniority ?? '',
    desiredRoles: profile.desiredRoles.join(', '),
    preferredWorkFormat: [...profile.preferredWorkFormat],
    preferredEmployment: [...profile.preferredEmployment],
    salaryExpectationMin: profile.salaryExpectationMin === null ? '' : String(profile.salaryExpectationMin),
    currency: profile.currency ?? '',
    education: profile.education ?? '',
  };
}

/** Body of `PUT /profile`. Blank text becomes null. Locations are left untouched. */
export function toProfileRequest(values: ProfileFormValues): UpdateProfileRequest {
  return {
    headline: emptyToNull(values.headline),
    about: emptyToNull(values.about),
    seniority: values.seniority === '' ? null : (values.seniority as SeniorityLevel),
    desiredRoles: splitList(values.desiredRoles),
    preferredWorkFormat: values.preferredWorkFormat,
    preferredEmployment: values.preferredEmployment,
    salaryExpectationMin: values.salaryExpectationMin.trim() === '' ? null : Number(values.salaryExpectationMin),
    currency: emptyToNull(values.currency),
    education: emptyToNull(values.education),
  };
}

function amountOk(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') return true;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function splitList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}
