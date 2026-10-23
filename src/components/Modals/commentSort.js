export function sortComments(comments, sortBy) {
  return [...comments].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || "") || 0;
    const rightTime = Date.parse(right.createdAt || "") || 0;

    if (sortBy === "oldest") return leftTime - rightTime;

    if (sortBy === "popular") {
      const likesDifference = (Number(right.likes) || 0) - (Number(left.likes) || 0);
      if (likesDifference) return likesDifference;
    }

    if (sortBy === "discussed") {
      const repliesDifference = (Number(right.totalReplies) || 0) - (Number(left.totalReplies) || 0);
      if (repliesDifference) return repliesDifference;
    }

    return rightTime - leftTime;
  });
}
