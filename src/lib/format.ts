/** Formats a year where negative numbers are BCE, e.g. -470 -> "470 BCE". */
export function formatYear(year: number, circa = false, forceEra = false): string {
  const prefix = circa ? 'c. ' : '';
  if (year < 0) return `${prefix}${Math.abs(year)} BCE`;
  return `${prefix}${year}${forceEra ? ' CE' : ''}`;
}

interface Lifespan {
  born: number;
  died: number;
  bornCirca?: boolean;
  diedCirca?: boolean;
}

/**
 * Formats a lifespan compactly:
 *   c. 470 – 399 BCE   (both BCE: era written once)
 *   c. 4 BCE – 65 CE   (crosses eras: both written)
 *   1596 – 1650        (both CE: no era needed)
 */
export function formatLifespan({ born, died, bornCirca = false, diedCirca = false }: Lifespan): string {
  const dash = ' – ';
  if (born < 0 && died < 0) {
    const start = `${bornCirca ? 'c. ' : ''}${Math.abs(born)}`;
    return `${start}${dash}${formatYear(died, diedCirca)}`;
  }
  if (born < 0) {
    return `${formatYear(born, bornCirca)}${dash}${formatYear(died, diedCirca, true)}`;
  }
  // Ancient CE figures read better with an explicit era.
  const forceEra = born < 500;
  return `${formatYear(born, bornCirca, forceEra)}${dash}${formatYear(died, diedCirca, forceEra)}`;
}

/** The century containing a year, e.g. -470 -> "5th c. BCE", 1986 -> "20th c.". */
export function formatCentury(year: number): string {
  const n = year < 0 ? Math.ceil(-year / 100) : Math.ceil(year / 100);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix} c.${year < 0 ? ' BCE' : ''}`;
}
