  'use client'

  import { useCategories } from "@/components/providers/categoriesContext";
  import { useCurrentUser } from "@/hooks/use-current-user";
  import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
  import { ScrollArea } from "@radix-ui/react-scroll-area"
  import { ArrowDown01Icon, ArrowDownIcon, ArrowLeft, EyeOff, PanelLeftClose, PanelTop, PanelTopClose } from "lucide-react";
  import { useState } from "react";

  // Assuming you are using TypeScript, define the props interface
  interface MySidebarProductsMenuProps {
      categories?: string[];
      setSelectedCategories?: React.Dispatch<React.SetStateAction<string[]>>;
      isOpen: boolean;
    }
    
    // Adjust the component to use the correct props
    export const MySidebarProductsMenu = ({ isOpen }: MySidebarProductsMenuProps) => {
      const user = useCurrentUser();
      const { categories, setSelectedCategories } = useCategories();

      const [isFilterTabCategories, setIsFilterTabCategories] = useState<{ categories: boolean, price: boolean, [key: string]: boolean }>({ categories: true, price: false });

      const handleFilterTabOpen = (tab: keyof typeof isFilterTabCategories) => {
          console.log("handleFilterTabOpen tab:", tab);
          setIsFilterTabCategories(prevTab => ({ ...prevTab, [tab]: !prevTab[tab] }));
        };
      const handleCategoryChange = (category: string, isChecked: boolean) => {
        setSelectedCategories(prev =>
          isChecked ? [...prev, category] : prev.filter(c => c !== category)
        );
      };

    
      return (
        <div className="max-w-[350px]">
          <div className={`sidebar-products bg-white-10 ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 bg-slate-100 dark:bg-slate-900`}>
            <div className={` overflow-y-auto specificElement182`}>
              <div className={`w-fit space-y-2 my-2`}>
                <div onClick={() => handleFilterTabOpen('categories')} className="flex justify-start items-center py-1 px-2 gap-2 font-bold text-center rounded-r-xl bg-slate-200 dark:bg-slate-800">
                  <h2>Categories</h2>
                  {isFilterTabCategories.categories ? <PanelTop className="h-5 w-5"/> : <EyeOff className="h-4 w-4"/>}
                </div>
              </div>
              <div className={``}>
                {isFilterTabCategories.categories && (
                  <div className="flex flex-col gap-2 justify-center items-start text-center p-2">
                    {categories && categories.map((category, index) => (
                      <div key={index} className={`bg-slate-200 dark:bg-slate-800 w-full py-1 px-2 rounded`}>
                      <div className={`flex flex-row-reverse justify-between`} >
                        <input
                          className={'mx-1'}
                          type="checkbox"
                          id={`checkbox-${category}-${index}`} // Ensure unique ID
                          name={category}
                          onChange={(e) => handleCategoryChange(category, e.target.checked)}
                        />
                        <label htmlFor={`checkbox-${category}-${index}`} className={'capitalize'}>{category}</label>
                      </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={`w-fit space-y-2 my-2`}>
                <div onClick={() => handleFilterTabOpen('price')} className="flex justify-start items-center py-1 px-2 gap-2 font-bold text-center rounded-r-xl bg-slate-200 dark:bg-slate-800">
                  <h2>Price</h2>
                  {isFilterTabCategories.price ? <PanelTop className="h-5 w-5"/> : <EyeOff className="h-4 w-4"/>}
                </div>
              </div>
              <div className={``}>
                {isFilterTabCategories.price && (
                  <div className='flex flex-col gap-2 justify-center items-start text-center p-2'>
                    {categories && categories.map((category, index) => (
                      <div key={index} className={`bg-slate-200 dark:bg-slate-800 w-full py-1 px-2 rounded`}>
                      <div className={`flex flex-row-reverse justify-between`} >
                        <input
                          className={'mx-1'}
                          type="checkbox"
                          id={`checkbox-${category}-${index}`} // Ensure unique ID
                          name={category}
                          onChange={(e) => handleCategoryChange(category, e.target.checked)}
                        />
                        <label htmlFor={`checkbox-${category}-${index}`} className={'capitalize'}>{category}</label>
                      </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    };