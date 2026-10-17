import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/players/search/route";
import { prisma } from "@/lib/prisma";
import { befriend, createGuest, createUser, read, signInAs } from "../support/factories";

const search = (q: string) => GET(new Request(`http://localhost/api/players/search?q=${encodeURIComponent(q)}`));

const names = (rows: { displayName?: string; name?: string }[]) =>
  rows.map((r) => r.displayName ?? r.name).sort();

describe("GET /api/players/search", () => {
  it("buckets results into friends, your guests, and other players", async () => {
    const me = await createUser({ displayName: "Alice Self" });
    const friend = await createUser({ displayName: "Alice Friend" });
    await createUser({ displayName: "Alice Stranger" });
    await befriend(me, friend);
    await createGuest(me, "Alice Guest");
    signInAs(me);

    const { status, body } = await read(await search("alice"));
    expect(status).toBe(200);
    expect(names(body.friends)).toEqual(["Alice Friend"]);
    expect(names(body.others)).toEqual(["Alice Stranger"]);
    expect(names(body.guests)).toEqual(["Alice Guest"]);
    expect(body.friends[0].isFriend).toBe(true);
    expect(body.others[0].isFriend).toBe(false);
  });

  it("never returns the caller themselves", async () => {
    const me = await createUser({ displayName: "Zed Self" });
    signInAs(me);
    const { body } = await read(await search("zed"));
    expect(body.friends).toEqual([]);
    expect(body.others).toEqual([]);
  });

  it("only returns approved users", async () => {
    const me = await createUser();
    await createUser({ displayName: "Bob Pending", status: "PENDING" });
    await createUser({ displayName: "Bob Rejected", status: "REJECTED" });
    await createUser({ displayName: "Bob Disabled", status: "DISABLED" });
    await createUser({ displayName: "Bob Approved" });
    signInAs(me);

    const { body } = await read(await search("bob"));
    expect(names(body.others)).toEqual(["Bob Approved"]);
  });

  it("returns guests from every banker (shared pool), and hides merged ones", async () => {
    const me = await createUser();
    const other = await createUser();
    const target = await createUser();
    await createGuest(me, "Cara Mine");
    await createGuest(other, "Cara Theirs");
    const merged = await createGuest(me, "Cara Merged");
    await prisma.guest.update({ where: { id: merged.id }, data: { mergedIntoId: target.id } });
    signInAs(me);

    const { body } = await read(await search("cara"));
    expect(names(body.guests).sort()).toEqual(["Cara Mine", "Cara Theirs"]);
  });

  it("matches case-insensitively and by email", async () => {
    const me = await createUser();
    await createUser({ displayName: "Dana", email: "dana.unique@test.local" });
    signInAs(me);

    expect(names((await read(await search("DANA"))).body.others)).toEqual(["Dana"]);
    expect(names((await read(await search("dana.unique@"))).body.others)).toEqual(["Dana"]);
  });

  it("returns nothing for an empty query", async () => {
    const me = await createUser();
    await createUser({ displayName: "Someone" });
    signInAs(me);

    const { body } = await read(await search("   "));
    expect(body).toEqual({ friends: [], guests: [], others: [] });
  });

  it("requires login", async () => {
    signInAs(null);
    expect((await search("a")).status).toBe(401);
  });
});
