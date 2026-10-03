/**
 * Employment type of a vacancy.
 * `FULL_TIME` and `PART_TIME` name «полная» and «частичная занятость».
 * `PROJECT` and `FREELANCE` are the identifiers in Wiki/03-data-sources.md.
 */
export enum EmploymentType {
  FullTime = 'FULL_TIME',
  PartTime = 'PART_TIME',
  Project = 'PROJECT',
  Freelance = 'FREELANCE',
}
