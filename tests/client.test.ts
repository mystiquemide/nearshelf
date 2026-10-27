import { describe, expect, it } from "vitest";
import { readNdjson } from "@/lib/client/ndjson";
import { describeFailure } from "@/lib/rules/labels";

function streamOf(chunks: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

describe("readNdjson", () => {
  it("handles events split across chunks and a missing trailing newline", async () => {
    const seen: unknown[] = [];
    await readNdjson(streamOf(['{"a":1}\n{"b"', ':2}\n\n{"c":3}']), (e) => seen.push(e));
    expect(seen).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });
});

describe("describeFailure", () => {
  it("names the rule and the failing value", () => {
    expect(describeFailure({ rule: "too_old", value: 1997, limit: 2023 })).toBe("Too old: published 1997, window starts 2023");
    expect(describeFailure({ rule: "too_big", value: 0.987, limit: 0.8 })).toBe("Too big: popularity 0.987, ceiling 0.800");
    expect(describeFailure({ rule: "too_big", value: 0.99531, limit: 0.995 })).toBe("Too big: popularity 0.9953, ceiling 0.995");
    expect(describeFailure({ rule: "is_seed" })).toBe("One of your own books");
  });
});
