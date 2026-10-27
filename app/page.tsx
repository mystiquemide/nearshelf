import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeroArt } from "@/components/hero-art";
import { ProductShot } from "@/components/product-shot";
import { Footer, Sections } from "@/components/sections";
import { SiteNav } from "@/components/site-nav";
import { loadEvalTotals } from "@/lib/eval-results";
import { PRODUCT_IMAGES } from "@/lib/product-images";
import { toParams, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  openGraph: { images: ["/api/og"] },
  twitter: { card: "summary_large_image", images: ["/api/og"] },
};

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  // Share links used to live on the home page. Send them to the tool.
  const params = toParams(await searchParams);
  if (params.has("s")) redirect(`/find?${params}`);

  return (
    <>
      <SiteNav />
      <main>
        <section className="hero on-ink" aria-labelledby="hero-h">
          <HeroArt />
          <div className="container hero-inner">
            <div className="hero-copy">
              <h1 id="hero-h">Comp titles your query letter can stand on</h1>
              <p className="hero-sub">
                Recent, mid-list books that readers of your book actually read. Picked from Qloo reader data, checked against the
                rules agents use, and shown with the evidence.
              </p>
              <div className="row hero-actions">
                <Link className="btn btn-primary" href="/find">Find my comps</Link>
                <Link className="btn btn-secondary" href="/#how">See how it works</Link>
              </div>
              <p className="hero-source">Reader data from Qloo&apos;s taste graph</p>
            </div>
            {PRODUCT_IMAGES.hero && <ProductShot image={PRODUCT_IMAGES.hero} className="hero-shot" priority />}
          </div>
        </section>
        <Sections evalTotals={loadEvalTotals()} />
      </main>
      <Footer />
    </>
  );
}
