import HomeHero from "@/components/uicustom/home/home-hero";
import { MyLibUserAuth } from "@/lib/user-auth";
export default async function Home() {
  const user = await MyLibUserAuth();

  return <HomeHero isLoggedIn={!!user} userName={(user as any)?.name ?? null} />;
}