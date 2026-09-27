import dynamic from "next/dynamic";
import HomeHero from "@/components/uicustom/home/home-hero";
import LandingChatWidget from "@/components/uicustom/home/LandingChatWidget";
import { Atmosphere } from "@/components/uicustom/chrome/atmosphere";
import { MyLibUserAuth } from "@/lib/user-auth";

// Split below-fold content into a separate JS chunk so the hero can hydrate
// and become interactive before the larger below-fold code is parsed.
const BelowFoldSections = dynamic(
  () => import("@/components/uicustom/home/BelowFoldSections"),
  { ssr: true, loading: () => null }
);

export default async function Home() {
  const user = await MyLibUserAuth();

  return (
    <>
      {/* The brand star field, at landing intensity — fixed behind the header
          and every section. Other routes use the quiet variant or none. */}
      <Atmosphere variant="landing" />

      <HomeHero isLoggedIn={!!user} userName={user?.name ?? null}>
        <LandingChatWidget
          isLoggedIn={!!user}
          userId={user?.id ?? null}
        />
      </HomeHero>
      <BelowFoldSections />
    </>
  );
}
