const RABOTA_ARCHIVED_MARK = 'data-qa="vacancy-title-archived-text"';

/** True when the source page itself says the posting is archived. */
export function isArchivedVacancy(html: string): boolean {
  return html.includes(RABOTA_ARCHIVED_MARK) || /"archived"\s*:\s*true/.test(html);
}
