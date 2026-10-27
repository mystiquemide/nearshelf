import Image from "next/image";
import type { ProductImage } from "@/lib/product-images";

// A read-only screenshot of a real Nearshelf run, shown in a fixed-ratio frame.
// Images taller than the frame are cropped from the top; wider ones keep their own shape.
export function ProductShot({ image, className, priority, ratio = 1.5 }: { image: ProductImage; className?: string; priority?: boolean; ratio?: number }) {
  const fit = image.width / image.height > ratio ? "contain" : "cover";
  return (
    <figure className={`shot shot-${fit} ${className ?? ""}`} style={fit === "cover" ? { aspectRatio: String(ratio) } : undefined}>
      <Image src={image.src} width={image.width} height={image.height} alt={image.alt} priority={priority} sizes="(min-width: 1120px) 960px, 100vw" />
    </figure>
  );
}
