import type { Metadata } from "next";
import { Nearshelf } from "@/components/nearshelf";
import { popularityCeiling } from "@/lib/run/config";
import { alsoLoveEnabled } from "@/lib/run/also-love";
import { parseShareQuery, shareQuery } from "@/lib/share";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function toParams(sp: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const item of Array.isArray(v) ? v : v ? [v] : []) params.append(k, item);
  return params;
}

// A share link previews with its seed titles. Comps aren't in the preview, since that would need a Qloo call.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const input = parseShareQuery(toParams(await searchParams));
  if (!input) return { openGraph: { images: ["/api/og"] }, twitter: { card: "summary_large_image", images: ["/api/og"] } };
  const title = `Comps for books like ${input.seeds.join(", ")}`;
  const image = `/api/og?${shareQuery(input)}`;
  return {
    title: `${title} · Nearshelf`,
    openGraph: { title, description: "Recent, mid-list comps checked against Qloo reader data.", images: [image] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default function Home() {
  return <Nearshelf popularityMax={popularityCeiling()} alsoLoveEnabled={alsoLoveEnabled()} />;
}
