
import { CategoriesProvider } from "@/components/providers/categoriesContext";
import ProductProvider from "@/components/providers/product-layoutProvider";

interface ProtectedLayoutProps {
    children: React.ReactNode
}

const MyProtectedLayout = ({ children }: ProtectedLayoutProps) => {

  return (
		<div className="w-full h-[calc(100dvh-var(--app-header-offset))] min-h-0 overflow-hidden flex">
      <CategoriesProvider>
        <ProductProvider>
            {children}
        </ProductProvider>
      </CategoriesProvider>
    </div>
  )
}
export default MyProtectedLayout; // protected router component