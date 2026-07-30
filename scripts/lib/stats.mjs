// 尾隨小數點係真實資料入面出現過嘅（"+55.%"），所以小數部分容許空。
const STAT_LINE = /^(.+?)\s*([+-])\s*([0-9]+(?:\.[0-9]*)?)\s*(%?)$/;

export function parseStatLine(text) {
  const match = STAT_LINE.exec(String(text).trim());
  if (!match) return null;
  const [, rawName, sign, digits, unit] = match;
  const value = Number(digits.endsWith('.') ? digits.slice(0, -1) : digits);
  if (!Number.isFinite(value)) return null;
  const name = rawName.trim();
  if (!name) return null;
  return { name, value: sign === '-' ? -value : value, unit };
}

export function summariseStats(members) {
  const totals = new Map();
  const others = [];
  const seenOther = new Set();

  for (const member of members) {
    for (const [text, colour] of member.stats ?? []) {
      const parsed = parseStatLine(text);
      if (!parsed) {
        if (!seenOther.has(text)) {
          seenOther.add(text);
          others.push({ text, colour });
        }
        continue;
      }
      const key = `${parsed.name} ${parsed.unit}`;
      const entry = totals.get(key);
      if (entry) entry.value += parsed.value;
      else totals.set(key, { name: parsed.name, unit: parsed.unit, value: parsed.value, colour });
    }
  }

  const rounded = [...totals.values()].map((entry) => ({
    ...entry,
    value: Math.round(entry.value * 100) / 100,
  }));
  rounded.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return { totals: rounded, others };
}
