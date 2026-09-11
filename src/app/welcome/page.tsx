import type { Metadata } from "next";

import { WelcomePageContent } from "@/features/auth/identity-controls";

export const metadata: Metadata = {
  title: "Choose a Username | Who's That Pokemon?",
};

type WelcomePageProps = {
  searchParams: Promise<{ next?: string }>;
};

const WelcomePage = async ({ searchParams }: WelcomePageProps) => {
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/") && next !== "/welcome" ? next : "/";

  return <WelcomePageContent nextPath={nextPath} />;
};

export default WelcomePage;