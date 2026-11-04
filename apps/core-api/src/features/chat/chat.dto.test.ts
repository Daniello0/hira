import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateMessageBodyDto } from './chat.dto';

const FILE = { name: 'cv.pdf', text: 'Опыт работы' };

async function problems(body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateMessageBodyDto, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property);
}

describe('CreateMessageBodyDto', () => {
  it('takes words, files, or both', async () => {
    expect(await problems({ content: 'Python jobs' })).toEqual([]);
    expect(await problems({ content: '', attachments: [FILE] })).toEqual([]);
    expect(await problems({ content: 'Read this', attachments: [FILE] })).toEqual([]);
  });

  it('wants words when there are no files', async () => {
    expect(await problems({ content: '   ' })).toEqual(['content']);
    expect(await problems({ content: '', attachments: [] })).toEqual(['content']);
  });

  it('still checks the words beside files', async () => {
    expect(await problems({ attachments: [FILE] })).toEqual(['content']);
    expect(await problems({ content: 42, attachments: [FILE] })).toEqual(['content']);
    expect(await problems({ content: 'x'.repeat(4_001), attachments: [FILE] })).toEqual(['content']);
  });
});
