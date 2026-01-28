// ============================================================================
// src/components/Shared/ParsedText.jsx
// ============================================================================

import React from 'react';

/**
 * ParsedText Component - Renders text with clickable hashtags and mentions
 */
const ParsedText = ({ text, onHashtagClick, onMentionClick, className = '' }) => {
  if (!text) return null;

  const parseText = (text) => {
    const combinedPattern = /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    const regex = new RegExp(combinedPattern);
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, match.index)
        });
      }

      // Add the matched hashtag or mention
      const matched = match[0];
      if (matched.startsWith('#')) {
        parts.push({
          type: 'hashtag',
          content: matched,
          tag: matched.substring(1)
        });
      } else if (matched.startsWith('@')) {
        parts.push({
          type: 'mention',
          content: matched,
          username: matched.substring(1)
        });
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    return parts;
  };

  const parts = parseText(text);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'hashtag') {
          return (
            <span
              key={`hashtag-${index}`}
              className="hashtag"
              onClick={(e) => {
                e.stopPropagation();
                if (onHashtagClick) onHashtagClick(part.tag);
              }}
            >
              {part.content}
            </span>
          );
        } else if (part.type === 'mention') {
          return (
            <span
              key={`mention-${index}`}
              className="mention"
              onClick={(e) => {
                e.stopPropagation();
                if (onMentionClick) onMentionClick(part.username);
              }}
            >
              {part.content}
            </span>
          );
        } else {
          return <span key={`text-${index}`}>{part.content}</span>;
        }
      })}
    </span>
  );
};

export default ParsedText;