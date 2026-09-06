import React, { useState } from "react";
import { ChevronRight, Folder } from "lucide-react";

export const CATEGORY_FOLDER_STYLES = [
  { id: "simple",       label: "Simple label" },
  { id: "boxed",        label: "Boxed folder" },
  { id: "accent-tab",   label: "Accent tab" },
  { id: "divider-line", label: "Divider line" },
];

export default function CategoryGroup({ name, folderStyle = "simple", collapsible = true, draggable = false, onDragStart, onDragOver, onDrop, onContextMenu, children }) {
  const [open, setOpen] = useState(true);
  const handleContextMenu = (event) => {
    event.stopPropagation();
    onContextMenu?.(event);
  };
  return (
    <div className={`cfg cfg--${folderStyle}`} draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onContextMenu={handleContextMenu}>
      <button type="button" className="cfg-head" onClick={() => collapsible && setOpen((o) => !o)}>
        {folderStyle === "boxed" && <Folder size={11} />}
        <span>{name}</span>
        {collapsible && <ChevronRight size={12} className={`cfg-chevron${open ? " open" : ""}`} />}
      </button>
      {open && <div className="cfg-body">{children}</div>}
      <style>{`
        .cfg{box-sizing:border-box;flex:0 0 auto;width:100%;min-width:0;margin-bottom:6px;border:1px solid rgba(255,255,255,.05);border-radius:14px;background:linear-gradient(180deg, rgba(11,16,12,.7), rgba(12,18,14,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.03);overflow:visible}
        .cfg-head{width:100%;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.018);border:none;cursor:pointer;padding:10px 12px;font-family:inherit;color:rgba(255,255,255,.54);font-size:9px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}
        .cfg-chevron{margin-left:auto;transition:transform .15s;opacity:.6}
        .cfg-chevron.open{transform:rotate(90deg)}
        .cfg-body{display:flex;flex:0 0 auto;flex-direction:column;gap:4px;min-width:0;padding:6px 6px 8px}
        .cfg--boxed{border-color:rgba(156,255,0,.16);background:linear-gradient(180deg, rgba(156,255,0,.04), rgba(17,22,18,.82));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
        .cfg--boxed .cfg-head{color:rgba(156,255,0,.82);padding:9px 10px;background:rgba(156,255,0,.04)}
        .cfg--accent-tab .cfg-head{position:relative;padding-left:14px}
        .cfg--accent-tab .cfg-head::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:3px;height:12px;border-radius:2px;background:var(--accent)}
        .cfg--divider-line{border-top:1px solid rgba(255,255,255,.06);padding-top:6px;margin-top:6px}
      `}</style>
    </div>
  );
}