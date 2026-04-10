import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";

describe("paperclip-ai2ai-plugin manifest", () => {
  it("declares a valid plugin id", () => {
    expect(manifest.id).toBe("paperclip-ai2ai-plugin");
  });

  it("registers issue UI surfaces", () => {
    const slotTypes = manifest.ui?.slots?.map((slot) => slot.type) ?? [];
    expect(slotTypes).toContain("detailTab");
    expect(slotTypes).toContain("taskDetailView");
  });
});
