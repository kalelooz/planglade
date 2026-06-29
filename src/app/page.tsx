import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { getConfiguredAuthMode } from "@/lib/auth-config";

import LandingPage, { metadata } from "./landing/page";

export { metadata };
export const dynamic = "force-dynamic";

async function hasAuthenticatedRootSession() {
  if (getConfiguredAuthMode() !== "nextauth") {
    return false;
  }

  const session = await getServerSession(authOptions);
  return Boolean(session?.user?.email);
}

export default async function RootPage() {
  if (await hasAuthenticatedRootSession()) {
    redirect("/app");
  }

  return <LandingPage />;
}
