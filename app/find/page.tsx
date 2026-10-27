import type { Metadata } from "next";
import { Nearshelf } from "@/components/nearshelf";
import { Footer } from "@/components/sections";
import { SiteNav } from "@/components/site-nav";
import { popularityCeiling } from "@/lib/run/config";
import { alsoLoveEnabled } from "@/lib/run/also-love";
import { parseShareQuery, shareQuery } from "@/lib/share";
import { toParams, type SearchParams } from "@/lib/search-params";

// A share link previews with its seed titles. Comps aren't in the preview, since that would need a Qloo call.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const input = parseShareQuery(toParams(await searchParams));
  if (!input) return { title: "Find comps · Nearshelf" };
  const title = `Comps for books like ${input.seeds.join(", ")}`;
  const image = `/api/og?${shareQuery(input)}`;
  return {
    title: `${title} · Nearshelf`,
    openGraph: { title, description: "Recent, mid-list comps checked against Qloo reader data.", images: [image] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default function FindPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Nearshelf popularityMax={popularityCeiling()} alsoLoveEnabled={alsoLoveEnabled()} qlooReady={Boolean(process.env.QLOO_API_KEY)} />
      </main>
      <Footer />
    </>
  );
}
