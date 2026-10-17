import { describe, expect, it } from "vitest";
import { DELETE, PATCH } from "@/app/api/admin/users/[id]/route";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma/client";
import {
  createAdmin,
  createChipSet,
  createGame,
  createGuest,
  createUser,
  ctx,
  jsonRequest,
  read,
  signInAs,
} from "../support/factories";

const patch = (id: string, body: unknown) => PATCH(jsonRequest("PATCH", body), ctx({ id }));
const del = (id: string) => DELETE(jsonRequest("DELETE"), ctx({ id }));

describe("PATCH /api/admin/users/[id] — approve / reject / disable", () => {
  it("lets an admin approve a pending account", async () => {
    const admin = await createAdmin();
    const pending = await createUser({ status: "PENDING" });
    signInAs(admin);

    const { status, body } = await read(await patch(pending.id, { status: "APPROVED" }));
    expect(status).toBe(200);
    expect(body.user.status).toBe("APPROVED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("APPROVED");
  });

  it.each(["REJECTED", "DISABLED"] as const)("lets an admin set an account to %s", async (target) => {
    const admin = await createAdmin();
    const user = await createUser();
    signInAs(admin);

    expect((await patch(user.id, { status: target })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe(target);
  });

  it("can re-enable a disabled account", async () => {
    const admin = await createAdmin();
    const user = await createUser({ status: "DISABLED" });
    signInAs(admin);

    expect((await patch(user.id, { status: "APPROVED" })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("APPROVED");
  });

  it("forbids non-admins", async () => {
    const player = await createUser();
    const target = await createUser({ status: "PENDING" });
    signInAs(player);

    expect((await patch(target.id, { status: "APPROVED" })).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("PENDING");
  });

  it("forbids logged-out callers", async () => {
    const target = await createUser({ status: "PENDING" });
    signInAs(null);
    expect((await patch(target.id, { status: "APPROVED" })).status).toBe(403);
  });

  it("stops an admin changing their own status", async () => {
    const admin = await createAdmin();
    signInAs(admin);

    const { status, body } = await read(await patch(admin.id, { status: "DISABLED" }));
    expect(status).toBe(400);
    expect(body.error).toMatch(/own account/i);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("APPROVED");
  });

  it("rejects unknown status values", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    signInAs(admin);
    expect((await patch(user.id, { status: "SUPERUSER" })).status).toBe(400);
  });
});

describe("DELETE /api/admin/users/[id] — permanent delete", () => {
  it("deletes an account with no history", async () => {
    const admin = await createAdmin();
    const user = await createUser();
    signInAs(admin);

    expect((await del(user.id)).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  const arrangements: [string, (user: User, admin: User) => Promise<unknown>][] = [
    ["has played in a game", (user, admin) => createGame({ creator: admin, seats: [{ user }] })],
    ["has created a game", (user) => createGame({ creator: user })],
    ["has added a guest", (user) => createGuest(user)],
    ["owns a chip set", (user) => createChipSet(user)],
  ];

  it.each(arrangements)("refuses to delete an account that %s", async (_label, arrange) => {
    const admin = await createAdmin();
    const user = await createUser();
    await arrange(user, admin);
    signInAs(admin);

    const { status, body } = await read(await del(user.id));
    expect(status).toBe(400);
    expect(body.error).toMatch(/disable it instead/i);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("stops an admin deleting their own account", async () => {
    const admin = await createAdmin();
    signInAs(admin);

    expect((await del(admin.id)).status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
  });

  it("forbids non-admins", async () => {
    const player = await createUser();
    const victim = await createUser();
    signInAs(player);

    expect((await del(victim.id)).status).toBe(403);
    expect(await prisma.user.findUnique({ where: { id: victim.id } })).not.toBeNull();
  });
});
