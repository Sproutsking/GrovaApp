import React from "react";

const SectionHeader = ({
  icon: Icon,
  iconColor = "#84cc16",
  iconBg = "rgba(132,204,22,.12)",
  iconBorder = "rgba(132,204,22,.25)",
  title,
  subtitle,
  right,
}) => (
  <div className="sh-root">
    <div className="sh-left">
      {Icon && (
        <div className="sh-icon" style={{ background: iconBg, borderColor: iconBorder }}>
          <Icon size={15} color={iconColor} />
        </div>
      )}
      <div className="sh-text">
        <span className="sh-title">{title}</span>
        {subtitle && <span className="sh-subtitle">{subtitle}</span>}
      </div>
    </div>
    {right && <div className="sh-right">{right}</div>}
    <style>{`
      .sh-root{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:18px;position:relative;}
      .sh-root::before{content:"";position:absolute;left:0;bottom:-1px;width:28px;height:2px;background:linear-gradient(90deg,${iconColor},transparent);border-radius:1px;}
      .sh-left{display:flex;align-items:center;gap:10px;min-width:0;}
      .sh-icon{width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid;flex-shrink:0;}
      .sh-text{display:flex;flex-direction:column;min-width:0;}
      .sh-title{font-size:14px;font-weight:800;color:#f0f0f0;text-transform:uppercase;letter-spacing:0.02em;white-space:nowrap;}
      .sh-subtitle{font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .sh-right{flex-shrink:0;}
      @media(max-width:768px){.sh-root{margin-bottom:14px;}}
    `}</style>
  </div>
);

export default SectionHeader;
