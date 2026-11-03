import xrcService, { STREAM_TYPES } from "../xrc";
import { supabase } from "../config/supabase";

const SNAPSHOT_FIELDS = ["title", "summary", "url", "external_id", "evidence_type"];

export const compareEvidenceSnapshot = (previous, current) => {
  if (!current) return { resultStatus: "not_found", changedFields: [] };
  const changedFields = SNAPSHOT_FIELDS.filter((field) => String(previous?.[field] ?? "") !== String(current?.[field] ?? ""));
  return { resultStatus: changedFields.length ? "changed" : "matched", changedFields };
};

export function createXrdRecordService(supabase, recordService = xrcService) {
  const appendXrcEvent = async ({ profileId, eventType, entityType, entityId, streamType }) => {
    if (!recordService?.writeRecord) return { skipped: true, reason: "xrc-writer-unavailable" };
    return recordService.writeRecord(streamType, {
      event: eventType,
      entity_type: entityType,
      entity_id: entityId,
    }, profileId);
  };

  const appendAuditEvent = async ({ profileId, actorId, eventType, entityType, entityId, details = {}, streamType }) => {
    const { data, error } = await supabase.from("xrd_audit_events").insert({
      profile_id: profileId,
      actor_id: actorId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: String(entityId),
      details,
    }).select().single();
    if (error) throw error;

    const xrc = await appendXrcEvent({ profileId, eventType, entityType, entityId, streamType });
    return { event: data, xrc };
  };

  const listClaims = async (profileId, { includePrivateChecks = false } = {}) => {
    const { data: records, error } = await supabase.from("xrd_records")
      .select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    if (!records?.length) return [];

    const ids = records.map((record) => record.id);
    const [linksResult, checksResult, auditResult] = await Promise.all([
      supabase.from("xrd_record_evidence").select("*").in("record_id", ids).order("created_at", { ascending: true }),
      includePrivateChecks
        ? supabase.from("xrd_source_check_runs").select("*").in("record_id", ids).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from("xrd_audit_events").select("*").eq("profile_id", profileId).eq("entity_type", "xrd_record").in("entity_id", ids).order("created_at", { ascending: false }),
    ]);
    if (linksResult.error) throw linksResult.error;
    if (checksResult.error) throw checksResult.error;
    if (auditResult.error) throw auditResult.error;

    const linksByRecord = new Map();
    (linksResult.data || []).forEach((link) => {
      const current = linksByRecord.get(link.record_id) || [];
      current.push(link);
      linksByRecord.set(link.record_id, current);
    });
    const checksByRecord = new Map();
    (checksResult.data || []).forEach((run) => {
      if (!checksByRecord.has(run.record_id)) checksByRecord.set(run.record_id, run);
    });
    const auditByRecord = new Map();
    (auditResult.data || []).forEach((event) => {
      if (!auditByRecord.has(event.entity_id)) auditByRecord.set(event.entity_id, event);
    });

    return records.map((record) => ({
      ...record,
      evidence_links: linksByRecord.get(record.id) || [],
      latest_source_check: checksByRecord.get(record.id) || null,
      latest_audit_event: auditByRecord.get(record.id) || null,
    }));
  };

  const createClaim = async ({ profileId, actorId, recordType, title, claimText, structuredClaim = {}, visibility = "private" }) => {
    const { data, error } = await supabase.from("xrd_records").insert({
      profile_id: profileId,
      created_by: actorId,
      record_type: recordType,
      title: title.trim(),
      claim_text: claimText.trim(),
      structured_claim: structuredClaim,
      lifecycle_status: "published",
      visibility,
    }).select().single();
    if (error) throw error;
    const audit = await appendAuditEvent({
      profileId, actorId, eventType: "xrd_claim_created", entityType: "xrd_record", entityId: data.id,
      details: { record_type: recordType, visibility }, streamType: STREAM_TYPES.XCRC,
    });
    return { ...data, audit };
  };

  const linkEvidence = async ({ profileId, actorId, recordId, evidenceId, relation = "supports" }) => {
    const { data, error } = await supabase.from("xrd_record_evidence").upsert({
      record_id: recordId,
      evidence_item_id: evidenceId,
      relation,
      created_by: actorId,
    }, { onConflict: "record_id,evidence_item_id,relation" }).select().single();
    if (error) throw error;
    const audit = await appendAuditEvent({
      profileId, actorId, eventType: `xrd_evidence_${relation}`, entityType: "xrd_record", entityId: recordId,
      details: { evidence_item_id: evidenceId, relation }, streamType: STREAM_TYPES.XCRC,
    });
    return { ...data, audit };
  };

  const createIdentityBinding = async ({ profileId, connection, evidenceId }) => {
    const { data: existing, error: existingError } = await supabase.from("xrd_identity_bindings")
      .select("*").eq("profile_id", profileId).eq("connection_id", connection.id)
      .in("status", ["claimed", "pending", "bound", "verified"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;

    const bindingMethod = connection.connected_via === "oauth_popup" ? "oauth_popup"
      : connection.connected_via === "profile_link" ? "profile_link"
        : "supabase_identity";
    const row = {
      profile_id: profileId,
      connection_id: connection.id,
      provider: connection.provider,
      external_subject_id: connection.platform_user_id,
      binding_method: bindingMethod,
      assurance_scope: bindingMethod === "profile_link" ? "profile_reference" : "account_control",
      status: bindingMethod === "profile_link" ? "claimed" : "bound",
      visibility: "private",
      evidence_id: evidenceId || null,
    };
    const { data, error } = await supabase.from("xrd_identity_bindings").insert(row).select().single();
    if (error) throw error;
    const audit = await appendAuditEvent({
      profileId, actorId: profileId, eventType: "identity_binding_created", entityType: "identity_binding", entityId: data.id,
      details: { provider: connection.provider, method: bindingMethod, assurance_scope: row.assurance_scope }, streamType: STREAM_TYPES.XARC,
    });
    return { ...data, audit };
  };

  const listIdentityBindings = async (profileId, { includePrivateDetails = false } = {}) => {
    const { data, error } = await supabase.from("xrd_identity_bindings")
      .select(includePrivateDetails
        ? "*"
        : "id,provider,binding_method,assurance_scope,status,visibility,evidence_id,created_at,updated_at,revoked_at")
      .eq("profile_id", profileId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  };

  const revokeIdentityBindings = async ({ profileId, connection }) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("xrd_identity_bindings")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("profile_id", profileId).eq("connection_id", connection.id)
      .in("status", ["claimed", "pending", "bound", "verified"])
      .select();
    if (error) throw error;
    const audit = await appendAuditEvent({
      profileId, actorId: profileId, eventType: "identity_binding_revoked", entityType: "connection", entityId: connection.id,
      details: { provider: connection.provider, preserved_evidence: true }, streamType: STREAM_TYPES.XARC,
    });
    return { bindings: data || [], audit };
  };

  const saveSourceCheck = async ({ profileId, actorId, recordId, evidenceId, provider, resultStatus, changedFields, startedAt, summary }) => {
    const completedAt = new Date().toISOString();
    const { data, error } = await supabase.from("xrd_source_check_runs").insert({
      profile_id: profileId,
      record_id: recordId || null,
      evidence_item_id: evidenceId || null,
      provider,
      method: "connector_snapshot_comparison",
      run_status: resultStatus === "unavailable" ? "failed" : "completed",
      result_status: resultStatus,
      checked_fields: changedFields || [],
      summary,
      started_at: startedAt,
      completed_at: completedAt,
      initiated_by: actorId,
    }).select().single();
    if (error) throw error;
    const audit = await appendAuditEvent({
      profileId, actorId, eventType: "source_check_completed", entityType: "source_check_run", entityId: data.id,
      details: { provider, result_status: resultStatus, record_id: recordId || null, evidence_item_id: evidenceId || null },
      streamType: STREAM_TYPES.XSRC,
    });
    return { ...data, audit };
  };

  return { listClaims, listIdentityBindings, createClaim, linkEvidence, createIdentityBinding, revokeIdentityBindings, saveSourceCheck, appendAuditEvent };
}

const xrdRecordService = createXrdRecordService(supabase, xrcService);

export default xrdRecordService;