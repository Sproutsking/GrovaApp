import React from "react";
import { render, screen } from "@testing-library/react";
import { WelcomeCardFrame, getWelcomeDesign, getWelcomeTheme } from "./WelcomeChannelCard";

describe("WelcomeCardFrame avatar presentation", () => {
  it("uses a clean glass frame without a blurred shadow behind the member image", () => {
    render(
      <WelcomeCardFrame
        theme={getWelcomeTheme("lime-classic")}
        design={getWelcomeDesign("banner-hero")}
        heading="Welcome"
        avatar={<img src="/member.png" alt="Member avatar" />}
      />,
    );

    const avatar = screen.getByAltText("Member avatar");
    expect(avatar.parentElement.classList.contains("wc-avatar-frame")).toBe(true);
    expect(document.querySelector(".wc-avatar-halo")).toBeNull();
    const styles = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("\n");
    const avatarFrameStyles = styles.match(/\.wc-avatar-frame\s*\{([^}]*)\}/)?.[1] || "";
    expect(styles).toContain(".wc-avatar-frame");
    expect(styles).toContain("backdrop-filter: blur(12px)");
    expect(styles).toContain("box-shadow: 0 18px 46px -36px rgba(0,0,0,.72), inset 0 1px 0 rgba(255,255,255,.08)");
    expect(avatarFrameStyles).not.toContain("box-shadow");
    expect(avatarFrameStyles).not.toMatch(/(?:^|[;{]\s*)filter\s*:/);
  });

  it.each(["silver", "gold", "diamond"])("applies the %s avatar frame style", (tier) => {
    const { container } = render(
      <WelcomeCardFrame
        theme={getWelcomeTheme("lime-classic")}
        design={getWelcomeDesign("banner-hero")}
        heading="Welcome"
        avatarTier={tier}
        avatar={<span>Member</span>}
      />,
    );

    expect(container.querySelector(`.wc-avatar-frame-${tier}`)).not.toBeNull();
  });

  it("uses a slow, reduced-motion-aware custom frame for gold and diamond avatars", () => {
    render(
      <WelcomeCardFrame
        theme={getWelcomeTheme("lime-classic")}
        design={getWelcomeDesign("banner-hero")}
        heading="Welcome"
        avatarTier="gold"
        avatar={<span>Member</span>}
      />,
    );

    const styles = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("\n");
    expect(styles).toContain("@keyframes wcGoldFrameShimmer");
    expect(styles).toContain("wcGoldFrameShimmer 18s ease-in-out");
    expect(styles).toContain("wcDiamondFrameShimmer 22s ease-in-out");
    expect(styles).toContain(".wc-avatar-frame-gold, .wc-avatar-frame-diamond { animation: none; }");
  });
});
