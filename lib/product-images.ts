// Screenshots of real Nearshelf runs, captured from the live site and hosted on
// Vercel Blob so no Qloo data is stored in this repository. Filled in by
// scripts/capture-product-images.mjs. A missing entry means the image isn't shown.
export interface ProductImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export const PRODUCT_IMAGES: Partial<Record<"hero" | "seeds" | "agent" | "evidence" | "rejected" | "check" | "line" | "llm", ProductImage>> = {
  hero: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/hero-v2.webp", width: 2080, height: 1340, alt: "Nearshelf after a real search for books like Western Lane, The Candy House and Memphis, with six comps on the shelf including The Fraud by Zadie Smith" },
  seeds: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/seeds-v1.webp", width: 876, height: 1058, alt: "Three seed books found in Qloo, each shown with its author and year" },
  agent: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/agent-v1.webp", width: 876, height: 512, alt: "The agent log showing the two tool calls the model chose, with their timings" },
  evidence: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/evidence-v1.webp", width: 584, height: 640, alt: "Evidence for The Fraud by Zadie Smith: Qloo entity ID, published 2023, popularity 0.926" },
  rejected: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/rejected-v1.webp", width: 1508, height: 470, alt: "Check my comps results: Where the Crawdads Sing and Fourth Wing rejected with the rules they broke, Untethered Sky passes" },
  check: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/check-v1.webp", width: 1636, height: 1060, alt: "The Check my comps tab after checking three titles" },
  line: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/line-v1.webp", width: 584, height: 698, alt: "A comp line built from accepted comps, ready to copy" },
  llm: { src: "https://9snawvkvwjgduwxr.public.blob.vercel-storage.com/product/llm-v1.webp", width: 1636, height: 1130, alt: "A plain LLM's suggestions for the same books, each rejected with the rule it broke" },
};
