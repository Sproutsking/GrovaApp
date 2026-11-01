const HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const TOUCH_MEDIA = "(hover: none), (pointer: coarse)";
const TOUCH_VISIBLE_TARGET = /(?:btn|button|control|action|delete|edit|play|thumb|handle|arrow|remove|trim|drag|overlay|info|expand|(?:^|[-_])(?:exp|hover)(?:[-_]|$))/i;

function getSelectorTarget(selector) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let targetStart = 0;
  let hasAncestor = false;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth -= 1;
    else if (depth === 0 && (character === ">" || character === "+" || character === "~" || /\s/.test(character))) {
      hasAncestor = true;
      targetStart = index + 1;
      while (/\s/.test(selector[targetStart] || "")) targetStart += 1;
    }
  }

  return hasAncestor ? selector.slice(targetStart).trim() : "";
}

function getTouchRevealDeclarations(style) {
  const declarations = [];
  const opacity = Number.parseFloat(style.getPropertyValue("opacity"));
  const visibility = style.getPropertyValue("visibility");
  const display = style.getPropertyValue("display");
  const pointerEvents = style.getPropertyValue("pointer-events");

  if (Number.isFinite(opacity) && opacity >= 0.95) declarations.push("opacity: 1");
  if (visibility === "visible") declarations.push("visibility: visible");
  if (display && display !== "none") declarations.push(`display: ${display}`);
  if (pointerEvents === "auto") declarations.push("pointer-events: auto");

  return declarations.join("; ");
}

export function splitSelectorList(selectorText) {
  const selectors = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    else if (character === ")" || character === "]") depth -= 1;
    else if (character === "," && depth === 0) {
      selectors.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selectorText.slice(start).trim());
  return selectors.filter(Boolean);
}

function isHoverGate(rule) {
  const condition = rule.conditionText || rule.cssText.match(/^@media\s+(.+?)\s*\{/)?.[1];
  return rule.type === CSSRule.MEDIA_RULE
    && condition?.replace(/\s+/g, " ").trim() === HOVER_MEDIA;
}

function rewriteRuleList(parentRuleList) {
  const ruleList = parentRuleList.cssRules;

  for (let index = 0; index < ruleList.length; index += 1) {
    const rule = ruleList[index];

    if (rule.type === CSSRule.STYLE_RULE && rule.selectorText.includes(":hover")) {
      const selectors = splitSelectorList(rule.selectorText);
      const hoverSelectors = selectors.filter((selector) => selector.includes(":hover"));
      const otherSelectors = selectors.filter((selector) => !selector.includes(":hover"));
      const declarations = rule.style.cssText;
      const touchRevealSelectors = hoverSelectors
        .filter((selector) => TOUCH_VISIBLE_TARGET.test(getSelectorTarget(selector)))
        .map((selector) => selector.replace(/:hover\b/g, ""));
      const touchRevealDeclarations = getTouchRevealDeclarations(rule.style);
      let insertionIndex = index;

      parentRuleList.deleteRule(index);
      if (otherSelectors.length) {
        parentRuleList.insertRule(`${otherSelectors.join(", ")} { ${declarations} }`, insertionIndex);
        insertionIndex += 1;
      }
      parentRuleList.insertRule(
        `@media ${HOVER_MEDIA} { ${hoverSelectors.join(", ")} { ${declarations} } }`,
        insertionIndex,
      );
      if (touchRevealSelectors.length && touchRevealDeclarations) {
        insertionIndex += 1;
        parentRuleList.insertRule(
          `@media ${TOUCH_MEDIA} { ${touchRevealSelectors.join(", ")} { ${touchRevealDeclarations} } }`,
          insertionIndex,
        );
      }
      index = insertionIndex;
      continue;
    }

    if (rule.cssRules && !isHoverGate(rule)) rewriteRuleList(rule);
  }
}

export function rewriteStylesheet(stylesheet) {
  if (!stylesheet || stylesheet.disabled) return;

  try {
    rewriteRuleList(stylesheet);
  } catch (error) {
    if (error.name !== "SecurityError") {
      console.warn("[hover-capability] Could not gate hover styles:", error);
    }
  }
}

function collectStylesheets(node, stylesheets) {
  if (!(node instanceof Element)) return;
  if (node.tagName === "STYLE" && node.sheet) stylesheets.add(node.sheet);
  if (node.tagName === "LINK" && node.rel === "stylesheet") {
    if (node.sheet) stylesheets.add(node.sheet);
    else node.addEventListener("load", () => rewriteStylesheet(node.sheet), { once: true });
  }
  node.querySelectorAll?.("style, link[rel='stylesheet']").forEach((element) => {
    if (element.sheet) stylesheets.add(element.sheet);
    else if (element.tagName === "LINK") {
      element.addEventListener("load", () => rewriteStylesheet(element.sheet), { once: true });
    }
  });
}

export function initializeHoverCapability() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};

  const suppressTouchHover = (event) => {
    if (window.matchMedia(TOUCH_MEDIA).matches) event.stopPropagation();
  };
  document.addEventListener("mouseover", suppressTouchHover, true);
  document.addEventListener("mouseout", suppressTouchHover, true);

  const stylesheets = new Set();
  document.querySelectorAll("style, link[rel='stylesheet']").forEach((element) => {
    if (element.sheet) stylesheets.add(element.sheet);
    else if (element.tagName === "LINK") {
      element.addEventListener("load", () => rewriteStylesheet(element.sheet), { once: true });
    }
  });
  stylesheets.forEach(rewriteStylesheet);

  // Component-injected style tags receive the same hover policy after startup.
  const observer = new MutationObserver((records) => {
    const addedStylesheets = new Set();
    records.forEach((record) => {
      record.addedNodes.forEach((node) => collectStylesheets(node, addedStylesheets));
      if (record.target.nodeType === Node.ELEMENT_NODE && record.target.tagName === "STYLE" && record.target.sheet) {
        addedStylesheets.add(record.target.sheet);
      }
      if (record.type === "characterData") {
        const style = record.target.parentElement?.closest("style");
        if (style?.sheet) addedStylesheets.add(style.sheet);
      }
    });
    addedStylesheets.forEach(rewriteStylesheet);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    document.removeEventListener("mouseover", suppressTouchHover, true);
    document.removeEventListener("mouseout", suppressTouchHover, true);
  };
}
