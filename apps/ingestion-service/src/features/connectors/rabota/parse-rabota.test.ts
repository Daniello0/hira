import { describe, expect, it } from 'vitest';
import { parseRabotaList, parseRabotaVacancy } from './parse-rabota';

const LIST = `
<article data-qa="vacancy-serp__vacancy">
  <a data-qa="serp-item__title" href="https://rabota.by/vacancy/138273374?hhtmFrom=vacancy_search_list">
    <span data-qa="serp-item__title-text">Специалист<span class="premium"><svg></svg></span></span>
  </a>
  <a data-qa="vacancy-serp__vacancy-employer" href="/employer/1?hhtmFrom=vacancy_search_list">
    <span data-qa="vacancy-serp__vacancy-employer-text">УП <!-- -->Минское агентство</span>
  </a>
  <span data-qa="vacancy-serp__vacancy-address">Минск, улица Богдановича, 153</span>
</article>
<article data-qa="vacancy-serp__vacancy vacancy-serp-item_clickme">
  <a data-qa="serp-item__title" href="https://rabota.by/vacancy/1">Реклама</a>
</article>
`;

const DETAIL = `
<h1 data-qa="vacancy-title" class="bloko-header-section-1">Специалист</h1>
<div data-qa="vacancy-salary"><span data-qa="vacancy-salary-compensation-type-net">от <data value="3000">3 000</data> <data value="BYN">Br</data> за месяц<span> на руки</span></span></div>
<a data-qa="vacancy-company-name" href="/employer/1"><span>УП <!-- -->Минское агентство</span></a>
<span data-qa="vacancy-experience">не требуется</span>
<div data-qa="common-employment-text"><span>Полная занятость</span></div>
<div data-qa="work-formats-text">Формат работы: на месте работодателя</div>
<div data-qa="work-schedule-by-days-text">График: 5/2</div>
<div data-qa="vacancy-description"><p>Освещение</p><div><p>ещё</p></div></div>
<span data-qa="vacancy-view-raw-address">Минск, улица Богдановича, 153</span>
`;

describe('rabota.by parser', () => {
  it('reads a search card and skips a promoted card', () => {
    expect(parseRabotaList(LIST)).toEqual([
      {
        externalId: '138273374',
        path: '/vacancy/138273374',
        title: 'Специалист',
        companyName: 'УП Минское агентство',
        address: 'Минск, улица Богдановича, 153',
      },
    ]);
  });

  it('reads the public vacancy page', () => {
    const vacancy = parseRabotaVacancy(DETAIL, '138273374');
    expect(vacancy.title).toBe('Специалист');
    expect(vacancy.companyName).toBe('УП Минское агентство');
    expect(vacancy.city).toBe('Минск');
    expect(vacancy.salaryMin).toBe(3000);
    expect(vacancy.salaryMax).toBeNull();
    expect(vacancy.salaryCurrency).toBe('BYN');
    expect(vacancy.isGross).toBe(false);
    expect(vacancy.seniorityRaw).toBe('не требуется');
    expect(vacancy.employmentRaw).toContain('Полная занятость');
    expect(vacancy.workFormatRaw).toContain('на месте');
    expect(vacancy.schedule).toContain('5/2');
    expect(vacancy.descriptionHtml).toContain('Освещение');
    expect(vacancy.descriptionHtml).toContain('ещё');
    expect(vacancy.url).toBe('https://rabota.by/vacancy/138273374');
    expect(vacancy.archived).toBe(false);
  });

  it('rejects a detail page without a title', () => {
    expect(() => parseRabotaVacancy('<div>пусто</div>', '1')).toThrow(/title/i);
  });
});
