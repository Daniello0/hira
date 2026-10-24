import { RateUnit } from '@hira/contracts';
import { isRecord } from './record';

/** The schema.org JobPosting fields the connectors use. */
export interface JobPostingLd {
  title: string | null;
  descriptionHtml: string | null;
  companyName: string | null;
  datePosted: string | null;
  employmentType: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  remote: boolean;
  pay: LdPay | null;
}

/** Salary or rate from `baseSalary`, already per month for salaries. */
export interface LdPay {
  min: number | null;
  max: number | null;
  currency: string | null;
  rateUnit: RateUnit | null;
}

const LD_SCRIPT = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
const MONTHS_PER_YEAR = 12;
const WEEKS_PER_MONTH = 52 / 12;

/** First JobPosting found in the page's JSON-LD blocks, or null. */
export function readJobPosting(html: string): JobPostingLd | null {
  for (const match of html.matchAll(LD_SCRIPT)) {
    const nodes = ldNodes(parseLd(match[1] ?? ''));
    const posting = nodes.find((node) => typeOf(node) === 'JobPosting');
    if (posting !== undefined) return toPosting(posting, nodes);
  }
  return null;
}

function parseLd(text: string): unknown {
  const body = text.replace(/^\s*\/\/\s*<!--/, '').replace(/\/\/\s*-->\s*$/, '');
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function ldNodes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(ldNodes);
  if (!isRecord(value)) return [];
  const graph = value['@graph'];
  return Array.isArray(graph) ? graph.flatMap(ldNodes) : [value];
}

function typeOf(node: Record<string, unknown>): string | null {
  const type = node['@type'];
  if (Array.isArray(type)) return type.includes('JobPosting') ? 'JobPosting' : null;
  return typeof type === 'string' ? type : null;
}

function toPosting(
  node: Record<string, unknown>,
  nodes: Array<Record<string, unknown>>,
): JobPostingLd {
  const address = addressOf(node.jobLocation);
  return {
    title: text(node.title),
    descriptionHtml: text(node.description),
    companyName: organizationName(node.hiringOrganization, nodes),
    datePosted: text(node.datePosted),
    employmentType: listText(node.employmentType),
    city: text(address?.addressLocality),
    region: text(address?.addressRegion),
    country: countryOf(address?.addressCountry),
    remote: text(node.jobLocationType)?.toUpperCase() === 'TELECOMMUTE',
    pay: payOf(node.baseSalary),
  };
}

function organizationName(value: unknown, nodes: Array<Record<string, unknown>>): string | null {
  if (!isRecord(value)) return null;
  const named = text(value.name);
  if (named !== null) return named;
  const ref = text(value['@id']);
  return text(nodes.find((node) => node['@id'] === ref)?.name);
}

function addressOf(value: unknown): Record<string, unknown> | null {
  const place = Array.isArray(value) ? value[0] : value;
  if (!isRecord(place)) return null;
  return isRecord(place.address) ? place.address : null;
}

function countryOf(value: unknown): string | null {
  if (isRecord(value)) return text(value.name);
  return text(value);
}

function payOf(value: unknown): LdPay | null {
  if (!isRecord(value) || !isRecord(value.value)) return null;
  const amount = value.value;
  const unit = text(amount.unitText)?.toUpperCase() ?? 'MONTH';
  const min = numberOf(amount.minValue) ?? numberOf(amount.value);
  const max = numberOf(amount.maxValue) ?? min;
  const currency = text(value.currency);
  const rateUnit = rateUnitOf(unit);
  if (rateUnit !== null) return { min, max, currency, rateUnit };
  const factor = monthlyFactor(unit);
  return { min: scale(min, factor), max: scale(max, factor), currency, rateUnit: null };
}

function rateUnitOf(unit: string): RateUnit | null {
  if (unit === 'HOUR') return RateUnit.Hour;
  if (unit === 'DAY') return RateUnit.Day;
  return null;
}

function monthlyFactor(unit: string): number {
  if (unit === 'YEAR') return 1 / MONTHS_PER_YEAR;
  if (unit === 'WEEK') return WEEKS_PER_MONTH;
  return 1;
}

function scale(value: number | null, factor: number): number | null {
  return value === null ? null : Math.round(value * factor);
}

function numberOf(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

function listText(value: unknown): string | null {
  if (Array.isArray(value))
    return text(value.filter((item) => typeof item === 'string').join(', '));
  return text(value);
}

function text(value: unknown): string | null {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
