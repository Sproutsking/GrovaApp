import React, { useState, useRef, useEffect } from "react";
import {
  List,
  Hash,
  ArrowRight,
  Sparkles,
  MoreHorizontal,
  X,
  ChevronDown,
} from "lucide-react";
import "./TextToolbar.css";

const BULLET_STYLES = [
  { id: "dot", symbol: "•", label: "Dot" },
  { id: "arrow", symbol: "→", label: "Arrow" },
  { id: "star", symbol: "★", label: "Star" },
  { id: "check", symbol: "✓", label: "Check" },
  { id: "diamond", symbol: "◆", label: "Diamond" },
  { id: "circle", symbol: "○", label: "Circle" },
  { id: "square", symbol: "▪", label: "Square" },
  { id: "triangle", symbol: "▸", label: "Triangle" },
];

const NUMBER_STYLES = [
  { id: "numeric", format: (i) => `${i}.`, label: "1. 2. 3." },
  { id: "parenthesis", format: (i) => `${i})`, label: "1) 2) 3)" },
  { id: "bracket", format: (i) => `[${i}]`, label: "[1] [2] [3]" },
  { id: "roman", format: (i) => `${toRoman(i)}.`, label: "I. II. III." },
  { id: "letter", format: (i) => `${toLetter(i)}.`, label: "a. b. c." },
  { id: "caps", format: (i) => `${toLetter(i).toUpperCase()}.`, label: "A. B. C." },
];

const ARROW_STYLES = [
  { id: "right", symbol: "→", label: "Right" },
  { id: "left", symbol: "←", label: "Left" },
  { id: "up", symbol: "↑", label: "Up" },
  { id: "down", symbol: "↓", label: "Down" },
  { id: "curved-right", symbol: "↳", label: "Curved R" },
  { id: "curved-left", symbol: "↲", label: "Curved L" },
  { id: "double-right", symbol: "⇒", label: "Double R" },
  { id: "wave-right", symbol: "⤷", label: "Wave R" },
];

const SPECIAL_CHARS = [
  { char: "✨", label: "Sparkle" },
  { char: "🔥", label: "Fire" },
  { char: "💎", label: "Gem" },
  { char: "⚡", label: "Bolt" },
  { char: "🎯", label: "Target" },
  { char: "🚀", label: "Rocket" },
  { char: "💡", label: "Idea" },
  { char: "🌟", label: "Star" },
  { char: "❤️", label: "Heart" },
  { char: "👉", label: "Point" },
  { char: "—", label: "Em Dash" },
  { char: "–", label: "En Dash" },
];

const COLOR_OPTIONS = [
  { name: "Lime", value: "#84cc16" },
  { name: "Gold", value: "#fbbf24" },
  { name: "Purple", value: "#a855f7" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Pink", value: "#ec4899" },
];

function toRoman(num) {
  const map = [
    ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1]
  ];
  let result = "";
  for (let [roman, value] of map) {
    while (num >= value) {
      result += roman;
      num -= value;
    }
  }
  return result;
}

function toLetter(num) {
  return String.fromCharCode(96 + num);
}

const TextToolbar = ({ textareaRef, onInsert, onClearMode }) => {
  const [showFullPanel, setShowFullPanel] = useState(false);
  const [recentTools, setRecentTools] = useState([]);
  const [activeCategory, setActiveCategory] = useState("bullets");
  const [panelPosition, setPanelPosition] = useState({ top: 0, right: 10 });
  const [activeMode, setActiveMode] = useState(null);
  const [activeColor, setActiveColor] = useState("#84cc16");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const panelRef = useRef(null);
  const containerRef = useRef(null);
  const overlayRef = useRef(null);

  // Expose clear function to parent
  useEffect(() => {
    if (onClearMode) {
      window.clearTextToolbarMode = () => {
        setActiveMode(null);
        setShowColorPicker(false);
      };
    }
    return () => {
      delete window.clearTextToolbarMode;
    };
  }, [onClearMode]);

  useEffect(() => {
    const saved = localStorage.getItem("textToolbarRecent");
    if (saved) {
      try {
        setRecentTools(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (showFullPanel && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow > 380) {
        setPanelPosition({ top: rect.bottom + 6, right: 10 });
      } else if (spaceAbove > 380) {
        setPanelPosition({ top: rect.top - 380, right: 10 });
      } else {
        setPanelPosition({ top: rect.bottom + 6, right: 10 });
      }
    }
  }, [showFullPanel]);

  // Apply color to editor using data attribute
  useEffect(() => {
    if (textareaRef?.current && activeMode) {
      textareaRef.current.setAttribute('data-symbol-color', activeMode.color || activeColor);
      
      // Force re-render of content with new color
      const currentValue = textareaRef.current.textContent || textareaRef.current.value || '';
      if (currentValue && textareaRef.current.innerHTML) {
        const pos = getCaretPosition(textareaRef.current);
        textareaRef.current.value = currentValue; // Trigger re-format
        setTimeout(() => {
          setCaretPosition(textareaRef.current, pos);
        }, 0);
      }
    } else if (textareaRef?.current) {
      textareaRef.current.removeAttribute('data-symbol-color');
    }
  }, [activeMode, activeColor, textareaRef]);

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

  function setCaretPosition(element, position) {
    const selection = window.getSelection();
    const range = document.createRange();
    
    try {
      let currentOffset = 0;
      
      function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const length = node.textContent.length;
          if (currentOffset + length >= position) {
            return { node, offset: position - currentOffset };
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
      
      const textNode = traverse(element);
      if (textNode) {
        range.setStart(textNode.node, textNode.offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (e) {
      console.warn('Caret position failed:', e);
    }
  }

  // Auto-continuation on Enter key
  useEffect(() => {
    if (!textareaRef?.current || !activeMode) return;

    const textarea = textareaRef.current;

    const handleKeyDown = (e) => {
      if (e.key !== 'Enter' || !activeMode) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, start);
      
      let hasOnlySymbol = false;
      
      if (activeMode.type === 'bullet' || activeMode.type === 'arrow') {
        const escapedSymbol = activeMode.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^\\s*${escapedSymbol}\\s*$`);
        hasOnlySymbol = pattern.test(currentLine);
      } else if (activeMode.type === 'number') {
        hasOnlySymbol = /^\s*\d+[.)\]]\s*$/.test(currentLine);
      }
      
      if (hasOnlySymbol) {
        const before = value.substring(0, lineStart);
        const after = value.substring(end);
        onInsert(before + after);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(lineStart, lineStart);
        }, 0);
        
        setActiveMode(null);
        return;
      }
      
      let continuation = '\n';
      const indent = activeMode.indent || "    ";
      const spacing = activeMode.spacing || "  ";
      
      if (activeMode.type === 'bullet' || activeMode.type === 'arrow') {
        continuation += `${indent}${activeMode.symbol}${spacing}`;
      } else if (activeMode.type === 'number') {
        const numMatch = currentLine.match(/(\d+)/);
        const nextNum = numMatch ? parseInt(numMatch[1]) + 1 : 1;
        continuation += `${indent}${activeMode.format(nextNum)}${spacing}`;
      }
      
      const before = value.substring(0, end);
      const after = value.substring(end);
      const newValue = before + continuation + after;
      
      onInsert(newValue);
      
      setTimeout(() => {
        textarea.focus();
        const newPos = end + continuation.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    };

    textarea.addEventListener('keydown', handleKeyDown, true);
    return () => textarea.removeEventListener('keydown', handleKeyDown, true);
  }, [activeMode, textareaRef, onInsert]);

  const addToRecent = (tool) => {
    const updated = [
      tool,
      ...recentTools.filter((t) => t.id !== tool.id),
    ].slice(0, 4);
    setRecentTools(updated);
    localStorage.setItem("textToolbarRecent", JSON.stringify(updated));
  };

  const insertText = (text, tool, color = activeColor) => {
    if (!textareaRef?.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const before = currentValue.substring(0, start);
    const selected = currentValue.substring(start, end);
    const after = currentValue.substring(end);

    let newText = "";
    let newCursorPos = start;
    const indent = "    ";
    const spacingAfterSymbol = "  ";

    if (tool.type === "bullet") {
      if (selected) {
        const lines = selected.split("\n");
        newText = lines.map((line) => `${indent}${text}${spacingAfterSymbol}${line}`).join("\n");
      } else {
        newText = `${indent}${text}${spacingAfterSymbol}`;
        newCursorPos = start + newText.length;
      }
      setActiveMode({ 
        type: 'bullet', 
        symbol: text, 
        label: tool.label, 
        id: tool.id,
        color: color,
        indent: indent,
        spacing: spacingAfterSymbol
      });
    } else if (tool.type === "number") {
      if (selected) {
        const lines = selected.split("\n");
        newText = lines.map((line, i) => `${indent}${tool.format(i + 1)}${spacingAfterSymbol}${line}`).join("\n");
      } else {
        newText = `${indent}${tool.format(1)}${spacingAfterSymbol}`;
        newCursorPos = start + newText.length;
      }
      setActiveMode({ 
        type: 'number', 
        format: tool.format, 
        label: tool.label, 
        id: tool.id,
        color: color,
        indent: indent,
        spacing: spacingAfterSymbol
      });
    } else if (tool.type === "arrow") {
      newText = `${indent}${text}${spacingAfterSymbol}`;
      newCursorPos = start + newText.length;
      setActiveMode({ 
        type: 'arrow', 
        symbol: text, 
        label: tool.label, 
        id: tool.id,
        color: color,
        indent: indent,
        spacing: spacingAfterSymbol
      });
    } else if (tool.type === "char") {
      newText = text;
      newCursorPos = start + text.length;
    }

    const finalValue = before + newText + (selected || "") + after;
    onInsert(finalValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);

    addToRecent(tool);
    setShowFullPanel(false);
  };

  const cancelActiveMode = () => {
    setActiveMode(null);
    setShowColorPicker(false);
  };

  const handleColorChange = (color) => {
    setActiveColor(color);
    if (activeMode) {
      setActiveMode({ ...activeMode, color });
    }
    setShowColorPicker(false);
  };

  const handleBulletClick = (bullet) => {
    insertText(bullet.symbol, { ...bullet, type: "bullet" });
  };

  const handleNumberClick = (number) => {
    insertText(number.format(1), { ...number, type: "number" });
  };

  const handleArrowClick = (arrow) => {
    insertText(arrow.symbol, { ...arrow, type: "arrow" });
  };

  const handleCharClick = (char) => {
    insertText(char.char, { id: char.char, type: "char", label: char.label });
  };

  const renderRecentTool = (tool) => {
    if (tool.type === "bullet" || tool.type === "arrow" || tool.type === "char") {
      return (
        <button
          key={tool.id}
          className="tt-recent-btn"
          onClick={() => {
            if (tool.type === "bullet") {
              handleBulletClick(tool);
            } else if (tool.type === "arrow") {
              handleArrowClick(tool);
            } else if (tool.type === "char") {
              handleCharClick(tool);
            }
          }}
          title={tool.label}
        >
          {tool.symbol || tool.char}
        </button>
      );
    } else if (tool.type === "number") {
      return (
        <button
          key={tool.id}
          className="tt-recent-btn tt-number"
          onClick={() => handleNumberClick(tool)}
          title={tool.label}
        >
          {tool.label.split(" ")[0]}
        </button>
      );
    }
    return null;
  };

  const renderActiveMode = () => {
    if (!activeMode) return null;

    let displayText = '';
    if (activeMode.type === 'bullet' || activeMode.type === 'arrow') {
      displayText = activeMode.symbol;
    } else if (activeMode.type === 'number') {
      displayText = activeMode.label.split(' ')[0];
    }

    const symbolColor = activeMode.color || activeColor;

    return (
      <div className="tt-active-mode">
        <button className="tt-cancel-btn" onClick={cancelActiveMode} title="Cancel">
          <X size={10} />
        </button>
        <button 
          className="tt-active-symbol-btn"
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Change color"
        >
          <span style={{ color: symbolColor }}>{displayText}</span>
          <ChevronDown size={10} className="tt-chevron" />
        </button>
        
        {showColorPicker && (
          <div className="tt-color-picker">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                className="tt-color-option"
                style={{ background: color.value }}
                onClick={() => handleColorChange(color.value)}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="text-toolbar-container" ref={containerRef}>
        {activeMode && renderActiveMode()}
        {!activeMode && recentTools.length > 0 && (
          <div className="tt-recent-tools">
            {recentTools.slice(0, 4).map(renderRecentTool)}
          </div>
        )}
        <button
          className="tt-menu-btn"
          onClick={() => setShowFullPanel(!showFullPanel)}
          title="All Tools"
        >
          {showFullPanel ? <X size={16} /> : <MoreHorizontal size={16} />}
        </button>
      </div>

      {showFullPanel && (
        <div 
          className="tt-panel" 
          ref={panelRef}
          style={{
            top: `${panelPosition.top}px`,
            right: `${panelPosition.right}px`
          }}
        >
          <div className="tt-panel-header">
            <div className="tt-categories">
              <button
                className={`tt-category ${activeCategory === "bullets" ? "active" : ""}`}
                onClick={() => setActiveCategory("bullets")}
              >
                <List size={14} /> Bullets
              </button>
              <button
                className={`tt-category ${activeCategory === "numbers" ? "active" : ""}`}
                onClick={() => setActiveCategory("numbers")}
              >
                <Hash size={14} /> Numbers
              </button>
              <button
                className={`tt-category ${activeCategory === "arrows" ? "active" : ""}`}
                onClick={() => setActiveCategory("arrows")}
              >
                <ArrowRight size={14} /> Arrows
              </button>
              <button
                className={`tt-category ${activeCategory === "special" ? "active" : ""}`}
                onClick={() => setActiveCategory("special")}
              >
                <Sparkles size={14} /> Special
              </button>
            </div>
            <button className="tt-close-btn" onClick={() => setShowFullPanel(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="tt-panel-content">
            {activeCategory === "bullets" && (
              <div className="tt-grid">
                {BULLET_STYLES.map((bullet) => (
                  <button
                    key={bullet.id}
                    className="tt-tool-btn"
                    onClick={() => handleBulletClick(bullet)}
                  >
                    <span className="tt-symbol">{bullet.symbol}</span>
                    <span className="tt-label">{bullet.label}</span>
                  </button>
                ))}
              </div>
            )}

            {activeCategory === "numbers" && (
              <div className="tt-grid">
                {NUMBER_STYLES.map((num) => (
                  <button
                    key={num.id}
                    className="tt-tool-btn tt-number-btn"
                    onClick={() => handleNumberClick(num)}
                  >
                    <span className="tt-number-label">{num.label}</span>
                  </button>
                ))}
              </div>
            )}

            {activeCategory === "arrows" && (
              <div className="tt-grid">
                {ARROW_STYLES.map((arrow) => (
                  <button
                    key={arrow.id}
                    className="tt-tool-btn"
                    onClick={() => handleArrowClick(arrow)}
                  >
                    <span className="tt-symbol">{arrow.symbol}</span>
                    <span className="tt-label">{arrow.label}</span>
                  </button>
                ))}
              </div>
            )}

            {activeCategory === "special" && (
              <div className="tt-grid tt-special-grid">
                {SPECIAL_CHARS.map((char) => (
                  <button
                    key={char.char}
                    className="tt-tool-btn tt-char-btn"
                    onClick={() => handleCharClick(char)}
                    title={char.label}
                  >
                    <span className="tt-char">{char.char}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TextToolbar;