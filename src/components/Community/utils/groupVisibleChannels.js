export function groupVisibleChannels(channels = [], categoryOrder = []) {
  const grouped = channels.reduce((groups, channel) => {
    const category = channel.category || "Channels";
    groups[category] = [...(groups[category] || []), channel];
    return groups;
  }, {});

  return [...new Set([...categoryOrder, ...Object.keys(grouped)])]
    .filter((category) => grouped[category]?.length)
    .sort((left, right) => {
      const leftIndex = categoryOrder.indexOf(left);
      const rightIndex = categoryOrder.indexOf(right);
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex)
        || left.localeCompare(right);
    })
    .map((category) => [category, grouped[category]]);
}
