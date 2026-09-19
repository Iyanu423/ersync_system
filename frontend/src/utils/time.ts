/**
 * The API stores UTC timestamps without a timezone suffix ("2026-09-19T10:15:00").
 * `new Date()` would read those as local time (wrong by an hour in Lagos), so tag them as UTC first.
 */
export function parseUtc(value: string | number | Date | undefined | null): Date {
  if (value === undefined || value === null || value === '') return new Date();
  if (value instanceof Date || typeof value === 'number') return new Date(value);
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

export const clockTime = (value: string | number | Date | undefined | null) => parseUtc(value).toLocaleTimeString();
