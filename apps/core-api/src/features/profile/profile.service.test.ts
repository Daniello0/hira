import { describe, expect, it } from 'vitest';
import { ProfileSkillSource, SkillLevel } from '@hira/contracts';
import { MemoryProfileStore } from './memory-profile.store';
import { ProfileService } from './profile.service';

const USER = '5f0c9f1e-3c1a-4c0e-9a59-2f5e6a1b7c01';
const DOCUMENT = '0b6f4f5e-6d1e-4d7a-8c3a-1e2d3c4b5a69';

describe('ProfileService.offerResume', () => {
  it('offers only the skills that are not on the profile yet', async () => {
    const store = new MemoryProfileStore();
    store.skillHits.set('python', [{ skillId: 4, exactName: true, exactAlias: false, trigram: 1 }]);
    store.skillHits.set('sql', [{ skillId: 9, exactName: true, exactAlias: false, trigram: 1 }]);
    await store.insertSkill(USER, { skillId: 4, canonicalName: 'Python', level: SkillLevel.Confident, years: 2, source: ProfileSkillSource.ExtractedFromResume, confidence: 1 });
    const service = new ProfileService(store);

    await service.offerResume(USER, DOCUMENT, [
      { surface: 'Python', level: SkillLevel.Confident, years: 2 },
      { surface: 'SQL', level: null, years: null },
    ], []);

    expect(store.suggestions.map((item) => item.payload.skillId)).toEqual([9]);
  });
});
