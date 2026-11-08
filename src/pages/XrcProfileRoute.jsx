import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, LoaderCircle } from "lucide-react";
import XRDProfileDashboard, { resolveXrcInitialSection } from "../components/Modals/XRDProfileDashboard";
import { supabase } from "../services/config/supabase";
import { getPublicXrdShare } from "../services/evidence/xrdPublicShareService";

const XrcProfileRoute = ({ username, currentUser }) => {
  const [profile, setProfile] = useState(null);
  const [publicSnapshot, setPublicSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const requestedProfileId = params.get("profileId");
  const initialSection = resolveXrcInitialSection(params.get("section") || "Overview");
  const xrdRecordId = params.get("xrdRecordId");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const handle = String(username || "").replace(/^@+/, "");
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,username,bio,avatar_id")
          .eq("username", handle)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!data) {
          setError("This XRC profile could not be found.");
          return;
        }
        if (requestedProfileId && requestedProfileId !== data.id) {
          setError("The XRC link does not match the requested profile.");
          return;
        }

        const owner = String(currentUser?.id || "") === String(data.id);
        const share = owner ? null : await getPublicXrdShare(data.username);
        if (!owner && !share) {
          setError("This profile has no public XRD share available.");
          return;
        }
        if (!active) return;
        setProfile({
          id: data.id,
          fullName: data.full_name,
          username: data.username,
          bio: data.bio || "",
          avatarId: data.avatar_id || null,
        });
        setPublicSnapshot(share);
      } catch (loadError) {
        console.error("[XRC] Could not load the profile provenance view:", loadError);
        if (active) setError(loadError?.message || "XRC provenance could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [currentUser?.id, requestedProfileId, username]);

  const close = () => {
    if (profile?.username) {
      window.location.assign(`/xrd/${encodeURIComponent(profile.username)}`);
    } else {
      window.location.assign("/");
    }
  };

  if (loading) {
    return <main className="xrd-share-state" role="status"><LoaderCircle size={20} />Loading authenticated XRC provenance…</main>;
  }
  if (error || !profile) {
    return (
      <main className="xrd-share-state" role="alert">
        <AlertTriangle size={20} />
        <div><strong>XRC provenance unavailable</strong><p>{error || "This profile could not be loaded."}</p></div>
        <button type="button" onClick={close}><ArrowLeft size={14} /> Back to XRD</button>
        <style>{`.xrd-share-state{min-height:100dvh;display:flex;align-items:center;justify-content:center;gap:12px;padding:24px;background:#030403;color:#e8eee4;font:14px ui-sans-serif,system-ui}.xrd-share-state>svg{flex:none;color:#fbbf24}.xrd-share-state p{color:#969f91}.xrd-share-state button{display:inline-flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid #30372e;border-radius:9px;background:#080b08;color:#cfe8b8;cursor:pointer}`}</style>
      </main>
    );
  }

  return (
    <XRDProfileDashboard
      profile={profile}
      currentUser={currentUser}
      targetId={profile.id}
      verificationItems={publicSnapshot?.evidenceItems || []}
      publicSnapshot={publicSnapshot}
      mode="xrc"
      initialSection={initialSection}
      xrdRecordId={xrdRecordId}
      onClose={close}
    />
  );
};

export default XrcProfileRoute;
