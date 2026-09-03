import React from "react";
import LiveStreamersRow from "../Stream/LiveStreamersRow";
import HomeView from "./HomeView";

const GamingHomeView = (props) => {
  const { activeHomeTab, currentUser } = props;

  if (activeHomeTab === "live") {
    return <div style={{ padding: "16px" }}><LiveStreamersRow currentUser={currentUser} /></div>;
  }

  if (activeHomeTab === "feed" || activeHomeTab === "news" || activeHomeTab === "clips") {
    return <HomeView {...props} trinityLens="gaming" activeHomeTab={activeHomeTab === "clips" ? "reels" : activeHomeTab} />;
  }

  return <HomeView {...props} trinityLens="gaming" activeHomeTab="feed" />;
};

export default GamingHomeView;
