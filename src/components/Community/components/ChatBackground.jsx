import React, { useEffect, useRef } from "react";

const ChatBackground = ({ theme = "xeevia_weave" }) => {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const currentThemeRef = useRef(theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

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

      const themeMapping = {
        xeevia_weave: "brand",
        aurora: "aurora",
        constellation: "constellation",
        matrix: "minimal",
        minimal: "minimal",
        lime: "elegant",
      };

      const activeTheme = themeMapping[theme] || "brand";
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

      const themeMapping = {
        xeevia_weave: "brand",
        aurora: "aurora",
        constellation: "constellation",
        matrix: "minimal",
        minimal: "minimal",
        lime: "elegant",
      };

      const mappedTheme = themeMapping[currentThemeRef.current] || "brand";
      const baseGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

      switch (mappedTheme) {
        case "brand":
          baseGradient.addColorStop(0, "#071b22");
          baseGradient.addColorStop(0.45, "#0b1d31");
          baseGradient.addColorStop(1, "#060d1b");
          break;
        case "aurora":
          baseGradient.addColorStop(0, "#071722");
          baseGradient.addColorStop(0.5, "#10233d");
          baseGradient.addColorStop(1, "#080e18");
          break;
        case "constellation":
          baseGradient.addColorStop(0, "#040814");
          baseGradient.addColorStop(0.5, "#0b1530");
          baseGradient.addColorStop(1, "#050910");
          break;
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
        case "brand":
          drawBrandTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "aurora":
          drawAuroraTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "constellation":
          drawConstellationTheme(ctx, canvas, time, offsetX, offsetY);
          break;
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

    function drawBrandTheme(ctx, canvas, time, offsetX, offsetY) {
      const glow = ctx.createRadialGradient(
        canvas.width * 0.5 + offsetX * 1.2,
        canvas.height * 0.45 + offsetY * 0.8,
        0,
        canvas.width * 0.5 + offsetX * 1.2,
        canvas.height * 0.45 + offsetY * 0.8,
        canvas.width * 0.48,
      );
      glow.addColorStop(0, "rgba(147, 255, 214, 0.34)");
      glow.addColorStop(0.3, "rgba(93, 233, 196, 0.18)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(150, 255, 208, 0.14)";
      ctx.lineWidth = 1;
      const spacing = 56;
      const offsetGridX = (time * 24) % spacing;
      const offsetGridY = (time * 18) % spacing;

      for (let x = offsetGridX; x < canvas.width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = offsetGridY; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      drawFloatingParticles(ctx, time, ["rgba(150, 255, 208, ", "rgba(96, 165, 250, "], 0.75);
    }

    function drawAuroraTheme(ctx, canvas, time, offsetX, offsetY) {
      const glowLeft = ctx.createRadialGradient(
        canvas.width * 0.32 + offsetX * 1.2,
        canvas.height * 0.35 + offsetY * 1.1,
        0,
        canvas.width * 0.32 + offsetX * 1.2,
        canvas.height * 0.35 + offsetY * 1.1,
        canvas.width * 0.42,
      );
      glowLeft.addColorStop(0, "rgba(132, 255, 201, 0.35)");
      glowLeft.addColorStop(1, "transparent");
      ctx.fillStyle = glowLeft;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const glowRight = ctx.createRadialGradient(
        canvas.width * 0.74 - offsetX * 1.4,
        canvas.height * 0.72 - offsetY * 1.2,
        0,
        canvas.width * 0.74 - offsetX * 1.4,
        canvas.height * 0.72 - offsetY * 1.2,
        canvas.width * 0.38,
      );
      glowRight.addColorStop(0, "rgba(115, 170, 255, 0.28)");
      glowRight.addColorStop(1, "transparent");
      ctx.fillStyle = glowRight;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(132, 255, 201, ", "rgba(115, 170, 255, ", "rgba(255, 255, 255, "], 0.9);
    }

    function drawConstellationTheme(ctx, canvas, time, offsetX, offsetY) {
      const glow = ctx.createRadialGradient(
        canvas.width * 0.5 + offsetX * 1.2,
        canvas.height * 0.4 + offsetY * 0.9,
        0,
        canvas.width * 0.5 + offsetX * 1.2,
        canvas.height * 0.4 + offsetY * 0.9,
        canvas.width * 0.52,
      );
      glow.addColorStop(0, "rgba(255,255,255,0.18)");
      glow.addColorStop(0.4, "rgba(133,170,255,0.16)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const starChance = Math.sin(time * 10) * 0.5 + 0.5;
      particlesRef.current.forEach((particle, i) => {
        if (i % 3 === 0) {
          ctx.fillStyle = `rgba(255,255,255,${(particle.alpha * (0.4 + starChance)).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, Math.max(0.7, particle.size * 0.75), 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

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
  }, [theme]);

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