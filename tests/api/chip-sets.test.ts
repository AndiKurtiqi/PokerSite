import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/chip-sets/route";
import { prisma } from "@/lib/prisma";
import { createChipSet, createUser, jsonRequest, num, read, signInAs } from "../support/factories";

describe("POST /api/chip-sets", () => {
  it("creates a chip set with its denominations", async () => {
    const me = await createUser();
    signInAs(me);

    const { status, body } = await read(
      await POST(
        jsonRequest("POST", {
          name: "Home set",
          denominations: [
            { value: 0.25, quantity: 100 },
            { value: 5, quantity: 20 },
          ],
        })
      )
    );
    expect(status).toBe(200);
    expect(body.chipSet.name).toBe("Home set");

    const saved = await prisma.chipSet.findUniqueOrThrow({
      where: { id: body.chipSet.id },
      include: { denominations: true },
    });
    expect(saved.ownerId).toBe(me.id);
    expect(saved.denominations.map((d) => [num(d.value), d.quantity]).sort()).toEqual([
      [0.25, 100],
      [5, 20],
    ]);
  });

  it.each([
    ["no denominations", { name: "x", denominations: [] }],
    ["a zero-value chip", { name: "x", denominations: [{ value: 0, quantity: 1 }] }],
    ["a negative quantity", { name: "x", denominations: [{ value: 1, quantity: -1 }] }],
    ["a fractional quantity", { name: "x", denominations: [{ value: 1, quantity: 1.5 }] }],
    ["an empty name", { name: "", denominations: [{ value: 1, quantity: 1 }] }],
  ])("rejects %s", async (_label, payload) => {
    const me = await createUser();
    signInAs(me);
    expect((await POST(jsonRequest("POST", payload))).status).toBe(400);
    expect(await prisma.chipSet.count()).toBe(0);
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await POST(jsonRequest("POST", { name: "x", denominations: [{ value: 1, quantity: 1 }] }))).status).toBe(401);
  });
});

describe("GET /api/chip-sets", () => {
  it("lists only the caller's chip sets, denominations sorted ascending", async () => {
    const me = await createUser();
    const other = await createUser();
    await createChipSet(me, [
      { value: 5, quantity: 10 },
      { value: 0.25, quantity: 10 },
      { value: 1, quantity: 10 },
    ]);
    await createChipSet(other, [{ value: 100, quantity: 1 }], "Not mine");
    signInAs(me);

    const { status, body } = await read(await GET());
    expect(status).toBe(200);
    expect(body.chipSets).toHaveLength(1);
    expect(body.chipSets[0].denominations.map((d: { value: string }) => num(d.value))).toEqual([0.25, 1, 5]);
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await GET()).status).toBe(401);
  });
});
