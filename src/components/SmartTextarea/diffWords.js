// src/components/SmartTextarea/diffWords.js

/**
 * diffWords
 *
 * Computes a word-level diff between two strings.
 * Returns: Array<{ type: "equal" | "added" | "removed", value: string }>
 *
 * Used to animate the old → new text transition in the diff overlay.
 * Pure function, zero external dependencies.
 * Uses LCS (Longest Common Subsequence) — O(n*m), fast for post-length text.
 */
export function diffWords(oldText, newText) {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  if (oldWords.length === 0 && newWords.length === 0) return [];

  const lcs = computeLCS(oldWords, newWords);
  const result = [];

  let oi = 0; // pointer into oldWords
  let ni = 0; // pointer into newWords
  let li = 0; // pointer into lcs

  while (li < lcs.length) {
    const commonWord = lcs[li];

    // Advance oldWords pointer to the next occurrence of commonWord
    let oldIdx = oi;
    while (oldIdx < oldWords.length && oldWords[oldIdx] !== commonWord) {
      oldIdx++;
    }

    // Advance newWords pointer to the next occurrence of commonWord
    let newIdx = ni;
    while (newIdx < newWords.length && newWords[newIdx] !== commonWord) {
      newIdx++;
    }

    // Words skipped in old = removed
    for (let i = oi; i < oldIdx; i++) {
      result.push({ type: "removed", value: oldWords[i] + " " });
    }

    // Words skipped in new = added
    for (let i = ni; i < newIdx; i++) {
      result.push({ type: "added", value: newWords[i] + " " });
    }

    // The common word itself
    result.push({ type: "equal", value: commonWord + " " });

    oi = oldIdx + 1;
    ni = newIdx + 1;
    li++;
  }

  // Remaining words in old after LCS = removed
  for (let i = oi; i < oldWords.length; i++) {
    result.push({ type: "removed", value: oldWords[i] + " " });
  }

  // Remaining words in new after LCS = added
  for (let i = ni; i < newWords.length; i++) {
    result.push({ type: "added", value: newWords[i] + " " });
  }

  return result;
}

/**
 * computeLCS — standard DP approach.
 * Uses a flat array for memory efficiency.
 */
function computeLCS(a, b) {
  const m = a.length;
  const n = b.length;

  // Flat DP array: dp[i][j] → dp[i*(n+1)+j]
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

  // Backtrack to reconstruct LCS
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