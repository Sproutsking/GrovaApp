import React from "react";
import { BookOpen, ClipboardList, FileText, GraduationCap } from "lucide-react";
import HomeView from "./HomeView";

const STUDY_SECTIONS = {
  lessons: {
    icon: BookOpen,
    title: "Lessons",
    text: "Organize explainers, walkthroughs, and class notes in one place.",
  },
  resources: {
    icon: FileText,
    title: "Resources",
    text: "Share study guides, references, and useful learning material.",
  },
  study: {
    icon: ClipboardList,
    title: "Study Hub",
    text: "Keep your study groups and revision plans moving forward.",
  },
};

const StudentHomeView = (props) => {
  const { activeHomeTab } = props;

  if (activeHomeTab === "feed") {
    return <HomeView {...props} trinityLens="student" activeHomeTab="feed" />;
  }

  const section = STUDY_SECTIONS[activeHomeTab] || STUDY_SECTIONS.study;
  const Icon = section.icon;

  return (
    <section className="student-home-section" aria-labelledby="student-section-title">
      <div className="student-home-heading">
        <div className="student-home-icon"><Icon size={20} /></div>
        <div>
          <span className="student-home-kicker"><GraduationCap size={12} /> Student mode</span>
          <h2 id="student-section-title">{section.title}</h2>
          <p>{section.text}</p>
        </div>
      </div>
      <div className="student-home-empty">Your {section.title.toLowerCase()} will appear here as you build your learning circle.</div>
      <style>{`
        .student-home-section{padding:24px 18px 90px;color:var(--text);min-height:100%;background:linear-gradient(180deg,rgba(56,189,248,.06),transparent 280px)}
        .student-home-heading{display:flex;gap:14px;align-items:flex-start;max-width:720px;margin:0 auto 20px;padding:18px;border:1px solid rgba(56,189,248,.2);background:rgba(15,23,42,.5);border-radius:14px}
        .student-home-icon{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;border-radius:12px;color:#7dd3fc;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.24)}
        .student-home-kicker{display:flex;align-items:center;gap:5px;color:#7dd3fc;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
        .student-home-heading h2{margin:5px 0 4px;font-size:22px}.student-home-heading p{color:var(--text-secondary);font-size:13px;line-height:1.55}
        .student-home-empty{max-width:720px;margin:auto;padding:28px 18px;text-align:center;color:var(--text-muted);font-size:13px;border-top:1px solid var(--surface-border)}
        @media(max-width:768px){.student-home-section{padding:16px 10px 78px}.student-home-heading{padding:14px;gap:11px}.student-home-heading h2{font-size:19px}}
      `}</style>
    </section>
  );
};

export default StudentHomeView;
