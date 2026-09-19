// ============================================================================
// src/components/Shared/ParsedText.jsx
// ============================================================================

import React from 'react';
import LinkifiedText, { isInternalXeeviaUrl } from './LinkifiedText';

/**
 * ParsedText Component - Renders text with clickable hashtags and mentions
 */
const ParsedText = ({ text, onHashtagClick, onMentionClick, onNavigate, displayMode = 'embed', className = '' }) => {
  if (!text) return null;

  const parseText = (text) => {
    const combinedPattern = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g;
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
      if (/^https?:\/\//i.test(matched)) {
        parts.push({
          type: 'url',
          content: matched,
        });
      } else if (matched.startsWith('#')) {
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
  const previewUrls = displayMode === "embed"
    ? parts.filter((part) => part.type === "url" && !isInternalXeeviaUrl(part.content)).map((part) => part.content)
    : [];

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'url') {
          return <LinkifiedText key={`url-${index}`} onNavigate={onNavigate} displayMode="string">{part.content}</LinkifiedText>;
        } else if (part.type === 'hashtag') {
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
      {previewUrls.map((url) => (
        <LinkifiedText key={`preview-${url}`} onNavigate={onNavigate} displayMode="embed" previewOnly>{url}</LinkifiedText>
      ))}
    </span>
  );
};

export default ParsedText;