import React, { useRef, useEffect } from "react";
import "./CodeInput.css";

const CodeInput = ({ digits, setDigits, onComplete, disabled = false }) => {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (digits.every((d) => d !== "")) {
      onComplete?.(digits.join(""));
    }
  }, [digits, onComplete]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const newDigits = pastedData.split("");
    setDigits(newDigits);
    inputRefs.current[5]?.focus();
  };

  return (
    <div className="code-input-container">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength="1"
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          className={`code-digit ${digit ? "filled" : ""}`}
          disabled={disabled}
          autoFocus={index === 0}
        />
      ))}
    </div>
  );
};

export default CodeInput;
