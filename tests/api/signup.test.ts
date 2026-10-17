import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/signup/route";
import { prisma } from "@/lib/prisma";
import { createUser, jsonRequest, read } from "../support/factories";

const valid = { displayName: "New Player", email: "new@test.local", password: "supersecret1" };

describe("POST /api/signup", () => {
  it("creates a PENDING player account", async () => {
    const { status, body } = await read(await POST(jsonRequest("POST", valid)));
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });
    expect(user.status).toBe("PENDING");
    expect(user.role).toBe("PLAYER");
    expect(user.displayName).toBe("New Player");
  });

  it("stores a bcrypt hash, never the plain password", async () => {
    await POST(jsonRequest("POST", valid));
    const user = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });
    expect(user.passwordHash).not.toContain(valid.password);
    expect(await bcrypt.compare(valid.password, user.passwordHash)).toBe(true);
  });

  it("ignores attempts to sign up as an approved admin", async () => {
    await POST(jsonRequest("POST", { ...valid, role: "ADMIN", status: "APPROVED" }));
    const user = await prisma.user.findUniqueOrThrow({ where: { email: valid.email } });
    expect(user.role).toBe("PLAYER");
    expect(user.status).toBe("PENDING");
  });

  it("rejects a duplicate email with 409", async () => {
    await createUser({ email: valid.email });
    const { status, body } = await read(await POST(jsonRequest("POST", valid)));
    expect(status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ["an invalid email", { ...valid, email: "not-an-email" }],
    ["a password under 8 characters", { ...valid, password: "short" }],
    ["an empty display name", { ...valid, displayName: "" }],
    ["a display name over 50 characters", { ...valid, displayName: "x".repeat(51) }],
    ["a missing password", { displayName: "A", email: "a@test.local" }],
  ])("rejects %s with 400", async (_label, payload) => {
    const { status } = await read(await POST(jsonRequest("POST", payload)));
    expect(status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });
});
