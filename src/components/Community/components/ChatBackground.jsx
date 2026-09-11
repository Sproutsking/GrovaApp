import React from "react";

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
    ...style,
  };

  return <div aria-hidden="true" className="community-chat-background" style={backgroundStyle} />;
};

export default ChatBackground;
