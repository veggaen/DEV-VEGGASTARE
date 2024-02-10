
const MyTopBar = () => {
  return (
      <div className="flex min-h-[72px] max-h-[72px] w-full justify-end items-center transition-width duration-300 ease-in-out bg-slate-300 text-black dark:bg-slate-900 dark:text-white">
        <div className="flex justify-center items-center py-2 px-4 space-x-2">
          <div className='py-2 px-4 hover:bg-slate-400/50 hover:dark:bg-slate-600/50 hover:cursor-pointer text-nowrap rounded'>MOON</div>
          <div className='py-2 px-4 hover:bg-slate-400/50 hover:dark:bg-slate-600/50 hover:cursor-pointer text-nowrap rounded'>STAR</div>
          <div className='py-2 px-4 hover:bg-slate-400/50 hover:dark:bg-slate-600/50 hover:cursor-pointer text-nowrap rounded'>CROSS</div>
        </div>
      </div>
  )
}
export default MyTopBar;