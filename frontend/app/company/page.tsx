import Image from "next/image";
import Link from "next/link";

import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyIndexPage() {
  const companies = await dbPrisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      websiteUrl: true,
      logo: true,
      bannerImage: true,
      orgType: true,
      _count: { select: { Product: true } },
    },
  });

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Companies
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Browse sellers and explore their products.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const banner = c.bannerImage?.[0] ?? null;
            const logo = c.logo?.[0] ?? null;

            return (
              <Link
                key={c.id}
                href={`/company/${c.id}`}
                className="group relative overflow-hidden border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
              >
                <div className="relative h-40 w-full">
                  {banner ? (
                    <>
                      <Image src={banner} alt="" fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-fuchsia-500/15" />
                  )}

                  <div className="absolute left-4 bottom-3 flex items-end gap-3">
                    <div className="relative h-12 w-12 overflow-hidden border border-white/20 bg-black/20 shadow-sm rounded-md transition-[border-radius] duration-200 group-hover:rounded-xl">
                      {logo ? <Image src={logo} alt="" fill className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white drop-shadow-sm">
                        {c.name}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/80">
                        <span>{c._count.Product} products</span>
                        {c.orgType ? (
                          <span className="rounded-full border border-white/25 bg-black/20 px-2 py-0.5">
                            {c.orgType}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {c.description ? (
                    <p className="line-clamp-3 text-sm text-slate-700 dark:text-slate-200">
                      {c.description}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No description yet.
                    </p>
                  )}

                  {c.websiteUrl ? (
                    <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 truncate">
                      {c.websiteUrl}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>

        {!companies.length ? (
          <div className="mt-10 text-sm text-slate-600 dark:text-slate-300">
            No companies yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
