import { createFileRoute, notFound } from "@tanstack/react-router";
import { JsonLd } from "@/components/site/json-ld";
import { ProductView } from "@/components/site/product-view";
import { ReviewsPanel } from "@/components/site/reviews-panel";
import { getProductReviewsFn } from "@/server/catalog/review-api";
import { breadcrumbLd, canonicalLink, productLd } from "@/lib/seo";
import type { VariantChoice } from "@/lib/store-types";
import { getProduct } from "@/server/storefront/api";
import { getSeoOrigin } from "@/server/seo/api";

export const Route = createFileRoute("/product/$productId")({
  loader: async ({ params }) => {
    const [product, origin] = await Promise.all([getProduct({ data: { slug: params.productId } }), getSeoOrigin()]);
    if (!product) throw notFound();
    const reviews = await getProductReviewsFn({ data: { productId: product.id } });
    return { product, origin, reviews };
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    const origin = loaderData?.origin ?? "";
    return {
      meta: [
        { title: product?.seoTitle || "محصول شاهو" },
        { name: "description", content: product?.seoDescription || "" },
      ],
      links: product ? canonicalLink(origin, `/product/${product.slug}`) : [],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product, origin, reviews } = Route.useLoaderData();
  const variant = product.variants.find((item: VariantChoice) => item.isDefault) ?? product.variants[0];
  return (
    <>
      <JsonLd
        data={breadcrumbLd(origin, [
          { name: "شاهو", path: "/" },
          { name: product.categoryName, path: `/products` },
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
      {variant ? (
        <JsonLd
          data={productLd({
            origin,
            name: product.name,
            description: product.seoDescription || product.shortDescription,
            slug: product.slug,
            sku: variant.sku,
            priceIrr: variant.priceIrr,
            inStock: variant.onHand > 0,
            imageUrl: product.imageUrl,
          })}
        />
      ) : null}
      <ProductView product={product} />
      <ReviewsPanel productId={product.id} reviews={reviews} />
    </>
  );
}
