import React, { useEffect, useRef } from "react";

const ChatBackground = ({ theme = "minimal" }) => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const currentThemeRef = useRef(theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // CRITICAL: Cancel previous animation immediately on theme change
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Update current theme reference immediately
    currentThemeRef.current = theme;

    const ctx = canvas.getContext("2d");
    let time = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initializeParticles();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 8,
        y: (e.clientY / window.innerHeight - 0.5) * 8,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);

    function initializeParticles() {
      particlesRef.current = [];
      // Map themes properly
      let activeTheme = theme;
      const mapping = {
        'matrix': 'minimal',
        'minimal': 'minimal',
        'lime': 'elegant',
      };
      if (mapping[theme]) activeTheme = mapping[theme];
      
      const count = activeTheme === "minimal" ? 40 : 70;
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          size: Math.random() * 2.5 + 0.5,
          alpha: Math.random() * 0.4 + 0.3,
        });
      }
    }

    initializeParticles();

    const drawFrame = () => {
      const { x: offsetX, y: offsetY } = mouseRef.current;
      
      // Get mapped theme
      let mappedTheme = currentThemeRef.current;
      const themeMapping = {
        'matrix': 'minimal',
        'minimal': 'minimal',
        'lime': 'elegant',
      };
      
      if (themeMapping[currentThemeRef.current]) {
        mappedTheme = themeMapping[currentThemeRef.current];
      }

      const baseGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

      switch (mappedTheme) {
        case "elegant":
          baseGradient.addColorStop(0, "#0a0a0f");
          baseGradient.addColorStop(0.5, "#0d0d14");
          baseGradient.addColorStop(1, "#08080c");
          break;
        case "minimal":
          baseGradient.addColorStop(0, "#000000");
          baseGradient.addColorStop(0.5, "#0c0c0c");
          baseGradient.addColorStop(1, "#000000");
          break;
        default:
          baseGradient.addColorStop(0, "#000000");
          baseGradient.addColorStop(0.5, "#0a0a0a");
          baseGradient.addColorStop(1, "#000000");
      }

      ctx.fillStyle = baseGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      switch (mappedTheme) {
        case "elegant":
          drawElegantTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "minimal":
          drawMinimalTheme(ctx, canvas, time);
          break;
        default:
          drawMinimalTheme(ctx, canvas, time);
      }

      time += 0.002;
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    function drawElegantTheme(ctx, canvas, time, offsetX, offsetY) {
      const pulse1 = Math.sin(time * 25) * 0.06 + 0.10;
      const pulse2 = Math.sin(time * 25 + Math.PI) * 0.06 + 0.10;

      const goldOrb = ctx.createRadialGradient(
        canvas.width * 0.25 + offsetX * 1.5,
        canvas.height * 0.3 + offsetY * 1.5,
        0,
        canvas.width * 0.25 + offsetX * 1.5,
        canvas.height * 0.3 + offsetY * 1.5,
        canvas.width * 0.55,
      );
      goldOrb.addColorStop(0, `rgba(255, 223, 0, ${pulse1 * 1.2})`);
      goldOrb.addColorStop(0.2, `rgba(255, 215, 0, ${pulse1 * 0.8})`);
      goldOrb.addColorStop(0.5, `rgba(218, 165, 32, ${pulse1 * 0.4})`);
      goldOrb.addColorStop(0.8, `rgba(184, 134, 11, ${pulse1 * 0.15})`);
      goldOrb.addColorStop(1, "transparent");
      ctx.fillStyle = goldOrb;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const limeOrb = ctx.createRadialGradient(
        canvas.width * 0.75 - offsetX * 1.5,
        canvas.height * 0.7 - offsetY * 1.5,
        0,
        canvas.width * 0.75 - offsetX * 1.5,
        canvas.height * 0.7 - offsetY * 1.5,
        canvas.width * 0.55,
      );
      limeOrb.addColorStop(0, `rgba(156, 255, 0, ${pulse2 * 1.2})`);
      limeOrb.addColorStop(0.2, `rgba(156, 255, 0, ${pulse2 * 0.8})`);
      limeOrb.addColorStop(0.5, `rgba(132, 204, 22, ${pulse2 * 0.4})`);
      limeOrb.addColorStop(0.8, `rgba(101, 163, 13, ${pulse2 * 0.15})`);
      limeOrb.addColorStop(1, "transparent");
      ctx.fillStyle = limeOrb;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(255, 215, 0, ", "rgba(156, 255, 0, "]);
    }

    function drawMinimalTheme(ctx, canvas, time) {
      ctx.strokeStyle = "rgba(156, 255, 0, 0.025)";
      ctx.lineWidth = 1;
      const spacing = 60;
      
      const offsetX = (time * 30) % spacing;
      const offsetY = (time * 30) % spacing;
      
      for (let x = offsetX; x < canvas.width; x += spacing) {
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      
      for (let y = offsetY; y < canvas.height; y += spacing) {
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      drawFloatingParticles(ctx, time, ["rgba(156, 255, 0, "], 0.35);
    }

    function drawFloatingParticles(ctx, time, colors, speedMultiplier = 1, connected = false) {
      particlesRef.current.forEach((particle, i) => {
        particle.x += particle.vx * speedMultiplier;
        particle.y += particle.vy * speedMultiplier;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        const pulse = Math.sin(time * 50 + i * 0.8) * 0.25 + 0.75;
        const color = colors[i % colors.length];
        ctx.fillStyle = `${color}${(particle.alpha * pulse).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        if (connected) {
          particlesRef.current.forEach((other, j) => {
            if (i < j) {
              const dx = particle.x - other.x;
              const dy = particle.y - other.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance < 120) {
                ctx.strokeStyle = `${color}${((1 - distance / 120) * 0.08).toFixed(2)})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(other.x, other.y);
                ctx.stroke();
              }
            }
          });
        }
      });
    }

    drawFrame();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [theme]); // Re-run entire effect when theme prop changes

  return (
    <canvas
      key={theme}
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