import { describe, expect, it } from 'vitest';
import { parseGszAddress, parseGszList, parseGszVacancy } from './parse-gsz';

const OPEN_ID = 'a82c44d4-c57c-4340-afb0-9e0f4d026c88';

const LIST = `
<div class="job-block v2 col-12">
  <h4 class="job-title">
    <a href="/registration/vacancy/${OPEN_ID}/" title="Тракторист" class="debounced-link">
      Тракторист
    </a>
  </h4>
  <ul class="job-info">
    <li><span class="salary">1150 – 1450 руб.</span></li>
    <li class="org w-100"><a href="/directory/business-entity/181591/detail/public/">Берестовицкое РУП ЖКХ</a></li>
    <li><span class="address">обл. Гродненская, р-н Берестовицкий, гп. Большая Берестовица</span></li>
  </ul>
  <a href="/registration/vacancy/${OPEN_ID}/#contact-info-anchor" class="btn btn-outline-primary">Контакты</a>
</div>
<div class="job-block v2 col-12">
  <a href="/registration/vacancy/449560/" title="Директор" class="debounced-link">
    Директор
    <span>(заместитель)</span>
  </a>
</div>
<div class="job-block v2 col-12">
  <a href="/user/recovery-password" class="debounced-link">Не вакансия</a>
</div>
<div class="job-block v2 col-12">
  <a href="/registration/employer/vacancy/449560/detail-public/?source=search" class="debounced-link">Старая ссылка</a>
</div>
`;

const DETAIL = `
<h1>Тракторист</h1>
<a href="/directory/business-entity/181591/detail/public/"><h5>ОАО &quot;Жабинковский комбикормовый завод&quot;</h5></a>
<ul class="job-overview">
  <li><h5>Заработная плата</h5><span>1380,00–1650,00 руб.</span></li>
  <li><h5>Адрес рабочего места</h5><span class="address">обл. Гродненская, р-н Берестовицкий, г. Брест</span></li>
  <li><h5>Характер работы</h5><span>Постоянная</span></li>
</ul>
`;

describe('GSZ parser', () => {
  it('keeps only public vacancy links from a search page', () => {
    const refs = parseGszList(LIST);
    expect(refs).toEqual([
      {
        externalId: OPEN_ID,
        path: `/registration/vacancy/${OPEN_ID}/`,
        title: 'Тракторист',
        companyName: 'Берестовицкое РУП ЖКХ',
        salaryText: '1150 – 1450 руб.',
        address: 'обл. Гродненская, р-н Берестовицкий, гп. Большая Берестовица',
      },
      {
        externalId: '449560',
        path: '/registration/vacancy/449560/',
        title: 'Директор (заместитель)',
        companyName: '',
        salaryText: null,
        address: null,
      },
    ]);
  });

  it('reads the detail overview and an oblast address', () => {
    const vacancy = parseGszVacancy(DETAIL, OPEN_ID);
    expect(vacancy.url).toBe(`https://gsz.gov.by/registration/vacancy/${OPEN_ID}/`);
    expect(vacancy.title).toBe('Тракторист');
    expect(vacancy.companyName).toBe('ОАО "Жабинковский комбикормовый завод"');
    expect(vacancy.salaryMin).toBe(1380);
    expect(vacancy.salaryMax).toBe(1650);
    expect(vacancy.salaryCurrency).toBe('BYN');
    expect(vacancy.region).toBe('Гродненская область');
    expect(vacancy.city).toBe('Брест');
    expect(vacancy.archived).toBe(false);
  });

  it('returns no cards from an empty page and rejects a detail without a title', () => {
    expect(parseGszList('<div>пусто</div>')).toEqual([]);
    expect(() => parseGszVacancy('<div>нет заголовка</div>', '1')).toThrow(/title/i);
  });

  it('maps a settlement address onto the seeded region name', () => {
    expect(parseGszAddress('обл. Минская, г. Борисов')).toEqual({
      region: 'Минская область',
      city: 'Борисов',
    });
    expect(parseGszAddress('г. Минск, ул. Ленина')).toEqual({ region: 'Минск', city: 'Минск' });
    expect(parseGszAddress('где-то')).toEqual({ region: null, city: null });
  });
});
