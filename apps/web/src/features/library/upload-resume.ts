import { ProfileSkillSource } from '@hira/contracts';
import { useSuggestions } from '../suggestions/suggestion.store';
import { uploadResume, type ResumeUpload } from './library-api';

export const RESUME_NOT_READ = 'The resume is saved, but Hira could not read it. Try uploading it again.';
export const RESUME_NOTHING_NEW = 'The resume is saved. Hira found nothing new for your profile in it.';

/**
 * Uploads a resume PDF and opens the checklist of what was found. Returns what to tell the user instead:
 * an error, a parse that failed, or a resume with nothing new. `null` when the checklist opened.
 */
export async function uploadAndOffer(file: File): Promise<string | null> {
  const outcome = await uploadResume(file).catch((): ResumeUpload => ({ kind: 'failed', message: 'Could not reach Hira' }));
  if (outcome.kind === 'failed') return outcome.message;
  if (!outcome.parsed) return RESUME_NOT_READ;
  const offers = useSuggestions.getState();
  await offers.reload();
  // Without offers from the resume the checklist would not open, and the flag would only hold back the offers from chats.
  if (!useSuggestions.getState().items.some((item) => item.source === ProfileSkillSource.ExtractedFromResume)) return RESUME_NOTHING_NEW;
  offers.setResumeBatch(true);
  return null;
}
