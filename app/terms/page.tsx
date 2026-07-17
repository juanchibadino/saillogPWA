import type { Metadata } from "next";

import { LegalPageShell } from "@/components/marketing/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service | Dockout",
  description:
    "Terms of Service for Dockout, a mobile-first sailing data workspace for teams.",
};

const LAST_UPDATED = "July 17, 2026";

const TERMS_SECTIONS = [
  {
    id: "agreement",
    title: "Agreement",
    children: (
      <>
        <p>
          These Terms of Service govern access to Dockout, a mobile-first workspace for
          sailing teams to track sessions, training camps, venues, water time, media and
          reports.
        </p>
        <p>
          By using Dockout, you agree to these terms. If you use Dockout for an
          organization or team, you confirm that you are authorized to accept these terms
          for that organization or team.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "The Service",
    children: (
      <>
        <p>
          Dockout provides tools for operational sailing logs, team workspaces, role-based
          access, session records, training camp history, venue data, media storage and
          reports. Dockout is not a safety system, emergency system, navigation system or
          substitute for professional judgment on the water.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and Team Roles",
    children: (
      <>
        <p>
          You are responsible for keeping account credentials secure and for ensuring
          that invited users have appropriate access. Organization and team admins are
          responsible for membership, role assignments and removing access when it is no
          longer needed.
        </p>
        <p>
          You must provide accurate account information and promptly update it when it
          changes.
        </p>
      </>
    ),
  },
  {
    id: "customer-data",
    title: "Customer Data",
    children: (
      <>
        <p>
          You keep ownership of the session data, venue data, notes, reports, media and
          other content you upload or create in Dockout. You grant Dockout the limited
          rights needed to host, process, display, back up and transmit that data to
          provide the service.
        </p>
        <p>
          You are responsible for the lawfulness, accuracy and permissions for data you
          upload, including athlete data, media, personal data and data about minors.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    children: (
      <>
        <p>You must not use Dockout to:</p>
        <ul>
          <li>break the law or violate the rights of another person;</li>
          <li>upload unlawful, harmful, abusive or infringing content;</li>
          <li>attempt to bypass authentication, authorization, quotas or security controls;</li>
          <li>interfere with the service, scrape it at scale, or overload infrastructure;</li>
          <li>upload malware or content designed to compromise systems or data.</li>
        </ul>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy and Data Protection",
    children: (
      <>
        <p>
          The Dockout Privacy Policy explains how personal data is handled. Where an
          organization determines why and how team content is processed, that organization
          is responsible for its own notices, permissions and lawful basis. Dockout will
          process that content to provide the service and follow lawful instructions.
        </p>
        <p>
          If GDPR or similar data protection law applies, both sides will cooperate
          reasonably on data subject requests, security incidents and required compliance
          measures.
        </p>
      </>
    ),
  },
  {
    id: "subscriptions",
    title: "Subscriptions and Payment",
    children: (
      <>
        <p>
          Some features require a paid plan. Prices, quotas and included features are
          shown in the product or checkout flow. Payments, invoices and payment methods
          may be handled by third-party payment providers.
        </p>
        <p>
          Unless stated otherwise during checkout, subscriptions renew until cancelled.
          Cancelling stops future renewals but does not automatically refund prior
          periods. Nothing in these terms limits any mandatory refund or cancellation
          right that applies under law.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and Changes",
    children: (
      <>
        <p>
          We aim to keep Dockout reliable, but the service may be unavailable because of
          maintenance, provider outages, security work or events outside reasonable
          control. We may update, add or remove features as the product evolves.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and Termination",
    children: (
      <>
        <p>
          You may stop using Dockout at any time. We may suspend or terminate access when
          necessary to protect the service, comply with law, prevent misuse, address
          non-payment, or respond to serious violations of these terms.
        </p>
        <p>
          Where reasonable and lawful, we will provide notice and a chance to resolve the
          issue before suspension or termination.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    children: (
      <>
        <p>
          Dockout is provided with reasonable care and skill. To the extent permitted by
          law, we are not responsible for indirect losses, lost profits, loss of goodwill,
          or losses caused by inaccurate data entered by users, third-party services, or
          events outside our reasonable control.
        </p>
        <p>
          These terms do not exclude or limit liability that cannot be excluded or
          limited under applicable law, including mandatory consumer rights where they
          apply.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    children: (
      <>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:billing@dockout.app">billing@dockout.app</a>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      subtitle="Clear terms for using Dockout as a sailing data workspace for teams and organizations."
      lastUpdated={LAST_UPDATED}
      sections={TERMS_SECTIONS}
    />
  );
}
