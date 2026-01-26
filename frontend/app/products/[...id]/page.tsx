"use client";

import { useParams } from "next/navigation";

import ProductClient from "./ProductClient";

export default function Page() {
  const { id } = useParams();
  const productId = Array.isArray(id) ? id[0] : id;

  return <ProductClient productId={productId} />; 
  /*
  is this proper and good typescript? like best practice? I see this error in vs code:
   Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.ts(2322)
ProductClient.tsx(1158, 56): The expected type comes from property 'productId' which is declared here on type 'IntrinsicAttributes & { productId: string; }'
(property) productId: string */
}
