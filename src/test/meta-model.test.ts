import { describe, expect, it } from "vitest";

import { META_MODEL_ID } from "@/lib/ai/meta-model.server";

describe("GraceGuard drafting model", () => {
  it("uses the requested Muse Spark model", () => {
    expect(META_MODEL_ID).toBe("muse-spark-1.3");
  });
});