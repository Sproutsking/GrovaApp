import React, { useState } from "react";
import { ChevronRight, Folder } from "lucide-react";

export const CATEGORY_FOLDER_STYLES = [
  { id: "simple",       label: "Simple label" },
  { id: "boxed",        label: "Boxed folder" },
  { id: "accent-tab",   label: "Accent tab" },
  { id: "divider-line", label: "Divider line" },
];

export default function CategoryGroup({ name, folderStyle = "simple", collapsible = true, draggable = false, onDragStart, onDragOver, onDrop, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`cfg cfg--${folderStyle}`} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <button type="button" className="cfg-head" onClick={() => collapsible && setOpen((o) => !o)}>
        {folderStyle === "boxed" && <Folder size={11} />}
        <span>{name}</span>
        {collapsible && <ChevronRight size={12} className={`cfg-chevron${open ? " open" : ""}`} />}
      </button>
      {open && <div className="cfg-body">{children}</div>}
      <style>{`
        .cfg{margin-bottom:6px}
        .cfg-head{width:100%;display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;padding:8px;font-family:inherit;color:rgba(255,255,255,.38);font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}
        .cfg-chevron{margin-left:auto;transition:transform .15s;opacity:.6}
        .cfg-chevron.open{transform:rotate(90deg)}
        .cfg-body{display:flex;flex-direction:column;gap:4px}
        .cfg--boxed{border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:4px;background:rgba(255,255,255,.015)}
        .cfg--boxed .cfg-head{color:rgba(156,255,0,.7)}
        .cfg--accent-tab .cfg-head{position:relative;padding-left:14px}
        .cfg--accent-tab .cfg-head::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:3px;height:12px;border-radius:2px;background:var(--accent)}
        .cfg--divider-line{border-top:1px solid rgba(255,255,255,.06);padding-top:6px;margin-top:6px}
      `}</style>
    </div>
  );
}