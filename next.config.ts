import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The browser tests build into their own folder (NEXT_DIST_DIR) so a test run
  // can never overwrite the cache of a dev server running at the same time.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
