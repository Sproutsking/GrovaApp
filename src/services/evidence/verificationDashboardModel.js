const SECTION_ORDER = ["bio", "socials", "portfolio", "reports", "comments", "replies", "likes"];

const getProofLabel = (item = {}) => {
  const proofType = item?.metadata?.proofType || item?.metadata?.proof_type || item?.provider;
  const verificationLevel = item?.metadata?.verificationLevel || item?.metadata?.verification_level;

  if (proofType === "email") return "Email verification";
  if (proofType === "phone") return "Phone verification";
  if (proofType === "wallet") return "Wallet ownership";
  if (proofType === "social") return "Social ownership";
  if (proofType === "credential") return "Credential attestation";
  if (verificationLevel === "high") return "High-trust evidence";
  return item?.provider ? `${item.provider} proof` : "Verified evidence";
};

const normalizeSectionItems = (items = [], sectionId) => {
  if (!Array.isArray(items)) return [];

  const normalized = items
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      title: item.title || item.external_id || item.evidence_type || "Evidence",
      summary: item.summary || item.description || "No description available.",
      provider: item.provider || "unknown",
      evidence_type: item.evidence_type || item.type || "profile",
      verified: Boolean(item.verified),
      confidence: item.confidence || "medium",
      source: item.source || "connector",
      metadata: item.metadata || {},
      proofLabel: getProofLabel(item),
      verificationLevel: item?.metadata?.verificationLevel || item?.metadata?.verification_level || null,
      url: item.url || null,
      created_at: item.created_at || item.createdAt || null,
    }));

  if (sectionId === "socials") {
    return normalized
      .filter((item) => item.provider || item.evidence_type === "profile")
      .sort((a, b) => Number(b.verified) - Number(a.verified));
  }

  return normalized.sort((a, b) => {
    if (a.verified === b.verified) return 0;
    return a.verified ? -1 : 1;
  });
};

export function buildVerificationDashboardSections(items = [], context = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const profileItems = safeItems.filter((item) => {
    const type = item?.evidence_type || item?.type;
    return type === "profile" || type === "identity" || type === "verification";
  });
  const socialItems = safeItems.filter((item) => item?.provider && ["profile", "activity", "comment", "reply", "like", "report"].includes(item?.evidence_type) === false);
  const portfolioItems = safeItems.filter((item) => item?.metadata?.kind === "portfolio" || item?.evidence_type === "portfolio");
  const reportItems = safeItems.filter((item) => item?.evidence_type === "report" || item?.metadata?.kind === "report");
  const commentItems = safeItems.filter((item) => item?.evidence_type === "comment" || item?.metadata?.kind === "comment");
  const replyItems = safeItems.filter((item) => item?.evidence_type === "reply" || item?.metadata?.kind === "reply");
  const likeItems = safeItems.filter((item) => item?.evidence_type === "like" || item?.metadata?.kind === "like");

  const sections = [
    {
      id: "bio",
      title: "Bio",
      subtitle: "Identity proof and narrative context",
      accent: "#84cc16",
      items: normalizeSectionItems(profileItems.slice(0, 3), "bio"),
      summary: context.username ? `Verified identity summary for @${context.username}` : "Verified identity summary",
    },
    {
      id: "socials",
      title: "Socials",
      subtitle: "Connected platforms and verified identities",
      accent: "#60a5fa",
      items: normalizeSectionItems(safeItems.filter((item) => item?.provider && item?.evidence_type !== "report" && item?.evidence_type !== "comment" && item?.evidence_type !== "reply" && item?.evidence_type !== "like"), "socials"),
      summary: `${safeItems.filter((item) => item?.verified).length} verified signals across connected platforms`,
    },
    {
      id: "portfolio",
      title: "Portfolio",
      subtitle: "Work, projects, and client-facing proof",
      accent: "#a78bfa",
      items: normalizeSectionItems(portfolioItems.length ? portfolioItems : safeItems.filter((item) => item?.metadata?.kind === "project"), "portfolio"),
      summary: portfolioItems.length ? "Portfolio evidence collected from connected activity" : "Portfolio view ready for project evidence",
    },
    {
      id: "reports",
      title: "Reports",
      subtitle: "Track records and client-facing accountability",
      accent: "#f59e0b",
      items: normalizeSectionItems(reportItems, "reports"),
      summary: reportItems.length ? "Accountability evidence and delivery reports" : "Reports section is ready for verifiable outcomes",
    },
    {
      id: "comments",
      title: "Comments",
      subtitle: "Conversation history and public commentary",
      accent: "#f472b6",
      items: normalizeSectionItems(commentItems, "comments"),
      summary: commentItems.length ? "Comment history aggregated from connected sources" : "Comments panel will populate when evidence is available",
    },
    {
      id: "replies",
      title: "Replies",
      subtitle: "Responses, reactions, and follow-up interactions",
      accent: "#38bdf8",
      items: normalizeSectionItems(replyItems, "replies"),
      summary: replyItems.length ? "Replies connected to the broader evidence graph" : "Replies panel will populate with engagement evidence",
    },
    {
      id: "likes",
      title: "Likes",
      subtitle: "Signals of interest and content affinity",
      accent: "#fb923c",
      items: normalizeSectionItems(likeItems, "likes"),
      summary: likeItems.length ? "Likes mapped to content and social context" : "Likes panel will populate as activity evidence arrives",
    },
  ];

  return sections.sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));
}
