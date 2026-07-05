import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

config({ path: ".env.local" });

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
