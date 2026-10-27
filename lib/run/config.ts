// Set from POPULARITY_MAX (0.995 in production). Unset means the size rule is off.
export function popularityCeiling(): number | null {
  const n = Number(process.env.POPULARITY_MAX);
  return process.env.POPULARITY_MAX && Number.isFinite(n) && n > 0 && n <= 1 ? n : null;
}
