import React from "react";

const scatteredMarks = [
  { text: "GROVA", top: "12%", left: "18%", fontSize: "clamp(30px, 3vw, 52px)", rotate: -18, opacity: 0.11 },
  { text: "🌍", top: "26%", left: "74%", fontSize: "clamp(24px, 2.5vw, 36px)", rotate: 8, opacity: 0.17 },
  { text: "G", top: "44%", left: "8%", fontSize: "clamp(58px, 6vw, 100px)", rotate: -12, opacity: 0.12 },
  { text: "GROVA", top: "66%", left: "61%", fontSize: "clamp(34px, 3vw, 58px)", rotate: 20, opacity: 0.1 },
  { text: "🌍", top: "77%", left: "27%", fontSize: "clamp(20px, 2vw, 32px)", rotate: -14, opacity: 0.14 },
  { text: "◌", top: "58%", left: "83%", fontSize: "clamp(26px, 2.2vw, 36px)", rotate: 14, opacity: 0.14 },
];

const ChatBackground = ({ style }) => {
  const backgroundStyle = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
    background: "#000000",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    opacity: 1,
    overflow: "hidden",
    ...style,
  };

  return (
    <div aria-hidden="true" className="community-chat-background" style={backgroundStyle}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(8,12,13,0.10) 0%, rgba(8,12,13,0.16) 36%, rgba(8,12,13,0.42) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: "10% 8% 10%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: 0.13,
        }}
      >
        <div
          style={{
            fontSize: "clamp(140px, 24vw, 330px)",
            fontWeight: 900,
            letterSpacing: "0.08em",
            lineHeight: 1,
            color: "#dfead1",
            textTransform: "uppercase",
            transform: "rotate(-12deg) scale(1.08)",
            filter: "blur(0.4px)",
            textShadow: "0 0 24px rgba(156,255,0,0.15)",
            userSelect: "none",
          }}
        >
          GROVA
        </div>
      </div>

      {scatteredMarks.map((mark, index) => (
        <div
          key={`${mark.text}-${index}`}
          style={{
            position: "absolute",
            top: mark.top,
            left: mark.left,
            fontSize: mark.fontSize,
            fontWeight: 800,
            lineHeight: 1,
            color: "rgba(223, 234, 209, 0.75)",
            letterSpacing: mark.text === "GROVA" ? "0.18em" : "0",
            textTransform: mark.text === "GROVA" ? "uppercase" : "none",
            transform: `rotate(${mark.rotate}deg)`,
            opacity: mark.opacity,
            pointerEvents: "none",
            userSelect: "none",
            textShadow: "0 0 18px rgba(122, 168, 173, 0.26)",
          }}
        >
          {mark.text}
        </div>
      ))}
    </div>
  );
};

export default ChatBackground;
