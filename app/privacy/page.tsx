import type { Metadata } from "next";

import { LegalPageShell } from "@/components/marketing/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Dockout",
  description:
    "Privacy Policy for Dockout, a mobile-first sailing data workspace for teams.",
};

const LAST_UPDATED = "July 17, 2026";

const PRIVACY_SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    children: (
      <>
        <p>
          Dockout is a mobile-first workspace for sailing teams to track sessions,
          training camps, venues, water time, media and reports. This Privacy Policy
          explains how Dockout handles personal data in a GDPR-aligned way.
        </p>
        <p>
          Team content is controlled by the organization or team that decides what to
          upload. Dockout operates the service, provides the platform, and processes
          account, billing, support and usage data needed to run the product.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data We Collect",
    children: (
      <>
        <p>We collect the minimum data needed to provide and protect the service.</p>
        <ul>
          <li>Account data: name, email address, authentication identifiers and role.</li>
          <li>
            Organization and team data: team names, memberships, roles, venues, camps,
            session records, notes, water-time data, media files and reports.
          </li>
          <li>
            Billing data: plan, subscription status, invoice references and payment
            provider identifiers. Full card details are handled by payment providers.
          </li>
          <li>
            Technical data: device, browser, IP address, security logs, diagnostics and
            product usage events.
          </li>
          <li>
            Support data: messages, attachments and context shared when you contact us.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "purposes",
    title: "Purposes and Legal Bases",
    children: (
      <>
        <p>
          We process personal data only for defined purposes and only when a lawful
          basis applies.
        </p>
        <ul>
          <li>
            Contract: to create accounts, authenticate users, provide the workspace,
            store team data and deliver subscribed features.
          </li>
          <li>
            Legitimate interests: to secure the service, prevent abuse, improve
            reliability, understand product usage and support customers.
          </li>
          <li>
            Legal obligation: to keep tax, accounting, security and compliance records
            where required.
          </li>
          <li>
            Consent: where we ask for optional permissions, marketing consent, or other
            consent-based processing.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing and Processors",
    children: (
      <>
        <p>
          Dockout does not sell personal data. We share data only when needed to run the
          service, comply with law, protect rights, or follow instructions from the
          organization that controls the team workspace.
        </p>
        <p>
          Service providers may process data for hosting, authentication, database,
          storage, analytics, billing, email and support. They must protect the data and
          process it only for the agreed service purpose.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "International Transfers",
    children: (
      <>
        <p>
          Dockout and its providers may process data in countries outside the European
          Economic Area. Where required, transfers use appropriate safeguards such as
          adequacy decisions, Standard Contractual Clauses, and technical and
          organizational measures designed to protect the data.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "Retention",
    children: (
      <>
        <p>
          We keep personal data only for as long as needed for the purposes described in
          this policy, including active account use, legal obligations, dispute
          resolution, backups, security and audit records.
        </p>
        <p>
          Organization and team content is retained while the workspace is active unless
          the organization deletes it or requests deletion, subject to lawful retention
          requirements and backup cycles.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your Rights",
    children: (
      <>
        <p>
          Depending on where you live and the legal basis for processing, you may have
          the right to be informed, access your data, correct inaccurate data, request
          deletion, restrict processing, object to processing, receive a portable copy,
          withdraw consent and lodge a complaint with a data protection authority.
        </p>
        <p>
          If your data belongs to a team workspace, we may need to coordinate the request
          with the organization that controls that workspace. Contact us at{" "}
          <a href="mailto:billing@dockout.app">billing@dockout.app</a>.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    children: (
      <>
        <p>
          Dockout uses access controls, role-based permissions, managed authentication,
          encrypted transport, provider security controls, backups and operational
          monitoring to protect data. No online service can guarantee absolute security,
          so account owners should use strong credentials and manage team access
          carefully.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children and Athletes",
    children: (
      <>
        <p>
          Dockout is intended for teams and organizations, not for independent use by
          children. Organizations are responsible for having the permissions, notices and
          lawful basis needed before uploading data about sailors, athletes, coaches,
          crew or minors.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes",
    children: (
      <>
        <p>
          We may update this policy as the service changes or legal requirements evolve.
          Material changes will be posted on this page, and where appropriate we will
          provide additional notice inside the product or by email.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How Dockout handles personal data for sailing teams, organizations and users."
      lastUpdated={LAST_UPDATED}
      sections={PRIVACY_SECTIONS}
    />
  );
}
