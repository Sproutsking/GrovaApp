import { sortComments } from "./commentSort";

const comments = [
  { id: "older", createdAt: "2026-01-01T00:00:00Z", likes: 8, totalReplies: 1 },
  { id: "newer", createdAt: "2026-01-03T00:00:00Z", likes: 2, totalReplies: 5 },
  { id: "middle", createdAt: "2026-01-02T00:00:00Z", likes: 12, totalReplies: 3 },
];

describe("sortComments", () => {
  it("puts the newest comment first by default", () => {
    expect(sortComments(comments, "recent").map(({ id }) => id)).toEqual([
      "newer",
      "middle",
      "older",
    ]);
  });

  it("orders oldest comments first", () => {
    expect(sortComments(comments, "oldest").map(({ id }) => id)).toEqual([
      "older",
      "middle",
      "newer",
    ]);
  });

  it("orders by likes, using recency to break ties", () => {
    expect(sortComments(comments, "popular").map(({ id }) => id)).toEqual([
      "middle",
      "older",
      "newer",
    ]);
  });

  it("orders by reply count, using recency to break ties", () => {
    expect(sortComments(comments, "discussed").map(({ id }) => id)).toEqual([
      "newer",
      "middle",
      "older",
    ]);
  });

  it("does not mutate the source list", () => {
    const originalOrder = comments.map(({ id }) => id);
    sortComments(comments, "recent");
    expect(comments.map(({ id }) => id)).toEqual(originalOrder);
  });
});
