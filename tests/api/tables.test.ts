import { describe, expect, it } from "vitest";
import {
  MAX_PLAYERS_PER_TABLE,
  getNextAvailableTable,
  pickAvailableTable,
  tableForIndex,
} from "@/lib/tables";
import { createGame, createGuests, createUser } from "../support/factories";

describe("table helpers", () => {
  it("caps tables at 9 players", () => {
    expect(MAX_PLAYERS_PER_TABLE).toBe(9);
  });

  it.each([
    [0, 1],
    [8, 1],
    [9, 2],
    [17, 2],
    [18, 3],
  ])("seat index %i goes to table %i", (index, table) => {
    expect(tableForIndex(index)).toBe(table);
  });

  it("picks the first table with room", () => {
    expect(pickAvailableTable(new Map())).toBe(1);
    expect(pickAvailableTable(new Map([[1, 9]]))).toBe(2);
    expect(pickAvailableTable(new Map([[1, 9], [2, 4]]))).toBe(2);
    expect(pickAvailableTable(new Map([[1, 3], [2, 9]]))).toBe(1);
    expect(pickAvailableTable(new Map([[1, 9], [2, 9]]))).toBe(3);
  });

  it("looks up a real game's occupancy (getNextAvailableTable)", async () => {
    const banker = await createUser();
    const nine = await createGuests(banker, 9);
    const { game } = await createGame({
      creator: banker,
      seats: nine.map((guest) => ({ guest, table: 1 })),
    });
    expect(await getNextAvailableTable(game.id)).toBe(2);

    const empty = await createGame({ creator: banker });
    expect(await getNextAvailableTable(empty.game.id)).toBe(1);
  });
});
