import React, { useEffect, useRef } from "react";

const ChatBackground = ({ theme = "security" }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 15,
        y: (e.clientY / window.innerHeight - 0.5) * 15,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const themes = {
      security: {
        type: "image",
        image: "/Assets/backgrounds/security-preview.jpg",
      },
      space: { type: "image", image: "/Assets/backgrounds/space-preview.jpg" },
      neon: { type: "image", image: "/Assets/backgrounds/neon-preview.jpg" },
      tech: { type: "image", image: "/Assets/backgrounds/tech-preview.jpg" },
      matrix: {
        type: "image",
        image: "/Assets/backgrounds/matrix-preview.jpg",
      },
      minimal: { type: "gradient", colors: ["#0a0a0a", "#1a1a1a"] },
      lime: {
        type: "gradient",
        colors: ["#0a0a0a", "#1a1a1a"],
        glow: "rgba(156, 255, 0, 0.08)",
      },
      gold: {
        type: "gradient",
        colors: ["#0a0a0a", "#1a1a1a"],
        glow: "rgba(255, 215, 0, 0.08)",
      },
      noir: { type: "gradient", colors: ["#000000", "#0a0a0a", "#1a1a1a"] },
      midnight: {
        type: "gradient",
        colors: ["#000000", "#0a0a0a"],
        glow: "rgba(156, 255, 0, 0.03)",
      },
    };

    const currentTheme = themes[theme] || themes.security;

    const drawPattern = () => {
      const { x: offsetX, y: offsetY } = mouseRef.current;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (currentTheme.type === "image" && imageRef.current?.complete) {
        ctx.save();
        ctx.translate(offsetX * 0.3, offsetY * 0.3);

        const scale =
          Math.max(
            canvas.width / imageRef.current.width,
            canvas.height / imageRef.current.height,
          ) * 1.1;

        const x = (canvas.width - imageRef.current.width * scale) / 2;
        const y = (canvas.height - imageRef.current.height * scale) / 2;

        ctx.globalAlpha = 0.7;
        ctx.drawImage(
          imageRef.current,
          x,
          y,
          imageRef.current.width * scale,
          imageRef.current.height * scale,
        );
        ctx.globalAlpha = 1;
        ctx.restore();

        const overlay = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          canvas.width * 0.7,
        );
        overlay.addColorStop(0, "rgba(0, 0, 0, 0.2)");
        overlay.addColorStop(0.7, "rgba(0, 0, 0, 0.4)");
        overlay.addColorStop(1, "rgba(0, 0, 0, 0.6)");
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (currentTheme.type === "gradient") {
        ctx.save();

        const pulse = Math.sin(time * 0.02) * 0.1 + 0.9;

        if (currentTheme.glow) {
          const gradient = ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            0,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width * 0.8,
          );

          const glowColor = currentTheme.glow.replace(
            /[\d.]+\)$/,
            `${parseFloat(currentTheme.glow.match(/[\d.]+\)$/)[0]) * pulse})`,
          );
          gradient.addColorStop(0, glowColor);
          gradient.addColorStop(
            0.5,
            glowColor.replace(
              /[\d.]+\)$/,
              `${parseFloat(currentTheme.glow.match(/[\d.]+\)$/)[0]) * pulse * 0.5})`,
            ),
          );
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
      }

      ctx.fillStyle = "rgba(156, 255, 0, 0.01)";
      for (let y = time % 4; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 1);
      }

      if (time % 60 === 0) {
        for (let i = 0; i < 50; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          ctx.fillStyle = `rgba(156, 255, 0, ${Math.random() * 0.03})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };

    if (currentTheme.type === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageRef.current = img;
      };
      img.onerror = () => {
        console.warn(`Failed to load: ${currentTheme.image}`);
        imageRef.current = null;
      };
      img.src = currentTheme.image;
    }

    const animate = () => {
      time += 1;
      drawPattern();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
};

export default ChatBackground;
