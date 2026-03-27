export function parseWclUrl(input: string): {
  code: string | null;
  fight: number | null;
  source: number | null;
} {
  const urlMatch = input.match(/reports\/([a-zA-Z0-9]+)/);
  const code = urlMatch
    ? urlMatch[1]
    : /^[a-zA-Z0-9]+$/.test(input.trim())
      ? input.trim()
      : null;

  let fight: number | null = null;
  let source: number | null = null;

  if (code) {
    try {
      const url = new URL(input);
      const fightParam = url.searchParams.get("fight");
      const sourceParam = url.searchParams.get("source");
      if (fightParam) fight = Number(fightParam);
      if (sourceParam) source = Number(sourceParam);
    } catch { /* not a URL */ }
  }

  return { code, fight, source };
}
