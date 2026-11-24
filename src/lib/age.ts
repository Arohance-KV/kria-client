/** Youngest age that can hold an account; 13 to 17 need a parent or guardian to agree (LAUNCH-AUDIT H26). */
export const MIN_AGE = 13;

/** Whole years old on `now` for a YYYY-MM-DD date of birth; NaN when there is none. */
export function ageAt(dob: string, now = new Date()): number {
    const [y, m, d] = dob.split('-').map(Number);
    if (!y || !m || !d) return NaN;
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
}

export const isMinor = (dob: string) => { const a = ageAt(dob); return a >= MIN_AGE && a < 18; };
