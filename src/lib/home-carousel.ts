/** Wrap navigation without losing any of the CMS-ordered active banners. */
export function carouselIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

/** Exactly three slots; null slots are disabled when a group is incomplete. */
export function carouselIndicatorTargets(count: number, index: number): Array<number | null> {
  const start = Math.floor(carouselIndex(index, count) / 3) * 3;
  return [0, 1, 2].map((offset) => (start + offset < count ? start + offset : null));
}

/** Load the active image and at most the next image, wrapping at the end. */
export function carouselImageIndices(count: number, index: number): number[] {
  if (count <= 0) return [];
  const active = carouselIndex(index, count);
  return count === 1 ? [active] : [active, carouselIndex(active + 1, count)];
}
