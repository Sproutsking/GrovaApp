import React from "react";

const SectionHeader = ({
  icon: Icon,
  iconColor = "#84cc16",
  iconBg = "rgba(132,204,22,.12)",
  iconBorder = "rgba(132,204,22,.25)",
  title,
  subtitle,
  right,
  className = "",
  style = {},
}) => {
  const IconComponent = typeof Icon === "function" ? Icon : null;

  return (
    <div className={`sh-root${className ? ` ${className}` : ""}`} style={style}>
      <div className="sh-left">
        {IconComponent && (
          <div className="sh-icon" style={{ background: iconBg, borderColor: iconBorder }}>
            <IconComponent size={16} color={iconColor} />
          </div>
        )}
        <div className="sh-text">
          <span className="sh-title">{title}</span>
          {subtitle && <span className="sh-subtitle">{subtitle}</span>}
        </div>
      </div>
      {right && <div className="sh-right">{right}</div>}
      <style>{`
        .sh-root{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:14px;position:relative;background:transparent;}
        .sh-root::before{content:"";position:absolute;left:0;bottom:-1px;width:44px;height:4px;background:linear-gradient(90deg,${iconColor},transparent);border-radius:2px;}
        .sh-left{display:flex;align-items:center;gap:12px;min-width:0;}
        .sh-icon{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;border:1px solid currentColor;flex-shrink:0;box-shadow:0 10px 30px rgba(0,0,0,0.12);}
        .sh-text{display:flex;flex-direction:column;min-width:0;}
        .sh-title{font-size:15px;font-weight:900;color:var(--text);text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;}
        .sh-subtitle{font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}
        .sh-right{flex-shrink:0;display:flex;align-items:center;gap:8px;}
        @media(max-width:768px){.sh-root{margin-bottom:12px;}.sh-icon{width:36px;height:36px;}}
      `}</style>
    </div>
  );
};

export default SectionHeader;
