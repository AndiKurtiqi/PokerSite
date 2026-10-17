import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/account/route";
import { POST as changePassword } from "@/app/api/account/password/route";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PASSWORD, createUser, jsonRequest, read, signInAs } from "../support/factories";

describe("PATCH /api/account — profile", () => {
  it("updates display name and avatar URL", async () => {
    const me = await createUser();
    signInAs(me);

    const { status, body } = await read(
      await PATCH(jsonRequest("PATCH", { displayName: "New Name", avatarUrl: "https://example.com/a.png" }))
    );
    expect(status).toBe(200);
    expect(body.user).toEqual({ displayName: "New Name", avatarUrl: "https://example.com/a.png" });

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(saved.displayName).toBe("New Name");
    expect(saved.avatarUrl).toBe("https://example.com/a.png");
  });

  it("clears the avatar when given an empty string", async () => {
    const me = await createUser({ avatarUrl: "https://example.com/old.png" });
    signInAs(me);

    await PATCH(jsonRequest("PATCH", { displayName: me.displayName, avatarUrl: "" }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).avatarUrl).toBeNull();
  });

  it("only ever edits the caller's own profile", async () => {
    const me = await createUser({ displayName: "Me" });
    const other = await createUser({ displayName: "Other" });
    signInAs(me);

    await PATCH(jsonRequest("PATCH", { displayName: "Renamed", avatarUrl: "", id: other.id }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).displayName).toBe("Other");
  });

  it.each([
    ["an empty name", { displayName: "", avatarUrl: "" }],
    ["a name over 50 characters", { displayName: "x".repeat(51), avatarUrl: "" }],
    ["a non-URL avatar", { displayName: "Ok", avatarUrl: "not a url" }],
  ])("rejects %s", async (_label, payload) => {
    const me = await createUser({ displayName: "Original" });
    signInAs(me);

    expect((await PATCH(jsonRequest("PATCH", payload))).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).displayName).toBe("Original");
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await PATCH(jsonRequest("PATCH", { displayName: "x", avatarUrl: "" }))).status).toBe(401);
  });
});

describe("POST /api/account/password", () => {
  it("changes the password when the current one is correct", async () => {
    const me = await createUser();
    signInAs(me);

    const res = await changePassword(
      jsonRequest("POST", { currentPassword: DEFAULT_PASSWORD, newPassword: "BrandNewPass9" })
    );
    expect(res.status).toBe(200);

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(await bcrypt.compare("BrandNewPass9", saved.passwordHash)).toBe(true);
    expect(await bcrypt.compare(DEFAULT_PASSWORD, saved.passwordHash)).toBe(false);
  });

  it("rejects a wrong current password and leaves the hash untouched", async () => {
    const me = await createUser();
    signInAs(me);

    const { status, body } = await read(
      await changePassword(jsonRequest("POST", { currentPassword: "wrong-password", newPassword: "BrandNewPass9" }))
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/current password is incorrect/i);

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(saved.passwordHash).toBe(me.passwordHash);
  });

  it("rejects a new password under 8 characters", async () => {
    const me = await createUser();
    signInAs(me);

    const { status, body } = await read(
      await changePassword(jsonRequest("POST", { currentPassword: DEFAULT_PASSWORD, newPassword: "short" }))
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/at least 8/i);
  });

  it("requires login", async () => {
    signInAs(null);
    const res = await changePassword(
      jsonRequest("POST", { currentPassword: "x", newPassword: "longenough1" })
    );
    expect(res.status).toBe(401);
  });
});
