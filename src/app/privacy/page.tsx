import type { Metadata } from "next";

import { PublicInfoPage } from "../public-info-page";

export const metadata: Metadata = {
  title: "Privacy - PlanGlade",
  description: "PlanGlade privacy notes for the public website and demo.",
};

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      title="Privacy"
      intro="PlanGlade is open-source software you can self-host."
    >
      <p>
        The public website is for product information and a read-only demo. Do
        not enter private data into the demo.
      </p>
      <p>
        Self-hosted deployments are controlled by whoever runs them. Review
        your own hosting, backups, logs, and access controls.
      </p>
      <p>Cloud is not live yet. No cloud account is offered today.</p>
    </PublicInfoPage>
  );
}
