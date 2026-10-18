import * as yup from 'yup';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './auth.constants';

/** Login fields. A short password never leaves the browser. */
export const loginSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH).required(),
});

/** Register fields. Display name is optional. */
export const registerSchema = loginSchema.shape({
  displayName: yup.string().max(128).optional(),
});
