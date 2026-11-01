import { initializeHoverCapability, rewriteStylesheet, splitSelectorList } from "./hoverCapability";

describe("initializeHoverCapability", () => {
  test("suppresses mouse hover events on touch-first devices", () => {
    const previousMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    });
    const stopObserving = initializeHoverCapability();
    const target = document.createElement("button");
    const onMouseOver = jest.fn();
    target.addEventListener("mouseover", onMouseOver);
    document.body.appendChild(target);

    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

    expect(onMouseOver).not.toHaveBeenCalled();

    stopObserving();
    target.remove();
    if (previousMatchMedia) Object.defineProperty(window, "matchMedia", previousMatchMedia);
    else delete window.matchMedia;
  });

  test("gates hover styles injected after application startup", async () => {
    const stopObserving = initializeHoverCapability();
    const style = document.createElement("style");
    style.textContent = ".late-card:hover { color: red; }";
    document.head.appendChild(style);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(style.sheet.cssRules[0].cssText).toContain("@media (hover: hover) and (pointer: fine)");
    style.remove();
    stopObserving();
  });
});

describe("rewriteStylesheet", () => {
  test("gates only hover selectors and preserves focus and active selectors", () => {
    const style = document.createElement("style");
    style.textContent = ".button:hover, .button:focus-visible, .button:active { color: red; }";
    document.head.appendChild(style);

    rewriteStylesheet(style.sheet);

    const rules = Array.from(style.sheet.cssRules);
    expect(rules).toHaveLength(2);
    expect(rules[0].selectorText).toBe(".button:focus-visible, .button:active");
    expect(rules[1].cssText).toContain("@media (hover: hover) and (pointer: fine)");
    expect(rules[1].cssRules[0].selectorText).toBe(".button:hover");

    style.remove();
  });

  test("keeps hover-revealed controls visible on touch without applying hover styling", () => {
    const style = document.createElement("style");
    style.textContent = ".card:hover .delete-button { opacity: 1; transform: translateX(2px); color: red; }";
    document.head.appendChild(style);

    rewriteStylesheet(style.sheet);

    const touchRule = style.sheet.cssRules[1];
    expect(touchRule.cssText).toContain("@media (hover: none), (pointer: coarse)");
    expect(touchRule.cssRules[0].selectorText).toBe(".card .delete-button");
    expect(touchRule.cssRules[0].style.cssText).toBe("opacity: 1;");

    style.remove();
  });
});

describe("splitSelectorList", () => {
  test("splits selector groups without splitting nested commas", () => {
    expect(splitSelectorList(".button:hover, :is(.card, .tile):hover, [data-label='a,b']"))
      .toEqual([".button:hover", ":is(.card, .tile):hover", "[data-label='a,b']"]);
  });

  test("keeps grouped focus and active selectors separate from hover selectors", () => {
    const selectors = splitSelectorList(".button:hover, .button:focus-visible, .button:active");

    expect(selectors.filter((selector) => selector.includes(":hover"))).toEqual([".button:hover"]);
    expect(selectors.filter((selector) => !selector.includes(":hover"))).toEqual([
      ".button:focus-visible",
      ".button:active",
    ]);
  });
});
