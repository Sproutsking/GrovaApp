// src/components/Distribution/DistributionStatus.jsx
// ============================================================================
// DistributionStatus — v2
// Dark-themed to match Xeevia's design system. All previous logic preserved.
// Polled every 5s while the component is mounted and postId is provided.
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle, AlertCircle, Clock, RefreshCw, ExternalLink, Copy, Loader,
} from "lucide-react";
import distributionService from "../../services/distribution/distributionService";
import { PLATFORMS } from "../Account/IdentitySection";

const CSS = `
  @keyframes dsIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes dsSpin { to{transform:rotate(360deg)} }
  @keyframes dsPulse{ 0%,100%{opacity:1} 50%{opacity:.4} }

  .dsWrap {
    margin-top:16px;
    background:rgba(255,255,255,.025);
    border:1px solid rgba(255,255,255,.07);
    border-radius:18px; overflow:hidden;
    animation:dsIn .3s ease both;
  }

  .dsHeader {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 16px; border-bottom:1px solid rgba(255,255,255,.06);
    flex-wrap:wrap; gap:10px;
  }
  .dsTitle {
    font-size:13px; font-weight:800; color:#d4d4d4;
    display:flex; align-items:center; gap:7px;
  }
  .dsBadges { display:flex; gap:7px; flex-wrap:wrap; }
  .dsBadge {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 9px; border-radius:20px; font-size:11px; font-weight:700;
  }
  .dsBadge.ok  { background:rgba(132,204,22,.1);  color:#84cc16; border:1px solid rgba(132,204,22,.2); }
  .dsBadge.err { background:rgba(239,68,68,.1);   color:#f87171; border:1px solid rgba(239,68,68,.2); }
  .dsBadge.pnd { background:rgba(245,158,11,.1);  color:#fbbf24; border:1px solid rgba(245,158,11,.2); }

  .dsList { display:flex; flex-direction:column; }
  .dsPlatformRow {
    display:flex; align-items:center; gap:12px;
    padding:13px 16px; border-bottom:1px solid rgba(255,255,255,.04);
    transition:background .15s;
  }
  .dsPlatformRow:last-child { border-bottom:none; }
  .dsPlatformRow:hover { background:rgba(255,255,255,.02); }

  .dsPDot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .dsPName { font-size:13px; font-weight:700; color:#d4d4d4; flex:1; }
  .dsPStatus {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px; border-radius:20px; font-size:11px; font-weight:700;
  }
  .dsPStatus.ok  { background:rgba(132,204,22,.1);  color:#84cc16; }
  .dsPStatus.err { background:rgba(239,68,68,.1);   color:#f87171; }
  .dsPStatus.pnd { background:rgba(245,158,11,.1);  color:#fbbf24; animation:dsPulse 1.6s ease-in-out infinite; }

  .dsDetails {
    padding:0 16px 13px 38px;
    display:flex; flex-direction:column; gap:7px;
  }
  .dsPostId {
    display:flex; align-items:center; gap:7px;
    font-size:11px; color:#454545; flex-wrap:wrap;
  }
  .dsPostId code {
    background:rgba(0,0,0,.35); border-radius:5px; padding:2px 7px;
    font-family:monospace; font-size:10.5px; color:#84cc16; word-break:break-all;
  }
  .dsCopyBtn {
    background:none; border:1px solid rgba(255,255,255,.1);
    border-radius:5px; padding:3px 6px; cursor:pointer; color:#454545;
    transition:border-color .14s, color .14s; display:flex; align-items:center;
  }
  .dsCopyBtn:hover { border-color:rgba(255,255,255,.25); color:#a3a3a3; }
  .dsPublishedAt { font-size:10.5px; color:#3a3a3a; }
  .dsViewBtn {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 10px; border-radius:7px; font-size:11px; font-weight:700;
    background:rgba(132,204,22,.1); border:1px solid rgba(132,204,22,.25);
    color:#84cc16; text-decoration:none; transition:background .14s; width:fit-content;
  }
  .dsViewBtn:hover { background:rgba(132,204,22,.18); }

  .dsErrMsg {
    display:flex; align-items:flex-start; gap:7px;
    padding:8px 10px; background:rgba(239,68,68,.06);
    border-radius:7px; font-size:11.5px; color:#f87171;
  }
  .dsRetryBtn {
    display:inline-flex; align-items:center; gap:6px;
    padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:700;
    background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25);
    color:#f87171; cursor:pointer; font-family:inherit; transition:background .14s;
    width:fit-content;
  }
  .dsRetryBtn:hover:not(:disabled) { background:rgba(239,68,68,.15); }
  .dsRetryBtn:disabled { opacity:.45; cursor:not-allowed; }

  .dsSuccess {
    display:flex; align-items:center; gap:12px;
    padding:14px 16px; border-top:1px solid rgba(132,204,22,.12);
    background:rgba(132,204,22,.04);
  }
  .dsSuccessText h4 { font-size:13px; font-weight:800; color:#84cc16; margin:0 0 3px; }
  .dsSuccessText p  { font-size:11.5px; color:#525252; margin:0; }

  .dsLoading {
    display:flex; align-items:center; gap:10px;
    padding:16px; font-size:12px; color:#454545;
  }
  .dsSpin { animation:dsSpin .9s linear infinite; }
`;

const PLATFORM_COLORS = {
  x: "#e2e2e2", facebook: "#5b9ef9",
  instagram: "#f472b6", linkedin: "#60a5fa",
};

const DistributionStatus = ({ postId, isVisible = true }) => {
  const [status,   setStatus]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [retrying, setRetrying] = useState(null);
  const [copied,   setCopied]   = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isVisible || !postId) return;

    const fetch = async () => {
      try {
        const result = await distributionService.getDistributionStatus(postId);
        setStatus(result);
      } catch (e) {
        console.warn("[DistributionStatus]", e?.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    intervalRef.current = setInterval(fetch, 5000);
    return () => clearInterval(intervalRef.current);
  }, [postId, isVisible]);

  const handleRetry = async (platform) => {
    setRetrying(platform);
    try {
      await distributionService.retryFailedDistribution(postId, platform);
      const result = await distributionService.getDistributionStatus(postId);
      setStatus(result);
    } catch (e) {
      console.error("[DistributionStatus] retry:", e?.message);
    } finally {
      setRetrying(null);
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isVisible || !postId) return null;

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="dsWrap">
        <div className="dsLoading">
          <Loader size={14} className="dsSpin" color="#525252" />
          Checking distribution status…
        </div>
      </div>
    </>
  );

  if (!status) return null;

  const { total, successful, failed, pending, byPlatform } = status;
  const allDone = pending === 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="dsWrap">

        {/* Header */}
        <div className="dsHeader">
          <span className="dsTitle">
            Distribution Status
          </span>
          <div className="dsBadges">
            {successful > 0 && (
              <span className="dsBadge ok">
                <CheckCircle size={11} /> {successful} Published
              </span>
            )}
            {failed > 0 && (
              <span className="dsBadge err">
                <AlertCircle size={11} /> {failed} Failed
              </span>
            )}
            {pending > 0 && (
              <span className="dsBadge pnd">
                <Clock size={11} /> {pending} Pending
              </span>
            )}
          </div>
        </div>

        {/* Platform rows */}
        <div className="dsList">
          {Object.entries(byPlatform).map(([platform, ps]) => {
            const meta  = PLATFORMS[platform];
            const dot   = ps.status === "success" ? "#84cc16"
                        : ps.status === "failed"  ? "#ef4444" : "#f59e0b";
            const sc    = ps.status === "success" ? "ok"
                        : ps.status === "failed"  ? "err" : "pnd";

            return (
              <div key={platform}>
                <div className="dsPlatformRow">
                  <div className="dsPDot" style={{ background: PLATFORM_COLORS[platform] || dot }} />
                  <span className="dsPName">{meta?.name || platform}</span>
                  <span className={`dsPStatus ${sc}`}>
                    {ps.status === "success" && <><CheckCircle size={11} /> Published</>}
                    {ps.status === "failed"  && <><AlertCircle size={11} /> Failed</>}
                    {ps.status === "pending" && <><Clock size={11} /> Pending…</>}
                  </span>
                </div>

                {ps.status === "success" && (
                  <div className="dsDetails">
                    {ps.externalPostId && (
                      <div className="dsPostId">
                        <span>Post ID:</span>
                        <code>{ps.externalPostId}</code>
                        <button className="dsCopyBtn" onClick={() => copy(ps.externalPostId)}>
                          {copied === ps.externalPostId
                            ? <CheckCircle size={11} color="#84cc16" />
                            : <Copy size={11} />}
                        </button>
                      </div>
                    )}
                    {ps.publishedAt && (
                      <span className="dsPublishedAt">
                        Published {new Date(ps.publishedAt).toLocaleString()}
                      </span>
                    )}
                    <a
                      href={`https://${platform}.com`}
                      target="_blank" rel="noopener noreferrer"
                      className="dsViewBtn"
                    >
                      <ExternalLink size={11} /> View on {meta?.name || platform}
                    </a>
                  </div>
                )}

                {ps.status === "failed" && (
                  <div className="dsDetails">
                    {ps.error && (
                      <div className="dsErrMsg">
                        <AlertCircle size={12} style={{ flexShrink:0, marginTop:1 }} />
                        {ps.error}
                      </div>
                    )}
                    <button
                      className="dsRetryBtn"
                      onClick={() => handleRetry(platform)}
                      disabled={retrying === platform}
                    >
                      {retrying === platform
                        ? <><Loader size={11} className="dsSpin" /> Retrying…</>
                        : <><RefreshCw size={11} /> Retry</>}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All done */}
        {allDone && failed === 0 && successful > 0 && (
          <div className="dsSuccess">
            <CheckCircle size={18} color="#84cc16" style={{ flexShrink:0 }} />
            <div className="dsSuccessText">
              <h4>All platforms updated</h4>
              <p>Your post is live across {successful} platform{successful !== 1 ? "s" : ""}.</p>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default DistributionStatus;