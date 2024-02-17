'use client'

import { MyProductCreationForm } from '@/components/uicustom/product/forms/product-form';
import React from 'react';

const MyProductCreationPage = () => {

  return (
    <div className='w-full h-full flex flex-col justify-start items-center'>
      <h1 className='text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-bl dark:from-slate-300 from-slate-500 dark:to-slate-300 to-slate-900 text-pretty'>Product Creation</h1>
      <MyProductCreationForm />
      {/* Optionally, list existing products here */}
    </div>
  );
};
  
export default MyProductCreationPage;