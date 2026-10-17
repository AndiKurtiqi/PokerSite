import { ensureTestDatabase } from "../support/test-db";

export default async function globalSetup() {
  await ensureTestDatabase();
}
