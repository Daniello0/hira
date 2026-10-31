import { useSuggestions } from '../suggestions/suggestion.store';
import { uploadResume } from './library-api';

/** Uploads a resume PDF and opens the checklist of what was found. Returns an error message or `null`. */
export async function uploadAndOffer(file: File): Promise<string | null> {
  const message = await uploadResume(file).catch(() => 'Could not reach Hira');
  if (message !== null) return message;
  await useSuggestions.getState().reload();
  useSuggestions.getState().setResumeBatch(true);
  return null;
}
