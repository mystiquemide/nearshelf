import Image from "next/image";
import type { ProductImage } from "@/lib/product-images";

// A read-only screenshot of a real Nearshelf run, shown in a light frame.
export function ProductShot({ image, className, priority }: { image: ProductImage; className?: string; priority?: boolean }) {
  return (
    <figure className={`shot ${className ?? ""}`}>
      <Image src={image.src} width={image.width} height={image.height} alt={image.alt} priority={priority} sizes="(min-width: 1120px) 1040px, 100vw" />
    </figure>
  );
}
