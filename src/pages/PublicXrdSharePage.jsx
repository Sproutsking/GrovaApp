import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, LoaderCircle } from "lucide-react";
import XRDProfileDashboard from "../components/Modals/XRDProfileDashboard";
import { buildXrcDeepLink, getPublicXrdShare } from "../services/evidence/xrdPublicShareService";

const PublicXrdSharePage = ({ username, currentUser }) => {
  const [share, setShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getPublicXrdShare(username)
      .then((result) => {
        if (active) setShare(result);
      })
      .catch((loadError) => {
        console.error("[XRD] Public share could not be loaded:", loadError);
        if (active) setError(loadError?.message || "This public XRD could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [username]);

  const close = () => window.location.assign("/");
  const openXrc = (xrdRecordId, section) => {
    try {
      const path = buildXrcDeepLink({
        username: share.profile.username,
        profileId: share.profile.id,
        section: section || (xrdRecordId ? "Records" : "Overview"),
        xrdRecordId,
      });
      window.location.assign(path);
    } catch (navigationError) {
      console.error("[XRD] Could not open XRC provenance:", navigationError);
      setError(navigationError?.message || "XRC provenance could not be opened.");
    }
  };

  if (loading) {
    return <main className="xrd-share-state" role="status"><LoaderCircle size={20} />Loading public XRD…</main>;
  }
  if (error || !share) {
    return (
      <main className="xrd-share-state" role="alert">
        <AlertTriangle size={20} />
        <div><strong>{share ? "XRD link unavailable" : "Public XRD not found"}</strong><p>{error || "This profile may no longer be available."}</p></div>
        <button type="button" onClick={close}><ArrowLeft size={14} /> Open Xeevia</button>
        <style>{`.xrd-share-state{min-height:100dvh;display:flex;align-items:center;justify-content:center;gap:12px;padding:24px;background:#030403;color:#e8eee4;font:14px ui-sans-serif,system-ui}.xrd-share-state>svg{flex:none;color:#fbbf24}.xrd-share-state p{color:#969f91}.xrd-share-state button{display:inline-flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid #30372e;border-radius:9px;background:#080b08;color:#cfe8b8;cursor:pointer}`}</style>
      </main>
    );
  }

  return (
    <XRDProfileDashboard
      profile={{
        ...share.profile,
        avatarUrl: share.profile.avatarUrl || null,
        avatarId: share.profile.avatarId || share.profile.avatar_id || null,
      }}
      currentUser={currentUser}
      targetId={share.profile.id}
      verificationItems={share.evidenceItems}
      publicSnapshot={share}
      initialSection="Overview"
      onOpenXRC={openXrc}
      onClose={close}
    />
  );
};

export default PublicXrdSharePage;
