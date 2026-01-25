"use client";

import { useParams } from "next/navigation";

import ProductClient from "./ProductClient";

export default function Page() {
  const { id } = useParams();
  const productId = Array.isArray(id) ? id[0] : id;

  return <ProductClient productId={productId} />;
}
