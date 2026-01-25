import { use } from "react";
import ProductClient from "./ProductClient";

// params is now a Promise in Next 15 server components
export default function Page({ params }: { params: Promise<{ id: string[] }> }) {
  const { id } = use(params);
  const productId = Array.isArray(id) ? id[0] : id;
  return <ProductClient productId={productId} />;
}
