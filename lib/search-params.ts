export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const item of Array.isArray(v) ? v : v ? [v] : []) params.append(k, item);
  return params;
}
