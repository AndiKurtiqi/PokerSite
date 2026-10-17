import { describe, expect, it } from "vitest";
import { PATCH as account } from "@/app/api/account/route";
import { POST as password } from "@/app/api/account/password/route";
import { POST as mergeGuest } from "@/app/api/admin/guests/[id]/merge/route";
import { DELETE as deleteUser, PATCH as patchUser } from "@/app/api/admin/users/[id]/route";
import { GET as chipSetsGet, POST as chipSetsPost } from "@/app/api/chip-sets/route";
import { POST as friends } from "@/app/api/friends/route";
import { POST as createGame } from "@/app/api/games/route";
import { DELETE as deleteGame } from "@/app/api/games/[id]/route";
import { POST as closeGame } from "@/app/api/games/[id]/close/route";
import { POST as joinGame } from "@/app/api/games/[id]/join/route";
import { POST as addParticipant } from "@/app/api/games/[id]/participants/route";
import { PATCH as moveTable } from "@/app/api/games/[id]/participants/[participantId]/table/route";
import { POST as transaction } from "@/app/api/games/[id]/participants/[participantId]/transactions/route";
import { POST as guests } from "@/app/api/guests/route";
import { GET as search } from "@/app/api/players/search/route";
import { createUser, ctx, jsonRequest, signInAs } from "../support/factories";

const body = (method: string) => jsonRequest(method, {});
const params = ctx({ id: "x", participantId: "y" });

// A safety net: no data-changing route may work without a session, and the
// admin routes must stay admin-only. If someone adds a route and forgets the
// auth check, this is where you'd add it to the list.
const needsLogin: [string, () => Promise<Response>][] = [
  ["PATCH /api/account", () => account(body("PATCH"))],
  ["POST /api/account/password", () => password(body("POST"))],
  ["GET /api/chip-sets", () => chipSetsGet()],
  ["POST /api/chip-sets", () => chipSetsPost(body("POST"))],
  ["POST /api/friends", () => friends(body("POST"))],
  ["POST /api/guests", () => guests(body("POST"))],
  ["GET /api/players/search", () => search(new Request("http://localhost/api/players/search?q=a"))],
  ["POST /api/games", () => createGame(body("POST"))],
  ["DELETE /api/games/[id]", () => deleteGame(body("DELETE"), params)],
  ["POST /api/games/[id]/close", () => closeGame(body("POST"), params)],
  ["POST /api/games/[id]/join", () => joinGame(body("POST"), params)],
  ["POST /api/games/[id]/participants", () => addParticipant(body("POST"), params)],
  ["PATCH .../participants/[id]/table", () => moveTable(body("PATCH"), params)],
  ["POST .../participants/[id]/transactions", () => transaction(body("POST"), params)],
];

const adminOnly: [string, () => Promise<Response>][] = [
  ["PATCH /api/admin/users/[id]", () => patchUser(jsonRequest("PATCH", { status: "APPROVED" }), params)],
  ["DELETE /api/admin/users/[id]", () => deleteUser(body("DELETE"), params)],
  ["POST /api/admin/guests/[id]/merge", () => mergeGuest(jsonRequest("POST", { targetUserId: "z" }), params)],
];

describe("authentication guards", () => {
  it.each(needsLogin)("%s rejects logged-out callers with 401", async (_name, call) => {
    signInAs(null);
    expect((await call()).status).toBe(401);
  });
});

describe("admin-only routes", () => {
  it.each(adminOnly)("%s rejects logged-out callers with 403", async (_name, call) => {
    signInAs(null);
    expect((await call()).status).toBe(403);
  });

  it.each(adminOnly)("%s rejects regular players with 403", async (_name, call) => {
    signInAs(await createUser({ role: "PLAYER" }));
    expect((await call()).status).toBe(403);
  });
});
