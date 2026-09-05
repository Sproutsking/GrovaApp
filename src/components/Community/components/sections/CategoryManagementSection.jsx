import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FolderPlus, Pencil, Shield, Trash2 } from "lucide-react";
import { supabase } from "../../../../services/config/supabase";
import ChannelPermissionsModal from "../../modals/ChannelPermissionsModal";
import permissionService from "../../../../services/community/permissionService";

export default function CategoryManagementSection({ communityId, onChanged }) {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState([]);
  const [permissionCategory, setPermissionCategory] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.from("community_channel_categories").select("id,name,position").eq("community_id", communityId).order("position", { ascending: true });
    if (loadError) setError(loadError.message);
    setCategories(data || []);
    setLoading(false);
  };

  useEffect(() => { if (communityId) load(); }, [communityId]);
  useEffect(() => {
    if (!communityId) return;
    permissionService.fetchRoles(communityId).then((data) => setRoles(data || [])).catch(() => setRoles([]));
  }, [communityId]);

  const persist = async (next) => {
    setCategories(next);
    setSaving(true);
    const results = await Promise.all(next.map((category, position) => supabase.from("community_channel_categories").update({ position, updated_at: new Date().toISOString() }).eq("id", category.id)));
    const failed = results.find((result) => result.error);
    if (failed) setError(failed.error.message);
    setSaving(false);
    onChanged?.();
  };

  const create = async (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setSaving(true);
    const { error: createError } = await supabase.from("community_channel_categories").insert({ community_id: communityId, name: clean, position: categories.length });
    if (createError) setError(createError.message); else { setName(""); await load(); onChanged?.(); }
    setSaving(false);
  };

  const rename = async (category) => {
    const nextName = window.prompt("Category name", category.name)?.trim();
    if (!nextName || nextName === category.name) return;
    const { error: renameError } = await supabase.from("community_channel_categories").update({ name: nextName, updated_at: new Date().toISOString() }).eq("id", category.id);
    if (!renameError) await supabase.from("community_channels").update({ category: nextName, updated_at: new Date().toISOString() }).eq("community_id", communityId).eq("category", category.name);
    if (renameError) setError(renameError.message); else { await load(); onChanged?.(); }
  };

  const remove = async (category) => {
    if (category.name === "Welcome") return;
    if (!window.confirm(`Move channels to Welcome and remove ${category.name}?`)) return;
    setSaving(true);
    const { error: channelError } = await supabase.from("community_channels").update({ category: "Welcome", updated_at: new Date().toISOString() }).eq("community_id", communityId).eq("category", category.name);
    const { error: deleteError } = await supabase.from("community_channel_categories").delete().eq("id", category.id);
    if (channelError || deleteError) setError((channelError || deleteError).message); else { await load(); onChanged?.(); }
    setSaving(false);
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    await persist(next);
  };

  return (
    <section className="category-management-section">
      <div className="category-management-intro"><strong>Manage Categories</strong><span>Create, rename, reorder, and remove channel groups without changing the channels inside them.</span></div>
      <form className="category-create-row" onSubmit={create}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="New category name" maxLength={50} /><button type="submit" disabled={saving || !name.trim()}><FolderPlus size={15} /> Add</button></form>
      {loading ? <p className="category-management-muted">Loading categories...</p> : categories.map((category, index) => <div className="category-management-row" key={category.id}><span className="category-management-name">{category.name}</span><button type="button" title="Manage category permissions" disabled={saving} onClick={() => setPermissionCategory(category)}><Shield size={14} /></button><button type="button" title="Move up" disabled={index === 0 || saving} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" title="Move down" disabled={index === categories.length - 1 || saving} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" title="Rename" disabled={saving} onClick={() => rename(category)}><Pencil size={14} /></button><button type="button" title="Remove" disabled={category.name === "Welcome" || saving} onClick={() => remove(category)}><Trash2 size={14} /></button></div>)}
      {error && <p className="category-management-error">{error}</p>}
      {permissionCategory && <ChannelPermissionsModal category={permissionCategory} communityId={communityId} roles={roles} onClose={() => setPermissionCategory(null)} onSave={onChanged} />}
      <style>{`.category-management-section{padding:12px;display:flex;flex-direction:column;gap:8px}.category-management-intro{display:flex;flex-direction:column;gap:4px;padding:4px 2px 10px}.category-management-intro strong{font-size:16px;color:var(--text)}.category-management-intro span{font-size:11px;line-height:1.5;color:var(--text-secondary)}.category-create-row{display:flex;gap:7px}.category-create-row input{min-width:0;flex:1;padding:10px 11px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface);color:var(--text);outline:none}.category-create-row button,.category-management-row button{display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--accent-border);border-radius:8px;background:var(--accent-bg);color:var(--accent);cursor:pointer}.category-create-row button{padding:0 11px;font:800 11px inherit}.category-management-row{display:flex;align-items:center;gap:5px;padding:9px;border:1px solid var(--surface-border);border-radius:9px;background:var(--surface)}.category-management-name{flex:1;color:var(--text);font-size:12px;font-weight:800}.category-management-row button{width:28px;height:28px}.category-management-row button:disabled,.category-create-row button:disabled{opacity:.35;cursor:not-allowed}.category-management-muted,.category-management-error{margin:2px;color:var(--text-secondary);font-size:11px}.category-management-error{color:var(--danger)}`}</style>
    </section>
  );
}