import { vi } from "vitest";

// `server-only` throws outside a React Server Component runtime. Tests run
// in node, so provide an empty module in its place.
vi.mock("server-only", () => ({}));

// Next request-scoped primitives are not available under Vitest. The action
// modules only touch them on paths that require an active request.
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: () => undefined, set: () => undefined }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));