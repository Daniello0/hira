import { describe, expect, it } from 'vitest';
import { parseSalaryText } from './parse-salary';

describe('parseSalaryText', () => {
  it('reads a BYN range with a dash and the word руб', () => {
    expect(parseSalaryText('1150 – 1450 руб.')).toEqual({
      min: 1150,
      max: 1450,
      currency: 'BYN',
      gross: null,
    });
  });

  it('reads a single ruble amount and a comma decimal', () => {
    expect(parseSalaryText('45 000 ₽')).toEqual({
      min: 45000,
      max: 45000,
      currency: 'RUB',
      gross: null,
    });
    expect(parseSalaryText('1380,00–1650,00 руб.')).toEqual({
      min: 1380,
      max: 1650,
      currency: 'BYN',
      gross: null,
    });
  });

  it('reads an open minimum in a named currency', () => {
    expect(parseSalaryText('от 1500 BYN')).toEqual({
      min: 1500,
      max: null,
      currency: 'BYN',
      gross: null,
    });
  });

  it('returns empty pay when the source did not state a number', () => {
    expect(parseSalaryText('по договорённости')).toEqual({
      min: null,
      max: null,
      currency: null,
      gross: null,
    });
    expect(parseSalaryText('Зарплата не указана')).toEqual({
      min: null,
      max: null,
      currency: null,
      gross: null,
    });
    expect(parseSalaryText(null)).toEqual({
      min: null,
      max: null,
      currency: null,
      gross: null,
    });
  });
});
