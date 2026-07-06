import type { Metadata } from "next";

import { PublicInfoPage } from "../public-info-page";

export const metadata: Metadata = {
  title: "Terms - PlanGlade",
  description: "PlanGlade terms for the public website and demo.",
};

export default function TermsPage() {
  return (
    <PublicInfoPage
      title="Terms"
      intro="Use the public website and demo as-is."
    >
      <p>
        The demo is read-only and provided for evaluation. Do not rely on it for
        storing work.
      </p>
      <p>
        PlanGlade source code is licensed under AGPL-3.0. Self-hosting is your
        responsibility.
      </p>
      <p>Cloud is coming soon. There is no checkout or paid signup today.</p>
    </PublicInfoPage>
  );
}
