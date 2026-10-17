import { SkillImportance, SkillType } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { requestExtractedSkills } from './extract-client';

const vacancy = {
  id: 'v1',
  title: 'Backend',
  description: 'нужен Python',
};

describe('requestExtractedSkills', () => {
  it('posts one vacancy and reads the skill list', async () => {
    const seen: Array<{ url: string; token: string; body: unknown }> = [];
    const skills = await requestExtractedSkills(
      {
        post: async (url, token, body) => {
          seen.push({ url, token, body });
          return {
            status: 200,
            body: {
              results: [
                {
                  id: 'v1',
                  skills: [
                    {
                      surface: 'Python',
                      skillType: SkillType.Language,
                      importance: SkillImportance.Mentioned,
                      evidenceSpan: 'Python',
                      weight: 0.4,
                    },
                  ],
                },
              ],
            },
          };
        },
      },
      'http://llm-service:4002/',
      'secret',
      vacancy,
    );
    expect(seen).toEqual([
      {
        url: 'http://llm-service:4002/internal/v1/extract-skills',
        token: 'secret',
        body: { vacancies: [vacancy] },
      },
    ]);
    expect(skills[0]).toMatchObject({ skillType: SkillType.Language, weight: 0.4 });
  });

  it('throws on a failed status and on a skill that breaks the contract', async () => {
    await expect(
      requestExtractedSkills(
        fixed(422, { errorCode: 'LLM_INVALID_OUTPUT' }),
        'http://llm',
        't',
        vacancy,
      ),
    ).rejects.toThrow(/LLM_INVALID_OUTPUT/);
    await expect(
      requestExtractedSkills(
        fixed(200, { results: [{ id: 'v1', skills: [{ surface: 'Python' }] }] }),
        'http://llm',
        't',
        vacancy,
      ),
    ).rejects.toThrow();
  });
});

function fixed(status: number, body: unknown) {
  return {
    post: async () => ({ status, body }),
  };
}
