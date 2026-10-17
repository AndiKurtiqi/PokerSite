import { ensureTestDatabase } from "./test-db";

export default async function globalSetup() {
  await ensureTestDatabase();
}
