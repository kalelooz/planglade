import type { Metadata } from "next";
import Link from "next/link";

import { PublicInfoPage } from "../public-info-page";

export const metadata: Metadata = {
  title: "Contact - PlanGlade",
  description: "Contact and support links for PlanGlade.",
};

export default function ContactPage() {
  return (
    <PublicInfoPage
      title="Contact"
      intro="Use GitHub for PlanGlade questions, bugs, and self-host feedback."
    >
      <p>
        For normal bugs and feature requests, open a GitHub issue in the public
        repository.
      </p>
      <p>
        For security reports, use GitHub Private Vulnerability Reporting when
        available. Keep sensitive details out of public issues.
      </p>
      <p>
        Start with the{" "}
        <Link className="font-medium text-zinc-900 underline" href="/demo">
          read-only demo
        </Link>
        . Cloud is coming soon.
      </p>
    </PublicInfoPage>
  );
}
