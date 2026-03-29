function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toDateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function diffInDays(referenceDate: string, targetDate: string): number {
  const reference = parseDateOnly(referenceDate).getTime();
  const target = parseDateOnly(targetDate).getTime();
  return Math.floor((reference - target) / 86400000);
}
