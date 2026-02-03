import EditProductClient from "../EditProductClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;

  if (!productId) {
    return (
      <div className="p-6 text-sm text-zinc-600 dark:text-zinc-300">
        Invalid product link.
      </div>
    );
  }

  return <EditProductClient productId={productId} />;
}
