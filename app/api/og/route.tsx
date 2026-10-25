import { ImageResponse } from "next/og";
import { parseShareQuery } from "@/lib/share";

export const runtime = "edge";

const SPINES = ["#7a4a3a", "#3f6f58", "#5b4a7a", "#8a6a2f", "#3d5f7a", "#7a3f52"];

export function GET(req: Request) {
  const input = parseShareQuery(new URL(req.url).searchParams);
  const seeds = (input?.seeds ?? []).map((s) => (s.length > 60 ? `${s.slice(0, 57)}...` : s));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f6f1e7", color: "#23201b", padding: 64, fontFamily: "Georgia, serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700 }}>Nearshelf</div>
          <div style={{ fontSize: 34, color: "#6b6457", marginTop: 12 }}>
            {seeds.length ? "Comps for books like" : "Recent, mid-list comp titles backed by reader data"}
          </div>
          {seeds.map((s) => (
            <div key={s} style={{ fontSize: 40, marginTop: 10 }}>{s}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            {SPINES.map((c, i) => (
              <div key={c} style={{ width: 56, height: i % 2 ? 150 : 170, background: c, borderRadius: 4 }} />
            ))}
          </div>
          <div style={{ height: 14, background: "#8a6a45", borderRadius: 2 }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
