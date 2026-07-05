import type { Metadata } from "next";
import Link from "next/link";

import { PublicInfoPage } from "../public-info-page";

export const metadata: Metadata = {
  title: "Security - PlanGlade",
  description: "PlanGlade security reporting and self-hosting notes.",
};

export default function SecurityPage() {
  return (
    <PublicInfoPage
      title="Security"
      intro="PlanGlade is early self-host software."
    >
      <p>
        Review authentication, storage, backups, TLS, reverse proxy, monitoring,
        and rate limiting before exposing a self-hosted deployment to the
        public internet.
      </p>
      <p>
        Report suspected vulnerabilities privately through GitHub Private
        Vulnerability Reporting when available. Do not post exploit details in
        public issues.
      </p>
      <p>
        See the{" "}
        <Link className="font-medium text-zinc-900 underline" href="/demo">
          read-only demo
        </Link>{" "}
        before self-hosting.
      </p>
    </PublicInfoPage>
  );
}
