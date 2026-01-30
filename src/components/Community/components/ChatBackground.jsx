import React, { useEffect, useRef } from "react";

const ChatBackground = ({ theme = "elegant" }) => {
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
        'space': 'starfield',
        'neon': 'elegant',
        'tech': 'crypto',
        'matrix': 'minimal',
        'security': 'crypto',
        'minimal': 'minimal',
        'lime': 'elegant',
        'gold': 'royal',
        'noir': 'minimal',
        'midnight': 'elegant'
      };
      if (mapping[theme]) activeTheme = mapping[theme];
      
      const count = activeTheme === "minimal" ? 40 : activeTheme === "starfield" ? 180 : 70;
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
        'space': 'starfield',
        'neon': 'elegant',
        'tech': 'crypto',
        'matrix': 'minimal',
        'security': 'crypto',
        'minimal': 'minimal',
        'lime': 'elegant',
        'gold': 'royal',
        'noir': 'minimal',
        'midnight': 'elegant'
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
        case "ocean":
          baseGradient.addColorStop(0, "#020817");
          baseGradient.addColorStop(0.5, "#0c1426");
          baseGradient.addColorStop(1, "#030b1a");
          break;
        case "sunset":
          baseGradient.addColorStop(0, "#1a0a0f");
          baseGradient.addColorStop(0.5, "#160b13");
          baseGradient.addColorStop(1, "#100609");
          break;
        case "forest":
          baseGradient.addColorStop(0, "#0a120a");
          baseGradient.addColorStop(0.5, "#0e1a0e");
          baseGradient.addColorStop(1, "#070e07");
          break;
        case "crypto":
          baseGradient.addColorStop(0, "#050510");
          baseGradient.addColorStop(0.5, "#0b0b1a");
          baseGradient.addColorStop(1, "#06060e");
          break;
        case "royal":
          baseGradient.addColorStop(0, "#100825");
          baseGradient.addColorStop(0.5, "#150b2a");
          baseGradient.addColorStop(1, "#0b051a");
          break;
        case "minimal":
          baseGradient.addColorStop(0, "#000000");
          baseGradient.addColorStop(0.5, "#0c0c0c");
          baseGradient.addColorStop(1, "#000000");
          break;
        case "starfield":
          baseGradient.addColorStop(0, "#000205");
          baseGradient.addColorStop(0.5, "#050512");
          baseGradient.addColorStop(1, "#000000");
          break;
        case "aurora":
          baseGradient.addColorStop(0, "#0a0516");
          baseGradient.addColorStop(0.5, "#0e0a1c");
          baseGradient.addColorStop(1, "#060512");
          break;
        case "corporate":
          baseGradient.addColorStop(0, "#0f1419");
          baseGradient.addColorStop(0.5, "#1b2028");
          baseGradient.addColorStop(1, "#0b0e13");
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
        case "ocean":
          drawOceanTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "sunset":
          drawSunsetTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "forest":
          drawForestTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "crypto":
          drawCryptoTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "royal":
          drawRoyalTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "minimal":
          drawMinimalTheme(ctx, canvas, time);
          break;
        case "starfield":
          drawStarfieldTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "aurora":
          drawAuroraTheme(ctx, canvas, time, offsetX, offsetY);
          break;
        case "corporate":
          drawCorporateTheme(ctx, canvas, time, offsetX, offsetY);
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

    function drawOceanTheme(ctx, canvas, time, offsetX, offsetY) {
      const wave1 = Math.sin(time * 20) * 0.08 + 0.13;
      const wave2 = Math.sin(time * 20 + Math.PI * 0.5) * 0.08 + 0.13;

      const oceanWave1 = ctx.createRadialGradient(
        canvas.width * 0.3 + offsetX * 0.5,
        canvas.height * (0.4 + Math.sin(time * 15) * 0.03),
        0,
        canvas.width * 0.3,
        canvas.height * 0.4,
        canvas.width * 0.65,
      );
      oceanWave1.addColorStop(0, `rgba(0, 191, 255, ${wave1 * 1.1})`);
      oceanWave1.addColorStop(0.3, `rgba(30, 144, 255, ${wave1 * 0.7})`);
      oceanWave1.addColorStop(0.6, `rgba(25, 118, 210, ${wave1 * 0.4})`);
      oceanWave1.addColorStop(1, "transparent");
      ctx.fillStyle = oceanWave1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const oceanWave2 = ctx.createRadialGradient(
        canvas.width * 0.7 - offsetX * 0.5,
        canvas.height * (0.6 + Math.sin(time * 15 + Math.PI) * 0.03),
        0,
        canvas.width * 0.7,
        canvas.height * 0.6,
        canvas.width * 0.65,
      );
      oceanWave2.addColorStop(0, `rgba(0, 206, 209, ${wave2 * 1.1})`);
      oceanWave2.addColorStop(0.3, `rgba(64, 224, 208, ${wave2 * 0.7})`);
      oceanWave2.addColorStop(0.6, `rgba(32, 178, 170, ${wave2 * 0.4})`);
      oceanWave2.addColorStop(1, "transparent");
      ctx.fillStyle = oceanWave2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(0, 191, 255, ", "rgba(0, 206, 209, "], 1.2);
    }

    function drawSunsetTheme(ctx, canvas, time, offsetX, offsetY) {
      const pulse = Math.sin(time * 22) * 0.07 + 0.12;

      const purpleGlow = ctx.createRadialGradient(
        canvas.width * 0.2 + offsetX,
        canvas.height * 0.35 + offsetY,
        0,
        canvas.width * 0.2,
        canvas.height * 0.35,
        canvas.width * 0.6,
      );
      purpleGlow.addColorStop(0, `rgba(147, 51, 234, ${pulse * 1.2})`);
      purpleGlow.addColorStop(0.3, `rgba(126, 34, 206, ${pulse * 0.8})`);
      purpleGlow.addColorStop(0.6, `rgba(107, 33, 168, ${pulse * 0.4})`);
      purpleGlow.addColorStop(1, "transparent");
      ctx.fillStyle = purpleGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sunsetGlow = ctx.createRadialGradient(
        canvas.width * 0.8 - offsetX,
        canvas.height * 0.65 - offsetY,
        0,
        canvas.width * 0.8,
        canvas.height * 0.65,
        canvas.width * 0.6,
      );
      sunsetGlow.addColorStop(0, `rgba(251, 113, 133, ${pulse * 1.3})`);
      sunsetGlow.addColorStop(0.2, `rgba(249, 115, 22, ${pulse * 0.9})`);
      sunsetGlow.addColorStop(0.5, `rgba(168, 85, 247, ${pulse * 0.5})`);
      sunsetGlow.addColorStop(0.8, `rgba(139, 92, 246, ${pulse * 0.2})`);
      sunsetGlow.addColorStop(1, "transparent");
      ctx.fillStyle = sunsetGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(251, 113, 133, ", "rgba(147, 51, 234, "], 0.7);
    }

    function drawForestTheme(ctx, canvas, time, offsetX, offsetY) {
      const pulse = Math.sin(time * 20) * 0.08 + 0.11;

      const forestGlow1 = ctx.createRadialGradient(
        canvas.width * 0.35 + offsetX * 0.8,
        canvas.height * 0.4 + offsetY * 0.8,
        0,
        canvas.width * 0.35,
        canvas.height * 0.4,
        canvas.width * 0.65,
      );
      forestGlow1.addColorStop(0, `rgba(34, 197, 94, ${pulse * 1.2})`);
      forestGlow1.addColorStop(0.4, `rgba(22, 163, 74, ${pulse * 0.7})`);
      forestGlow1.addColorStop(0.7, `rgba(21, 128, 61, ${pulse * 0.3})`);
      forestGlow1.addColorStop(1, "transparent");
      ctx.fillStyle = forestGlow1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const forestGlow2 = ctx.createRadialGradient(
        canvas.width * 0.65 - offsetX * 0.8,
        canvas.height * 0.6 - offsetY * 0.8,
        0,
        canvas.width * 0.65,
        canvas.height * 0.6,
        canvas.width * 0.55,
      );
      forestGlow2.addColorStop(0, `rgba(132, 204, 22, ${pulse * 1.1})`);
      forestGlow2.addColorStop(0.4, `rgba(101, 163, 13, ${pulse * 0.6})`);
      forestGlow2.addColorStop(0.7, `rgba(77, 124, 15, ${pulse * 0.25})`);
      forestGlow2.addColorStop(1, "transparent");
      ctx.fillStyle = forestGlow2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(34, 197, 94, ", "rgba(132, 204, 22, "]);
    }

    function drawCryptoTheme(ctx, canvas, time, offsetX, offsetY) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.06)";
      ctx.lineWidth = 1;
      const hexSize = 90;
      for (let y = -hexSize; y < canvas.height + hexSize; y += hexSize * 1.5) {
        for (let x = -hexSize; x < canvas.width + hexSize; x += hexSize * Math.sqrt(3)) {
          const offsetY = (x / (hexSize * Math.sqrt(3))) % 2 === 0 ? 0 : hexSize * 0.75;
          const pulse = Math.sin(time * 30 + x * 0.002 + y * 0.002) * 0.25 + 0.25;
          ctx.globalAlpha = pulse * 0.12;
          drawHexagon(ctx, x, y + offsetY, hexSize);
          ctx.globalAlpha = 1;
        }
      }

      const cryptoPulse = Math.sin(time * 25) * 0.09 + 0.14;
      const cryptoGlow1 = ctx.createRadialGradient(
        canvas.width * 0.3 + offsetX,
        canvas.height * 0.4 + offsetY,
        0,
        canvas.width * 0.3,
        canvas.height * 0.4,
        canvas.width * 0.55,
      );
      cryptoGlow1.addColorStop(0, `rgba(59, 130, 246, ${cryptoPulse * 1.2})`);
      cryptoGlow1.addColorStop(0.4, `rgba(37, 99, 235, ${cryptoPulse * 0.6})`);
      cryptoGlow1.addColorStop(0.7, `rgba(29, 78, 216, ${cryptoPulse * 0.25})`);
      cryptoGlow1.addColorStop(1, "transparent");
      ctx.fillStyle = cryptoGlow1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cryptoGlow2 = ctx.createRadialGradient(
        canvas.width * 0.7 - offsetX,
        canvas.height * 0.6 - offsetY,
        0,
        canvas.width * 0.7,
        canvas.height * 0.6,
        canvas.width * 0.55,
      );
      cryptoGlow2.addColorStop(0, `rgba(16, 185, 129, ${cryptoPulse * 1.3})`);
      cryptoGlow2.addColorStop(0.4, `rgba(5, 150, 105, ${cryptoPulse * 0.7})`);
      cryptoGlow2.addColorStop(0.7, `rgba(4, 120, 87, ${cryptoPulse * 0.3})`);
      cryptoGlow2.addColorStop(1, "transparent");
      ctx.fillStyle = cryptoGlow2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(59, 130, 246, ", "rgba(16, 185, 129, "], 0.9, true);
    }

    function drawRoyalTheme(ctx, canvas, time, offsetX, offsetY) {
      const royalPulse = Math.sin(time * 23) * 0.08 + 0.13;

      const purpleRoyal = ctx.createRadialGradient(
        canvas.width * 0.4 + offsetX * 0.7,
        canvas.height * 0.45 + offsetY * 0.7,
        0,
        canvas.width * 0.4,
        canvas.height * 0.45,
        canvas.width * 0.65,
      );
      purpleRoyal.addColorStop(0, `rgba(109, 40, 217, ${royalPulse * 1.3})`);
      purpleRoyal.addColorStop(0.3, `rgba(88, 28, 135, ${royalPulse * 0.8})`);
      purpleRoyal.addColorStop(0.6, `rgba(76, 29, 149, ${royalPulse * 0.4})`);
      purpleRoyal.addColorStop(1, "transparent");
      ctx.fillStyle = purpleRoyal;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const goldRoyal = ctx.createRadialGradient(
        canvas.width * 0.6 - offsetX * 0.7,
        canvas.height * 0.55 - offsetY * 0.7,
        0,
        canvas.width * 0.6,
        canvas.height * 0.55,
        canvas.width * 0.55,
      );
      goldRoyal.addColorStop(0, `rgba(217, 119, 6, ${royalPulse * 1.4})`);
      goldRoyal.addColorStop(0.3, `rgba(180, 83, 9, ${royalPulse * 0.8})`);
      goldRoyal.addColorStop(0.6, `rgba(146, 64, 14, ${royalPulse * 0.3})`);
      goldRoyal.addColorStop(1, "transparent");
      ctx.fillStyle = goldRoyal;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(109, 40, 217, ", "rgba(217, 119, 6, "], 0.65);
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

    function drawStarfieldTheme(ctx, canvas, time, offsetX, offsetY) {
      particlesRef.current.forEach((particle, i) => {
        const twinkle = Math.sin(time * 60 + i * 0.7) * 0.35 + 0.65;
        const size = particle.size * (0.8 + twinkle * 0.4);
        
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(
          particle.x + offsetX * 0.15,
          particle.y + offsetY * 0.15,
          size,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (particle.alpha > 0.5) {
          ctx.fillStyle = `rgba(200, 220, 255, ${particle.alpha * twinkle * 0.3})`;
          ctx.beginPath();
          ctx.arc(
            particle.x + offsetX * 0.15,
            particle.y + offsetY * 0.15,
            size * 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      });

      const nebulaPulse = Math.sin(time * 18) * 0.05 + 0.08;
      const nebula = ctx.createRadialGradient(
        canvas.width * 0.4,
        canvas.height * 0.5,
        0,
        canvas.width * 0.4,
        canvas.height * 0.5,
        canvas.width * 0.75,
      );
      nebula.addColorStop(0, `rgba(147, 51, 234, ${nebulaPulse})`);
      nebula.addColorStop(0.3, `rgba(79, 70, 229, ${nebulaPulse * 0.7})`);
      nebula.addColorStop(0.6, `rgba(59, 130, 246, ${nebulaPulse * 0.4})`);
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawAuroraTheme(ctx, canvas, time, offsetX, offsetY) {
      ctx.globalAlpha = 0.12;
      
      for (let i = 0; i < 6; i++) {
        const waveOffset = time * 20 + i * Math.PI * 0.35;
        const gradient = ctx.createLinearGradient(
          0,
          canvas.height * (0.25 + i * 0.12),
          canvas.width,
          canvas.height * (0.25 + i * 0.12)
        );
        
        const colors = [
          [16, 185, 129],
          [59, 130, 246],
          [168, 85, 247],
          [236, 72, 153],
          [34, 211, 238],
          [132, 204, 22],
        ];
        
        const colorSet = colors[i % colors.length];
        const wave = Math.sin(waveOffset) * 0.08;
        
        gradient.addColorStop(0, `rgba(${colorSet[0]}, ${colorSet[1]}, ${colorSet[2]}, 0)`);
        gradient.addColorStop(0.25 + wave, `rgba(${colorSet[0]}, ${colorSet[1]}, ${colorSet[2]}, 0.5)`);
        gradient.addColorStop(0.5, `rgba(${colorSet[0]}, ${colorSet[1]}, ${colorSet[2]}, 0.6)`);
        gradient.addColorStop(0.75 - wave, `rgba(${colorSet[0]}, ${colorSet[1]}, ${colorSet[2]}, 0.5)`);
        gradient.addColorStop(1, `rgba(${colorSet[0]}, ${colorSet[1]}, ${colorSet[2]}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.globalAlpha = 1;
      drawFloatingParticles(ctx, time, ["rgba(16, 185, 129, ", "rgba(168, 85, 247, ", "rgba(59, 130, 246, "], 0.55);
    }

    function drawCorporateTheme(ctx, canvas, time, offsetX, offsetY) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.05)";
      ctx.lineWidth = 1;
      
      const gridSize = 110;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const corpPulse = Math.sin(time * 20) * 0.06 + 0.10;
      const corpGlow = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.5,
        0,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.65,
      );
      corpGlow.addColorStop(0, `rgba(59, 130, 246, ${corpPulse * 1.2})`);
      corpGlow.addColorStop(0.4, `rgba(37, 99, 235, ${corpPulse * 0.6})`);
      corpGlow.addColorStop(0.7, `rgba(29, 78, 216, ${corpPulse * 0.25})`);
      corpGlow.addColorStop(1, "transparent");
      ctx.fillStyle = corpGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFloatingParticles(ctx, time, ["rgba(100, 116, 139, ", "rgba(59, 130, 246, "], 0.45);
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

    function drawHexagon(ctx, x, y, size) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
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