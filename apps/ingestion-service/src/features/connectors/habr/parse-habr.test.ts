import { describe, expect, it } from 'vitest';
import { parseHabrList, parseHabrVacancy } from './parse-habr';

const LIST = `
<div class="vacancy-card vacancy-card--bp">
  <a class="vacancy-card__title-link" href="/vacancies/1000161368">Координатор заявок</a>
  <div class="vacancy-card__company"><a class="link-comp link-comp--appearance-dark" href="/companies/holdingt1">ИТ-Холдинг Т1</a></div>
  <div class="basic-salary">45 000 ₽</div>
  <div class="chip-with-icon__text">Senior</div>
  <svg class="svg-icon svg-icon--icon-placemark"></svg>
  <div class="chip-with-icon__text">Самара</div>
</div>
<div class="vacancy-card">
  <a class="vacancy-card__title-link" href="/vacancies/1000157161/responses">Скрытый отклик</a>
</div>
`;

const DETAIL = `
<h1 class="page-title__title">Координатор заявок</h1>
<div class="vacancy-company__title"><a class="basic-avatar" href="/companies/holdingt1"><img alt="logo" /></a><a class="link-comp link-comp--appearance-dark" href="/companies/holdingt1">ИТ-Холдинг Т1</a></div>
<div class="vacancy-header__salary"><div class="basic-salary">от 2 000 USD</div></div>
<div class="vacancy-description__text"><div class="style-ugc"><p>Звонить клиентам</p></div></div>
`;

describe('Habr Career parser', () => {
  it('reads a vacancy card and skips a responses link', () => {
    expect(parseHabrList(LIST)).toEqual([
      {
        externalId: '1000161368',
        title: 'Координатор заявок',
        companyName: 'ИТ-Холдинг Т1',
        salaryText: '45 000 ₽',
        city: 'Самара',
      },
    ]);
  });

  it('reads the description and leaves a foreign city without a Belarus region', () => {
    const vacancy = parseHabrVacancy(DETAIL, '1000161368');
    expect(vacancy.companyName).toBe('ИТ-Холдинг Т1');
    expect(vacancy.descriptionHtml).toContain('Звонить клиентам');
    expect(vacancy.salaryMin).toBe(2000);
    expect(vacancy.salaryCurrency).toBe('USD');
    expect(vacancy.city).toBeNull();
    expect(vacancy.region).toBeNull();
    expect(vacancy.url).toBe('https://career.habr.com/vacancies/1000161368');
  });

  it('reads the city chip and an explicit archive flag without inventing a region', () => {
    const html = `${DETAIL}<svg class="svg-icon svg-icon--icon-placemark"></svg><div class="chip-with-icon__text">Самара</div>"archived":true`;
    const vacancy = parseHabrVacancy(html, '1000161368');
    expect(vacancy.city).toBe('Самара');
    expect(vacancy.region).toBeNull();
    expect(vacancy.archived).toBe(true);
  });

  it('rejects a detail page that has no description block', () => {
    expect(() => parseHabrVacancy('<h1 class="page-title__title">Пусто</h1>', '1')).toThrow(
      /description/i,
    );
  });
});
