const PERIOD_LENGTH_DAYS = 14;

export function rotate(state, today, { force = false } = {}) {
  const { champions, last_champion, last_rotated_at } = state;

  if (!Array.isArray(champions) || champions.length === 0) {
    throw new Error("champions.yml has no champions");
  }

  if (!force && last_rotated_at) {
    const daysSince = daysBetween(last_rotated_at, today);
    if (daysSince < PERIOD_LENGTH_DAYS) {
      return {
        shouldPost: false,
        reason: `Last rotated ${daysSince} day(s) ago; need ${PERIOD_LENGTH_DAYS}.`,
      };
    }
  }

  const lastIndex = last_champion
    ? champions.findIndex((c) => c.name === last_champion)
    : -1;

  const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % champions.length;
  const previousChampion = lastIndex === -1 ? null : champions[lastIndex];
  const nextChampion = champions[nextIndex];

  const periodStart = toISODate(today);
  const periodEnd = toISODate(addDays(today, PERIOD_LENGTH_DAYS - 1));

  return {
    shouldPost: true,
    previousChampion,
    nextChampion,
    periodStart,
    periodEnd,
    newState: {
      last_champion: nextChampion.name,
      last_rotated_at: periodStart,
    },
  };
}

function daysBetween(fromISO, to) {
  const ms = asDate(to).getTime() - asDate(fromISO).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function asDate(d) {
  return d instanceof Date ? d : new Date(d);
}

function addDays(d, n) {
  const r = new Date(asDate(d));
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function toISODate(d) {
  return asDate(d).toISOString().slice(0, 10);
}
