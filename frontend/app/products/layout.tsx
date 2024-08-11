
import { CategoriesProvider } from "@/components/providers/categoriesContext";
import ProductProvider from "@/components/providers/product-layoutProvider";

interface ProtectedLayoutProps {
    children: React.ReactNode
}

const MyProtectedLayout = ({ children }: ProtectedLayoutProps) => {

  return (
    <div className="max-h-full w-full flex">
      <CategoriesProvider>
        <ProductProvider>
            {children}
        </ProductProvider>
      </CategoriesProvider>
    </div>
  )
}
export default MyProtectedLayout; // protected router component