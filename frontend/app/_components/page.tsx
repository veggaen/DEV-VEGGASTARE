const LOG_PREFIX = '[frontend/app/dashboard/page.tsx]'
const MyComponents = async () => {
    console.log('where am I')
    return (
        <div className="flex justify-center items-start w-full h-full xl:min-h-screen text-black dark:text-white scroll-smooth">
          <div className="flex xl:min-h-screen flex-col items-center justify-start">
            <div className="flex flex-col justify-center w-full p-4 sm:p-8 md:p-12 lg:p-24 xl:p-36 lg:py-12 xl:py-12">
              <h1 className="text-xl font-semibold">Dashboard</h1>

            </div>
          </div>
        </div>
    )
}
export default MyComponents;