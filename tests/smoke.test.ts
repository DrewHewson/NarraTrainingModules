import { createClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";

test("test runner works", () => {
  expect(1 + 1).toBe(2);
});

test("supabase client dependency is installed and importable", () => {
  expect(typeof createClient).toBe("function");
});
