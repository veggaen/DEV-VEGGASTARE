'use client';

import { useCategories } from "@/components/providers/categoriesContext";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ArrowDownIcon, EyeOff } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

// Assuming you are using TypeScript, define the props interface
interface MySidebarProductsMenuProps {
    categories?: string[];
    setSelectedCategories?: React.Dispatch<React.SetStateAction<string[]>>;
    isOpen: boolean;
    setMinPrice?: React.Dispatch<React.SetStateAction<number>>;
    setMaxPrice?: React.Dispatch<React.SetStateAction<number>>;
}

// Adjust the component to use the correct props
export const MySidebarProductsMenu = ({ isOpen }: MySidebarProductsMenuProps) => {
    const user = useCurrentUser();
    const { categories, selectedCategories, setSelectedCategories, setMinPrice, minPrice, setMaxPrice, maxPrice, searchTerm, setSearchTerm } = useCategories();
    const [localSelectedCategories, setLocalSelectedCategories] = useState<string[]>(selectedCategories || []);
    const [localCategories, setLocalCategories] = useState<string[]>(categories || []);
    const [isFilterTabCategories, setIsFilterTabCategories] = useState<{ categories: boolean, price: boolean, [key: string]: boolean }>({ categories: true, price: true });

    const handleFilterTabOpen = useCallback((tab: keyof typeof isFilterTabCategories) => {
        setIsFilterTabCategories(prevTab => ({ ...prevTab, [tab]: !prevTab[tab] }));
    }, []);

    const handleCategoryChange = useCallback((category: string, isChecked: boolean) => {
        setSelectedCategories(prev => 
            isChecked ? [...prev, category] : prev.filter(c => c !== category)
        );
    }, [setSelectedCategories]);

    const handleResetPrice = useCallback(() => {
        setMinPrice(0); // Assuming 0 is your default minimum price
        setMaxPrice(Infinity); // Assuming Infinity represents no maximum price limit
    }, [setMinPrice, setMaxPrice]);

    useEffect(() => {
        if (categories !== localCategories) {
            setLocalCategories(categories);
        }
        if (selectedCategories !== localSelectedCategories) {
            setLocalSelectedCategories(selectedCategories);
        }
    }, [categories, selectedCategories, localCategories, localSelectedCategories]);

    useEffect(() => {
        if (categories.length > 0) {
            setLocalCategories(categories);
        } else {
            setLocalCategories([]);
        }
    }, [categories]);

    return (
        <div className="max-w-[350px]">
            <div className={`sidebar-products bg-white-10 ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 bg-slate-50 dark:bg-slate-900`}>
                <div className={`flex flex-col justify-start items-center overflow-y-auto specificElement182`}>
                    <div className="w-full space-y-2 p-3 text-center">
                        <input
                            type="text"
                            placeholder="Search by title..."
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full border-2 bg-white dark:bg-black/30 border-black/50 dark:border-white/50 py-1 px-2 rounded-xl"
                        />
                    </div>
                    <div className={`w-full space-y-2 my-2`}>
                        <div onClick={() => handleFilterTabOpen('price')} className="flex justify-start items-center py-1 px-2 gap-2 font-bold text-center bg-slate-200 dark:bg-slate-800">
                            <h2>Price</h2>
                            {isFilterTabCategories.price ? <ArrowDownIcon className="h-5 w-5" /> : <EyeOff className="h-4 w-4" />}
                        </div>
                    </div>
                    <div>
                        {isFilterTabCategories.price && (
                            <div className={'flex flex-col sm:flex-row justify-center items-center w-full gap-0 bg-slate-100 dark:bg-slate-900 py-2 px-2'}>
                                <input
                                    type="number"
                                    placeholder="Min Price"
                                    value={minPrice !== 0 ? minPrice.toString() : ''}
                                    onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) : 0)}
                                    className={'w-full border-2 bg-white dark:bg-black/30 border-black/50 dark:border-white/50 p-1 sm:mr-2 rounded'}
                                />
                                <input
                                    type="number"
                                    placeholder="Max Price"
                                    value={maxPrice !== Infinity ? maxPrice.toString() : ''}
                                    onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : Infinity)}
                                    className={'border-2 bg-white dark:bg-black/30 border-black/50 dark:border-white/50 p-1 w-full sm:mr-2 rounded'}
                                />
                                <div onClick={handleResetPrice} className='bg-white dark:bg-black/30 w-full py-1 px-2 border-2 border-black/50 dark:border-white/50 rounded hover:bg-blue-500 '>Reset</div>
                            </div>
                        )}
                    </div>
                    <div className={`w-full space-y-2 my-2`}>
                        <div onClick={() => handleFilterTabOpen('categories')} className="flex justify-start items-center py-1 px-2 gap-2 font-bold text-center bg-slate-200 dark:bg-slate-800">
                            <h2>Categories</h2>
                            {isFilterTabCategories.categories ? <ArrowDownIcon className="h-5 w-5" /> : <EyeOff className="h-4 w-4" />}
                        </div>
                    </div>
                    <div className={`w-full`}>
                        {isFilterTabCategories.categories && (
                            <div className="flex flex-col gap-2 justify-center items-start text-center p-2">
                                {localCategories && localCategories.map((category, index) => (
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