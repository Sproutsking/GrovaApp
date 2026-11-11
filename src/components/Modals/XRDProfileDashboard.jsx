import React, { useMemo } from "react";
import VerificationDashboardPage from "./VerificationDashboardPage";
import { buildPublicProfileDashboard } from "../../services/evidence/publicProfileDashboardModel";

const XRDProfileDashboard = ({
  profile,
  dashboard: providedDashboard,
  verificationItems = [],
  publicSnapshot,
  publicLinks = [],
  isOwner = false,
  forcePublicView = false,
  ...pageProps
}) => {
  const dashboard = useMemo(() => {
    const generated = providedDashboard || buildPublicProfileDashboard(profile, verificationItems, {
      isOwner: isOwner && !forcePublicView,
    });
    const links = publicLinks.length ? publicLinks : Array.isArray(publicSnapshot?.links) ? publicSnapshot.links : [];
    if (!links.length) return generated;

    const sectionIds = { social: "socials", portfolio: "portfolio", report: "reports" };
    return {
      ...generated,
      sections: generated.sections.map((section) => ({
        ...section,
        items: [
          ...section.items,
          ...links
            .filter((link) => sectionIds[link.category] === section.id && link.visibility === "public")
            .map((link) => ({
              id: link.id,
              title: link.label,
              provider: link.category,
              evidence_type: link.category,
              summary: link.url,
              url: link.url,
              verified: false,
              proofLabel: "Public link",
            })),
        ],
      })),
    };
  }, [providedDashboard, profile, verificationItems, isOwner, forcePublicView, publicLinks, publicSnapshot?.links]);

  return (
    <VerificationDashboardPage
      profile={profile}
      dashboard={dashboard}
      verificationItems={verificationItems}
      {...pageProps}
    />
  );
};

export default XRDProfileDashboard;
