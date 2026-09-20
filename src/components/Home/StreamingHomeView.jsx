import React from "react";
import { CalendarDays, Network, Radio, Users } from "lucide-react";
import HomeView from "./HomeView";
import LiveStreamersRow from "../Stream/LiveStreamersRow";

const STREAMING_SECTIONS = {
  events: {
    icon: CalendarDays,
    title: "Events",
    text: "Turn broadcasts into shared moments for your community.",
    items: ["Scheduled streams", "Community events", "Creator collaborations"],
  },
  network: {
    icon: Network,
    title: "Creator Network",
    text: "Build relationships around the people you create with and for.",
    items: ["Collaborators", "Creator communities", "Opportunities"],
  },
};

const StreamingHomeView = (props) => {
  const { activeHomeTab, currentUser } = props;

  if (activeHomeTab === "feed") {
    return <HomeView {...props} trinityLens="streaming" activeHomeTab="feed" />;
  }

  if (activeHomeTab === "live") {
    return (
      <section className="streaming-live-shell" aria-labelledby="streaming-live-title">
        <div className="streaming-section-head">
          <div className="streaming-section-icon"><Radio size={19} /></div>
          <div>
            <span className="streaming-kicker"><Radio size={11} /> Live now</span>
            <h2 id="streaming-live-title">The broadcast is elsewhere. The event is here.</h2>
            <p>Find live Xeevia sessions and join the community around them.</p>
          </div>
        </div>
        <LiveStreamersRow currentUser={currentUser} />
      </section>
    );
  }

  const section = STREAMING_SECTIONS[activeHomeTab] || STREAMING_SECTIONS.events;
  const Icon = section.icon;

  return (
    <section className="streaming-home-section" aria-labelledby="streaming-section-title">
      <div className="streaming-section-head">
        <div className="streaming-section-icon"><Icon size={19} /></div>
        <div>
          <span className="streaming-kicker"><Users size={11} /> Streaming mode</span>
          <h2 id="streaming-section-title">{section.title}</h2>
          <p>{section.text}</p>
        </div>
      </div>
      <div className="streaming-section-grid">
        {section.items.map((item) => <div key={item} className="streaming-section-item">{item}</div>)}
      </div>
      <div className="streaming-section-note">This experience is being connected to Communities, Events, and creator identity evidence.</div>
    </section>
  );
};

const styles = `
.streaming-home-section,.streaming-live-shell{min-height:100%;padding:24px 18px 90px;color:var(--text);background:linear-gradient(180deg,rgba(132,204,22,.06),transparent 300px)}
.streaming-section-head{display:flex;gap:14px;align-items:flex-start;max-width:860px;margin:0 auto 20px;padding:18px;border:1px solid rgba(132,204,22,.2);background:rgba(15,23,12,.52);border-radius:14px}
.streaming-section-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:12px;color:#a3e635;background:rgba(132,204,22,.12);border:1px solid rgba(132,204,22,.24)}
.streaming-kicker{display:flex;align-items:center;gap:5px;color:#a3e635;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.streaming-section-head h2{margin:5px 0 4px;font-size:22px}.streaming-section-head p{color:var(--text-secondary);font-size:13px;line-height:1.55}
.streaming-section-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:860px;margin:0 auto}
.streaming-section-item{padding:16px;border:1px solid var(--surface-border);border-radius:11px;background:rgba(255,255,255,.025);color:var(--text-secondary);font-size:12px;font-weight:700}
.streaming-section-note{max-width:860px;margin:16px auto 0;padding:15px 18px;border-top:1px solid var(--surface-border);color:var(--text-muted);font-size:12px;line-height:1.55}
.streaming-live-shell .lsr-row-wrap{max-width:860px;margin:0 auto}
@media(max-width:768px){.streaming-home-section,.streaming-live-shell{padding:16px 10px 78px}.streaming-section-head{padding:14px;gap:11px}.streaming-section-head h2{font-size:19px}.streaming-section-grid{grid-template-columns:1fr}}
`;

const StreamingHomeViewWithStyles = (props) => <><style>{styles}</style><StreamingHomeView {...props} /></>;

export default StreamingHomeViewWithStyles;
