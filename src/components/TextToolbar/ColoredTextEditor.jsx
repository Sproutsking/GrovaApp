import React, { useRef, useEffect, useState } from "react";
import "./ColoredTextEditor.css";

const ColoredTextEditor = React.forwardRef(
  (
    { value, onChange, placeholder, className, rows = 5, disabled, ...props },
    ref,
  ) => {
    const editorRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);

    // Expose methods to parent via ref
    React.useImperativeHandle(ref, () => ({
      focus: () => {
        editorRef.current?.focus();
      },
      blur: () => {
        editorRef.current?.blur();
      },
      setSelectionRange: (start, end) => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        const range = document.createRange();

        try {
          const textNode = getTextNodeAtOffset(editorRef.current, start);
          if (textNode) {
            range.setStart(textNode.node, textNode.offset);
            range.setEnd(textNode.node, textNode.offset + (end - start));
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } catch (e) {
          console.warn("Selection failed:", e);
        }
      },
      get selectionStart() {
        return getCaretPosition(editorRef.current);
      },
      get selectionEnd() {
        return getCaretPosition(editorRef.current);
      },
      get value() {
        return editorRef.current?.textContent || "";
      },
      set value(newValue) {
        if (editorRef.current) {
          editorRef.current.innerHTML = formatTextWithColors(newValue);
        }
      },
      style: editorRef.current?.style || {},
      setAttribute: (name, val) => editorRef.current?.setAttribute(name, val),
      removeAttribute: (name) => editorRef.current?.removeAttribute(name),
      classList: editorRef.current?.classList || {},
      addEventListener: (event, handler, options) => {
        editorRef.current?.addEventListener(event, handler, options);
      },
      removeEventListener: (event, handler, options) => {
        editorRef.current?.removeEventListener(event, handler, options);
      },
    }));

    // Sync external value changes
    useEffect(() => {
      if (editorRef.current && editorRef.current.textContent !== value) {
        const currentPos = getCaretPosition(editorRef.current);
        editorRef.current.innerHTML = formatTextWithColors(value);
        setCaretPosition(editorRef.current, currentPos);
      }
    }, [value]);

    const handleInput = (e) => {
      const text = e.currentTarget.textContent || "";
      onChange?.(text);
    };

    const handlePaste = (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    const minHeight = rows * 1.5 + "em";

    return (
      <div
        ref={editorRef}
        contentEditable={!disabled}
        className={`colored-text-editor ${className || ""} ${isFocused ? "focused" : ""}`}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-placeholder={placeholder}
        style={{ minHeight }}
        suppressContentEditableWarning
        {...props}
      >
        {formatTextWithColors(value)}
      </div>
    );
  },
);

// Format text with colored symbols
function formatTextWithColors(text) {
  if (!text) return "";

  // Get current symbol color from the toolbar
  const symbolColor =
    document
      .querySelector("[data-symbol-color]")
      ?.getAttribute("data-symbol-color") || "#84cc16";

  // Split into lines and format each
  const lines = text.split("\n");
  const formatted = lines
    .map((line) => {
      // Match indented symbols (bullets, numbers, arrows)
      const symbolMatch = line.match(
        /^(\s*)(•|→|←|↑|↓|★|✓|◆|○|▪|▸|↳|↲|⇒|⤷|\d+[.)\]])(  )/,
      );

      if (symbolMatch) {
        const indent = symbolMatch[1];
        const symbol = symbolMatch[2];
        const spacing = symbolMatch[3];
        const restOfLine = line.substring(symbolMatch[0].length);

        return `${indent}<span style="color: ${symbolColor}; font-weight: 700;">${symbol}</span>${spacing}${escapeHtml(restOfLine)}`;
      }

      return escapeHtml(line);
    })
    .join("<br>");

  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Get caret position
function getCaretPosition(element) {
  let position = 0;
  const selection = window.getSelection();

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    position = preCaretRange.toString().length;
  }

  return position;
}

// Set caret position
function setCaretPosition(element, position) {
  const selection = window.getSelection();
  const range = document.createRange();

  try {
    const textNode = getTextNodeAtOffset(element, position);
    if (textNode) {
      range.setStart(textNode.node, textNode.offset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } catch (e) {
    console.warn("Caret position failed:", e);
  }
}

// Get text node at specific offset
function getTextNodeAtOffset(root, offset) {
  let currentOffset = 0;

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent.length;
      if (currentOffset + length >= offset) {
        return { node, offset: offset - currentOffset };
      }
      currentOffset += length;
    } else {
      for (let child of node.childNodes) {
        const result = traverse(child);
        if (result) return result;
      }
    }
    return null;
  }

  return traverse(root);
}

ColoredTextEditor.displayName = "ColoredTextEditor";

export default ColoredTextEditor;
