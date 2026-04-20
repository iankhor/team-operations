import { describe, expect, test } from "bun:test";
import { rotate } from "./rotation.js";

const roster = [
  { name: "Ian Khor", upn: "KhorI@redcat.com.au" },
  { name: "Juelv Cayago", upn: "CayagoJ@redcat.com.au" },
];

describe("rotate", () => {
  test("first run picks index 0 with null previous", () => {
    const result = rotate(
      { champions: roster, last_champion: null, last_rotated_at: null },
      new Date("2026-04-20T00:00:00Z"),
    );
    expect(result.shouldPost).toBe(true);
    expect(result.previousChampion).toBeNull();
    expect(result.nextChampion.name).toBe("Ian Khor");
    expect(result.periodStart).toBe("2026-04-20");
    expect(result.periodEnd).toBe("2026-05-03");
    expect(result.newState).toEqual({
      last_champion: "Ian Khor",
      last_rotated_at: "2026-04-20",
    });
  });

  test("picks the next champion when last is known", () => {
    const result = rotate(
      {
        champions: roster,
        last_champion: "Ian Khor",
        last_rotated_at: "2026-04-20",
      },
      new Date("2026-05-04T00:00:00Z"),
    );
    expect(result.shouldPost).toBe(true);
    expect(result.previousChampion.name).toBe("Ian Khor");
    expect(result.nextChampion.name).toBe("Juelv Cayago");
  });

  test("wraps to index 0 at the end of the roster", () => {
    const result = rotate(
      {
        champions: roster,
        last_champion: "Juelv Cayago",
        last_rotated_at: "2026-05-04",
      },
      new Date("2026-05-18T00:00:00Z"),
    );
    expect(result.previousChampion.name).toBe("Juelv Cayago");
    expect(result.nextChampion.name).toBe("Ian Khor");
  });

  test("no-op if less than 14 days since last rotation", () => {
    const result = rotate(
      {
        champions: roster,
        last_champion: "Ian Khor",
        last_rotated_at: "2026-04-20",
      },
      new Date("2026-04-28T00:00:00Z"),
    );
    expect(result.shouldPost).toBe(false);
    expect(result.reason).toMatch(/8 day/);
  });

  test("--force overrides the 14-day gate", () => {
    const result = rotate(
      {
        champions: roster,
        last_champion: "Ian Khor",
        last_rotated_at: "2026-04-20",
      },
      new Date("2026-04-28T00:00:00Z"),
      { force: true },
    );
    expect(result.shouldPost).toBe(true);
    expect(result.nextChampion.name).toBe("Juelv Cayago");
  });

  test("treats unknown last_champion as a first run", () => {
    const result = rotate(
      {
        champions: roster,
        last_champion: "Left The Team",
        last_rotated_at: null,
      },
      new Date("2026-05-04T00:00:00Z"),
    );
    expect(result.previousChampion).toBeNull();
    expect(result.nextChampion.name).toBe("Ian Khor");
  });

  test("throws if roster is empty", () => {
    expect(() =>
      rotate(
        { champions: [], last_champion: null, last_rotated_at: null },
        new Date(),
      ),
    ).toThrow(/no champions/);
  });
});
