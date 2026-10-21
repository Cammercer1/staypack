import { vi } from "vitest";

// Vitest executes server modules outside Next's server-only import boundary.
vi.mock("server-only", () => ({}));
