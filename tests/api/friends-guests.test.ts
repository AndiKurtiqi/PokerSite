import { describe, expect, it } from "vitest";
import { POST as addFriend } from "@/app/api/friends/route";
import { POST as createGuest } from "@/app/api/guests/route";
import { prisma } from "@/lib/prisma";
import { createUser, jsonRequest, read, signInAs } from "../support/factories";

describe("POST /api/friends", () => {
  it("creates the friendship in both directions at once", async () => {
    const me = await createUser();
    const them = await createUser();
    signInAs(me);

    expect((await addFriend(jsonRequest("POST", { friendId: them.id }))).status).toBe(200);

    const rows = await prisma.friendship.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.ownerId === me.id && r.friendId === them.id)).toBe(true);
    expect(rows.some((r) => r.ownerId === them.id && r.friendId === me.id)).toBe(true);
  });

  it("is idempotent when the friendship already exists", async () => {
    const me = await createUser();
    const them = await createUser();
    signInAs(me);

    await addFriend(jsonRequest("POST", { friendId: them.id }));
    expect((await addFriend(jsonRequest("POST", { friendId: them.id }))).status).toBe(200);
    expect(await prisma.friendship.count()).toBe(2);
  });

  it("can't friend yourself", async () => {
    const me = await createUser();
    signInAs(me);

    const { status, body } = await read(await addFriend(jsonRequest("POST", { friendId: me.id })));
    expect(status).toBe(400);
    expect(body.error).toMatch(/yourself/i);
    expect(await prisma.friendship.count()).toBe(0);
  });

  it("404s for a user that doesn't exist", async () => {
    const me = await createUser();
    signInAs(me);
    expect((await addFriend(jsonRequest("POST", { friendId: "nope" }))).status).toBe(404);
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await addFriend(jsonRequest("POST", { friendId: "x" }))).status).toBe(401);
  });
});

describe("POST /api/guests", () => {
  it("creates a guest owned by the caller", async () => {
    const me = await createUser();
    signInAs(me);

    const { status, body } = await read(await createGuest(jsonRequest("POST", { name: "Mike" })));
    expect(status).toBe(200);
    expect(body.guest.name).toBe("Mike");

    const saved = await prisma.guest.findUniqueOrThrow({ where: { id: body.guest.id } });
    expect(saved.createdById).toBe(me.id);
    expect(saved.mergedIntoId).toBeNull();
  });

  it("allows two guests with the same name (they're separate identities)", async () => {
    const me = await createUser();
    signInAs(me);
    await createGuest(jsonRequest("POST", { name: "Mike" }));
    await createGuest(jsonRequest("POST", { name: "Mike" }));
    expect(await prisma.guest.count()).toBe(2);
  });

  it.each([[""], ["x".repeat(51)]])("rejects an invalid name (%#)", async (name) => {
    const me = await createUser();
    signInAs(me);
    expect((await createGuest(jsonRequest("POST", { name }))).status).toBe(400);
    expect(await prisma.guest.count()).toBe(0);
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await createGuest(jsonRequest("POST", { name: "Mike" }))).status).toBe(401);
  });
});
