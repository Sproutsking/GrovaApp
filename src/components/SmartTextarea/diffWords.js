// src/components/SmartTextarea/diffWords.js

/**
 * diffWords
 * Computes a word-level diff between two strings.
 * Returns an array of { type: "equal" | "added" | "removed", value: string }
 *
 * Used to animate the old → new text transition in the overlay.
 * Pure function, zero dependencies, O(n*m) LCS — fast enough for post-length text.
 */
export function diffWords(oldText, newText) {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  if (oldWords.length === 0 && newWords.length === 0) return [];

  const lcs = computeLCS(oldWords, newWords);
  const result = [];

  let oi = 0;
  let ni = 0;
  let li = 0;

  while (li < lcs.length) {
    const commonWord = lcs[li];

    // Find its next occurrence in old from current oi
    let oldIdx = oi;
    while (oldIdx < oldWords.length && oldWords[oldIdx] !== commonWord) {
      oldIdx++;
    }

    // Find its next occurrence in new from current ni
    let newIdx = ni;
    while (newIdx < newWords.length && newWords[newIdx] !== commonWord) {
      newIdx++;
    }

    // Everything between oi and oldIdx is removed
    for (let i = oi; i < oldIdx; i++) {
      result.push({ type: "removed", value: oldWords[i] + " " });
    }

    // Everything between ni and newIdx is added
    for (let i = ni; i < newIdx; i++) {
      result.push({ type: "added", value: newWords[i] + " " });
    }

    // The common word
    result.push({ type: "equal", value: commonWord + " " });

    oi = oldIdx + 1;
    ni = newIdx + 1;
    li++;
  }

  // Remaining removed words
  for (let i = oi; i < oldWords.length; i++) {
    result.push({ type: "removed", value: oldWords[i] + " " });
  }

  // Remaining added words
  for (let i = ni; i < newWords.length; i++) {
    result.push({ type: "added", value: newWords[i] + " " });
  }

  return result;
}

/**
 * computeLCS — standard dynamic programming LCS.
 * Fast enough for texts up to ~500 words (all social posts).
 */
function computeLCS(a, b) {
  const m = a.length;
  const n = b.length;

  // Use flat array for memory efficiency
  const dp = new Array((m + 1) * (n + 1)).fill(0);

  const idx = (i, j) => i * (n + 1) + j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[idx(i, j)] = dp[idx(i - 1, j - 1)] + 1;
      } else {
        dp[idx(i, j)] = Math.max(dp[idx(i - 1, j)], dp[idx(i, j - 1)]);
      }
    }
  }

  // Backtrack to find the actual LCS
  const lcs = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[idx(i - 1, j)] > dp[idx(i, j - 1)]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}