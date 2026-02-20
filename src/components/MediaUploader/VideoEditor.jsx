import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Scissors,
  Wand2,
  Type,
  Music,
  Share2,
  Loader,
  ChevronLeft,
  ChevronRight,
  Film,
  Layers,
  Split,
  Plus,
  Trash2,
  Settings,
  GripVertical,
  SkipBack,
  SkipForward,
  Move,
  Zap,
  Sun,
  Check,
  Clock,
} from "lucide-react";
import SoundLibrary from "./SoundLibrary";
import ShareModal from "./ShareModal";
import "./VideoEditor.css";

const FILTERS = [
  { id: "normal", name: "Normal", css: "none" },
  {
    id: "paris",
    name: "Paris",
    css: "sepia(0.3) contrast(1.1) brightness(1.05)",
  },
  {
    id: "los-angeles",
    name: "Los Angeles",
    css: "contrast(1.15) brightness(1.1) saturate(1.3)",
  },
  {
    id: "oslo",
    name: "Oslo",
    css: "contrast(1.05) brightness(0.95) saturate(0.85) hue-rotate(-5deg)",
  },
  {
    id: "lagos",
    name: "Lagos",
    css: "sepia(0.4) saturate(1.5) brightness(1.1) contrast(1.1)",
  },
  { id: "noir", name: "Noir", css: "grayscale(1) contrast(1.3)" },
  { id: "vivid", name: "Vivid", css: "saturate(1.8) contrast(1.2)" },
  {
    id: "warm",
    name: "Warm",
    css: "sepia(0.35) saturate(1.4) brightness(1.08)",
  },
  { id: "cool", name: "Cool", css: "hue-rotate(15deg) saturate(1.15)" },
  {
    id: "fade",
    name: "Fade",
    css: "brightness(1.12) saturate(0.75) contrast(0.92)",
  },
  {
    id: "vintage",
    name: "Vintage",
    css: "sepia(0.5) contrast(1.15) brightness(0.95)",
  },
  {
    id: "dramatic",
    name: "Dramatic",
    css: "contrast(1.4) brightness(0.9) saturate(0.85)",
  },
];

const TRANSITIONS = [
  { id: "none", name: "None", type: "cut", icon: "⊟", duration: 0 },
  {
    id: "fade-black",
    name: "Fade Black",
    type: "fade",
    duration: 0.5,
    color: "#000",
    icon: "⬤",
  },
  {
    id: "fade-white",
    name: "Fade White",
    type: "fade",
    duration: 0.5,
    color: "#fff",
    icon: "○",
  },
  {
    id: "crossfade",
    name: "Crossfade",
    type: "crossfade",
    duration: 0.8,
    icon: "⚬",
  },
  {
    id: "dissolve",
    name: "Dissolve",
    type: "dissolve",
    duration: 1,
    icon: "◎",
  },
  {
    id: "wipe-right",
    name: "Wipe Right",
    type: "wipe",
    direction: "right",
    duration: 0.6,
    icon: "▶",
  },
  {
    id: "wipe-left",
    name: "Wipe Left",
    type: "wipe",
    direction: "left",
    duration: 0.6,
    icon: "◀",
  },
  {
    id: "wipe-up",
    name: "Wipe Up",
    type: "wipe",
    direction: "up",
    duration: 0.6,
    icon: "▲",
  },
  {
    id: "wipe-down",
    name: "Wipe Down",
    type: "wipe",
    direction: "down",
    duration: 0.6,
    icon: "▼",
  },
  {
    id: "slide-right",
    name: "Slide Right",
    type: "slide",
    direction: "right",
    duration: 0.5,
    icon: "⇨",
  },
  {
    id: "slide-left",
    name: "Slide Left",
    type: "slide",
    direction: "left",
    duration: 0.5,
    icon: "⇦",
  },
  {
    id: "zoom-in",
    name: "Zoom In",
    type: "zoom",
    direction: "in",
    duration: 0.7,
    icon: "◎",
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    type: "zoom",
    direction: "out",
    duration: 0.7,
    icon: "◉",
  },
  {
    id: "blur-transition",
    name: "Blur",
    type: "blur",
    duration: 0.8,
    icon: "○",
  },
  { id: "swirl", name: "Swirl", type: "swirl", duration: 1, icon: "◔" },
];

const FADE_OPTIONS = [
  { id: "none", name: "None", in: 0, out: 0, icon: "⊟" },
  { id: "quick-fade", name: "Quick Fade", in: 0.3, out: 0.3, icon: "◗" },
  { id: "smooth-fade", name: "Smooth Fade", in: 0.5, out: 0.5, icon: "◐" },
  { id: "slow-fade", name: "Slow Fade", in: 1, out: 1, icon: "◑" },
  { id: "fade-in-quick", name: "Fade In Quick", in: 0.4, out: 0, icon: "◜" },
  { id: "fade-in-slow", name: "Fade In Slow", in: 1.2, out: 0, icon: "◝" },
  { id: "fade-out-quick", name: "Fade Out Quick", in: 0, out: 0.4, icon: "◟" },
  { id: "fade-out-slow", name: "Fade Out Slow", in: 0, out: 1.2, icon: "◞" },
  {
    id: "fade-through-black",
    name: "Fade Through Black",
    in: 0.6,
    out: 0.6,
    color: "#000",
    icon: "⬤",
  },
  {
    id: "fade-through-white",
    name: "Fade Through White",
    in: 0.6,
    out: 0.6,
    color: "#fff",
    icon: "○",
  },
  { id: "cinematic", name: "Cinematic", in: 1.5, out: 1.5, icon: "◈" },
  { id: "dramatic", name: "Dramatic", in: 0.2, out: 1.8, icon: "◆" },
];

const DURATION_PRESETS = [0.3, 0.5, 0.7, 1.0, 1.5, 2.0];

const EFFECTS = [
  {
    id: "brightness",
    name: "Brightness",
    icon: "☀",
    min: 0,
    max: 2,
    step: 0.05,
    default: 1,
  },
  {
    id: "contrast",
    name: "Contrast",
    icon: "◐",
    min: 0,
    max: 2,
    step: 0.05,
    default: 1,
  },
  {
    id: "saturation",
    name: "Saturation",
    icon: "🎨",
    min: 0,
    max: 3,
    step: 0.05,
    default: 1,
  },
  {
    id: "blur",
    name: "Blur",
    icon: "○",
    min: 0,
    max: 10,
    step: 0.5,
    default: 0,
  },
  { id: "hue", name: "Hue", icon: "🌈", min: 0, max: 360, step: 1, default: 0 },
];

const SPEEDS = [
  { value: 0.25, label: "0.25×" },
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1, label: "1×" },
  { value: 1.5, label: "1.5×" },
  { value: 2, label: "2×" },
  { value: 3, label: "3×" },
];

const FONTS = [
  "Arial",
  "Georgia",
  "Impact",
  "Courier New",
  "Verdana",
  "Times New Roman",
];

const fmt = (s) => {
  if (s == null || isNaN(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const VideoEditor = ({ videoFile, onSave, onClose, onPost }) => {
  const [url, setUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [clips, setClips] = useState([]);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [draggingClipIndex, setDraggingClipIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [trimMode, setTrimMode] = useState(null);

  const [activeFilter, setActiveFilter] = useState("normal");
  const [effects, setEffects] = useState({});
  const [rotation, setRotation] = useState(0);

  const [activeTransition, setActiveTransition] = useState("none");
  const [activeFade, setActiveFade] = useState("none");
  const [previewingTransition, setPreviewingTransition] = useState(null);
  const [previewingFade, setPreviewingFade] = useState(null);
  const [showTransitionDuration, setShowTransitionDuration] = useState(null);
  const [showFadeDuration, setShowFadeDuration] = useState(null);
  const [customTransitionDuration, setCustomTransitionDuration] = useState({});
  const [customFadeDuration, setCustomFadeDuration] = useState({});

  const [textOverlays, setTextOverlays] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [draftText, setDraftText] = useState({});
  const [draggingTextId, setDraggingTextId] = useState(null);
  const textDragOffset = useRef({ x: 0, y: 0 });

  const [pipLayers, setPipLayers] = useState([]);
  const [draggingPipId, setDraggingPipId] = useState(null);
  const pipDragOffset = useRef({ x: 0, y: 0 });
  const pipInputRef = useRef(null);

  const [audioTracks, setAudioTracks] = useState([]);
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);
  const [selectedSound, setSelectedSound] = useState(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [exportedVideoFile, setExportedVideoFile] = useState(null);

  const [activeTab, setActiveTab] = useState(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const toolTabsRef = useRef(null);

  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const dragStartH = useRef(null);
  const draggingSheet = useRef(false);
  const clipsRef = useRef([]);
  const activeIdxRef = useRef(0);
  const timelineCanvasRef = useRef(null);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    activeIdxRef.current = activeClipIndex;
  }, [activeClipIndex]);

  useEffect(() => {
    if (!videoFile) return;
    const u = URL.createObjectURL(videoFile);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [videoFile]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      const d = v.duration;
      setDuration(d);
      const init = [
        { start: 0, end: d, id: Date.now(), originalStart: 0, originalEnd: d },
      ];
      setClips(init);
      clipsRef.current = init;
      setActiveClipIndex(0);
      activeIdxRef.current = 0;
    };
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [url]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const engine = () => {
      const clips = clipsRef.current;
      const idx = activeIdxRef.current;
      if (!clips.length) return;
      const clip = clips[idx];
      if (!clip) return;
      if (v.currentTime < clip.start - 0.08) {
        v.currentTime = clip.start;
        return;
      }
      if (v.currentTime >= clip.end - 0.05) {
        if (idx < clips.length - 1) {
          const ni = idx + 1;
          activeIdxRef.current = ni;
          setActiveClipIndex(ni);
          v.currentTime = clips[ni].start;
        } else {
          v.pause();
          activeIdxRef.current = 0;
          setActiveClipIndex(0);
          v.currentTime = clips[0].start;
        }
      }
    };
    v.addEventListener("timeupdate", engine);
    return () => v.removeEventListener("timeupdate", engine);
  }, [url]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || !clipsRef.current.length) return;
    if (playing) {
      v.pause();
      return;
    }
    const clip = clipsRef.current[activeIdxRef.current];
    if (!clip) return;
    if (v.currentTime < clip.start || v.currentTime >= clip.end)
      v.currentTime = clip.start;
    v.play().catch(() => {});
  };

  const changeSpeed = (s) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const toggleMute = () => {
    const n = !muted;
    setMuted(n);
    if (videoRef.current) videoRef.current.muted = n;
  };

  const changeVolume = (val) => {
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
  };

  const jumpToClip = useCallback((index) => {
    if (index < 0 || index >= clipsRef.current.length) return;
    activeIdxRef.current = index;
    setActiveClipIndex(index);
    if (videoRef.current)
      videoRef.current.currentTime = clipsRef.current[index].start;
  }, []);

  const splitClip = () => {
    const clip = clips[activeClipIndex];
    if (!clip) return;
    if (currentTime <= clip.start + 0.05 || currentTime >= clip.end - 0.05) {
      alert("Seek to a point inside this clip to split.");
      return;
    }
    const t = currentTime;
    const n = [...clips];
    n.splice(
      activeClipIndex,
      1,
      {
        start: clip.start,
        end: t,
        id: Date.now(),
        originalStart: clip.start,
        originalEnd: t,
      },
      {
        start: t,
        end: clip.end,
        id: Date.now() + 1,
        originalStart: t,
        originalEnd: clip.end,
      },
    );
    clipsRef.current = n;
    setClips(n);
    if (videoRef.current) videoRef.current.currentTime = clip.start;
  };

  const handleTrimDrag = useCallback(
    (e, mode) => {
      if (!trimMode) return;
      const rect = timelineCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const clip = clips[activeClipIndex];
      if (!clip) return;

      const totalDuration = getTotalDuration();
      const newTime = (x / rect.width) * totalDuration;

      setClips((prev) =>
        prev.map((c, i) => {
          if (i !== activeClipIndex) return c;
          if (mode === "start") {
            return {
              ...c,
              start: Math.max(c.originalStart, Math.min(newTime, c.end - 0.1)),
            };
          } else {
            return {
              ...c,
              end: Math.min(c.originalEnd, Math.max(newTime, c.start + 0.1)),
            };
          }
        }),
      );
    },
    [trimMode, clips, activeClipIndex],
  );

  const deleteClip = (index) => {
    if (clips.length <= 1) {
      alert("Cannot delete the only clip.");
      return;
    }
    const n = clips.filter((_, i) => i !== index);
    const ni = Math.min(activeClipIndex, n.length - 1);
    clipsRef.current = n;
    activeIdxRef.current = ni;
    setClips(n);
    setActiveClipIndex(ni);
    if (videoRef.current) videoRef.current.currentTime = n[ni].start;
  };

  const handleClipDragStart = (e, i) => {
    setDraggingClipIndex(i);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleClipDragOver = (e, i) => {
    e.preventDefault();
    setDragOverIndex(i);
  };

  const handleClipDrop = (e, i) => {
    e.preventDefault();
    const from = draggingClipIndex;
    setDraggingClipIndex(null);
    setDragOverIndex(null);
    if (from === null || from === i) return;
    const n = [...clips];
    const [d] = n.splice(from, 1);
    n.splice(i, 0, d);
    let ni = activeClipIndex;
    if (activeClipIndex === from) ni = i;
    else if (from < activeClipIndex && i >= activeClipIndex)
      ni = activeClipIndex - 1;
    else if (from > activeClipIndex && i <= activeClipIndex)
      ni = activeClipIndex + 1;
    clipsRef.current = n;
    activeIdxRef.current = ni;
    setClips(n);
    setActiveClipIndex(ni);
    if (videoRef.current) videoRef.current.currentTime = n[ni].start;
  };

  const handleClipDragEnd = () => {
    setDraggingClipIndex(null);
    setDragOverIndex(null);
  };

  const openAddText = () => {
    const draft = {
      id: null,
      text: "Your text",
      x: 50,
      y: 40,
      fontSize: 32,
      color: "#ffffff",
      fontFamily: "Arial",
      fontWeight: "bold",
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
    };
    setDraftText(draft);
    setEditingTextId(null);
    setShowTextEditor(true);
  };

  const openEditText = (overlay) => {
    setDraftText({ ...overlay });
    setEditingTextId(overlay.id);
    setShowTextEditor(true);
  };

  const saveText = () => {
    if (!draftText.text?.trim()) return;
    if (editingTextId !== null) {
      setTextOverlays((prev) =>
        prev.map((o) =>
          o.id === editingTextId ? { ...draftText, id: editingTextId } : o,
        ),
      );
    } else {
      setTextOverlays((prev) => [...prev, { ...draftText, id: Date.now() }]);
    }
    setShowTextEditor(false);
    setEditingTextId(null);
  };

  const deleteTextOverlay = (id) =>
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));

  const startTextDrag = (e, overlay) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    textDragOffset.current = {
      x: cx - rect.left - (overlay.x / 100) * rect.width,
      y: cy - rect.top - (overlay.y / 100) * rect.height,
    };
    setDraggingTextId(overlay.id);
  };

  const moveTextDrag = useCallback(
    (e) => {
      if (!draggingTextId) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const nx =
        ((cx - rect.left - textDragOffset.current.x) / rect.width) * 100;
      const ny =
        ((cy - rect.top - textDragOffset.current.y) / rect.height) * 100;
      setTextOverlays((prev) =>
        prev.map((o) =>
          o.id === draggingTextId
            ? {
                ...o,
                x: Math.max(0, Math.min(100, nx)),
                y: Math.max(0, Math.min(100, ny)),
              }
            : o,
        ),
      );
    },
    [draggingTextId],
  );

  const endTextDrag = useCallback(() => setDraggingTextId(null), []);

  const handlePipUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return;
    const objUrl = URL.createObjectURL(file);

    if (isImage) {
      const img = new window.Image();
      img.onload = () => {
        setPipLayers((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: "image",
            url: objUrl,
            imgEl: img,
            x: 60,
            y: 5,
            width: 30,
            height: 30,
            startTime: 0,
            endTime: duration,
            opacity: 1,
          },
        ]);
      };
      img.src = objUrl;
    } else {
      const vid = document.createElement("video");
      vid.src = objUrl;
      vid.loop = true;
      vid.muted = true;
      vid.preload = "auto";
      vid.load();
      setPipLayers((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: "video",
          url: objUrl,
          vidEl: vid,
          x: 60,
          y: 5,
          width: 30,
          height: 30,
          startTime: 0,
          endTime: duration,
          opacity: 1,
        },
      ]);
    }
    e.target.value = "";
  };

  const deletePipLayer = (id) => {
    setPipLayers((prev) => {
      const layer = prev.find((l) => l.id === id);
      if (layer?.url) URL.revokeObjectURL(layer.url);
      return prev.filter((l) => l.id !== id);
    });
  };

  const startPipDrag = (e, layer) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    pipDragOffset.current = {
      x: cx - rect.left - (layer.x / 100) * rect.width,
      y: cy - rect.top - (layer.y / 100) * rect.height,
    };
    setDraggingPipId(layer.id);
  };

  const movePipDrag = useCallback(
    (e) => {
      if (!draggingPipId) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const nx =
        ((cx - rect.left - pipDragOffset.current.x) / rect.width) * 100;
      const ny =
        ((cy - rect.top - pipDragOffset.current.y) / rect.height) * 100;
      setPipLayers((prev) =>
        prev.map((l) =>
          l.id === draggingPipId
            ? {
                ...l,
                x: Math.max(0, Math.min(100, nx)),
                y: Math.max(0, Math.min(100, ny)),
              }
            : l,
        ),
      );
    },
    [draggingPipId],
  );

  const endPipDrag = useCallback(() => setDraggingPipId(null), []);

  useEffect(() => {
    const onMove = (e) => {
      moveTextDrag(e);
      movePipDrag(e);
      handleTrimDrag(e, trimMode);
    };
    const onEnd = () => {
      endTextDrag();
      endPipDrag();
      setTrimMode(null);
    };
    const onTMove = (e) => {
      if (draggingTextId || draggingPipId || trimMode) {
        e.preventDefault();
        onMove(e);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [
    moveTextDrag,
    endTextDrag,
    movePipDrag,
    endPipDrag,
    draggingTextId,
    draggingPipId,
    trimMode,
    handleTrimDrag,
  ]);

  const handleSoundSelect = (sound) => {
    setAudioTracks((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: sound.name,
        url: sound.url,
        startTime: 0,
        volume: 1,
      },
    ]);
    setShowSoundLibrary(false);
  };

  const deleteAudioTrack = (id) => {
    setAudioTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const getEffect = useCallback(
    (id) => effects[id] ?? EFFECTS.find((e) => e.id === id)?.default ?? 1,
    [effects],
  );

  const setEffect = (id, val) => setEffects((prev) => ({ ...prev, [id]: val }));

  const buildFilterCss = useCallback(() => {
    const base = FILTERS.find((f) => f.id === activeFilter)?.css || "none";
    const efx = [];
    const br = getEffect("brightness"),
      co = getEffect("contrast"),
      sa = getEffect("saturation"),
      bl = getEffect("blur"),
      hu = getEffect("hue");
    if (br !== 1) efx.push(`brightness(${br})`);
    if (co !== 1) efx.push(`contrast(${co})`);
    if (sa !== 1) efx.push(`saturate(${sa})`);
    if (bl > 0) efx.push(`blur(${bl}px)`);
    if (hu !== 0) efx.push(`hue-rotate(${hu}deg)`);
    return [base, ...efx].filter((x) => x && x !== "none").join(" ") || "none";
  }, [activeFilter, getEffect]);

  const activeClip = clips[activeClipIndex] || null;
  const clipLocalTime = activeClip
    ? Math.max(0, currentTime - activeClip.start)
    : 0;
  const clipDuration = activeClip
    ? Math.max(0, activeClip.end - activeClip.start)
    : 0;
  const filterCss = buildFilterCss();

  const getTransitionDuration = (transId) => {
    if (customTransitionDuration[transId] !== undefined) {
      return customTransitionDuration[transId];
    }
    const trans = TRANSITIONS.find((t) => t.id === transId);
    return trans?.duration || 0.5;
  };

  const getFadeDuration = (fadeId) => {
    if (customFadeDuration[fadeId]) {
      return customFadeDuration[fadeId];
    }
    const fade = FADE_OPTIONS.find((f) => f.id === fadeId);
    return fade || { in: 0, out: 0 };
  };

  const previewTransition = useCallback(
    (transId) => {
      setPreviewingTransition(transId);

      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !activeClip || !container) return;

      const trans = TRANSITIONS.find((t) => t.id === transId);
      if (!trans || trans.type === "cut") {
        setTimeout(() => setPreviewingTransition(null), 1000);
        return;
      }

      video.pause();
      const startTime = activeClip.start;
      video.currentTime = startTime;

      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 8;
      `;
      container.appendChild(overlay);

      const duration = getTransitionDuration(transId) * 1000;
      const startTimestamp = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        switch (trans.type) {
          case "fade":
          case "crossfade":
          case "dissolve":
            const bgColor = trans.color || "#000";
            const fadeIn = progress < 0.5;
            const fadeProgress = fadeIn ? progress * 2 : (1 - progress) * 2;
            overlay.style.background = bgColor;
            overlay.style.opacity = fadeIn ? fadeProgress : 1 - fadeProgress;
            break;

          case "wipe":
            const gradientDir = {
              right: "90deg",
              left: "270deg",
              up: "0deg",
              down: "180deg",
            }[trans.direction || "right"];
            overlay.style.background = `linear-gradient(${gradientDir}, 
              #000 ${easeProgress * 100}%, 
              transparent ${easeProgress * 100}%)`;
            break;

          case "slide":
            const slideAmount = easeProgress * 100;
            const transforms = {
              right: `translateX(${slideAmount}%)`,
              left: `translateX(-${slideAmount}%)`,
              up: `translateY(-${slideAmount}%)`,
              down: `translateY(${slideAmount}%)`,
            };
            video.style.transform = `${transforms[trans.direction || "right"]} rotate(${rotation}deg)`;
            break;

          case "zoom":
            const zoomScale =
              trans.direction === "in"
                ? 1 + easeProgress * 0.3
                : 1 - easeProgress * 0.3;
            video.style.transform = `scale(${zoomScale}) rotate(${rotation}deg)`;
            video.style.opacity = 1 - easeProgress * 0.5;
            break;

          case "blur":
            const blurAmount = Math.sin(progress * Math.PI) * 20;
            video.style.filter = `${filterCss} blur(${blurAmount}px)`;
            break;

          case "swirl":
            const swirlRotate = easeProgress * 360;
            const swirlScale = 1 - Math.sin(progress * Math.PI) * 0.2;
            video.style.transform = `rotate(${rotation + swirlRotate}deg) scale(${swirlScale})`;
            video.style.opacity = 1 - Math.sin(progress * Math.PI) * 0.4;
            break;
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          overlay.remove();
          video.style.transform = `rotate(${rotation}deg)`;
          video.style.opacity = 1;
          video.style.filter = filterCss;
          setPreviewingTransition(null);
        }
      };

      requestAnimationFrame(animate);
    },
    [activeClip, rotation, filterCss, customTransitionDuration],
  );

  const previewFade = useCallback(
    (fadeId) => {
      setPreviewingFade(fadeId);

      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !activeClip || !container) return;

      const fade = getFadeDuration(fadeId);
      if (fade.in === 0 && fade.out === 0) {
        setTimeout(() => setPreviewingFade(null), 1000);
        return;
      }

      video.pause();
      video.currentTime = activeClip.start;

      const overlay = fade.color ? document.createElement("div") : null;
      if (overlay) {
        overlay.style.cssText = `
          position: absolute;
          inset: 0;
          background: ${fade.color};
          pointer-events: none;
          z-index: 8;
          opacity: 0;
        `;
        container.appendChild(overlay);
      }

      const fadeInDuration = fade.in * 1000;
      const fadeOutDuration = fade.out * 1000;
      const holdDuration = 800;
      const startTimestamp = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTimestamp;

        if (fade.in > 0 && elapsed < fadeInDuration) {
          const progress = elapsed / fadeInDuration;
          const easeProgress = 1 - Math.pow(1 - progress, 3);

          if (overlay) {
            overlay.style.opacity = easeProgress;
          } else {
            video.style.opacity = easeProgress;
          }
        } else if (elapsed < fadeInDuration + holdDuration) {
          if (overlay) {
            overlay.style.opacity = 1;
          } else {
            video.style.opacity = 1;
          }
        } else if (
          fade.out > 0 &&
          elapsed < fadeInDuration + holdDuration + fadeOutDuration
        ) {
          const fadeOutElapsed = elapsed - fadeInDuration - holdDuration;
          const progress = fadeOutElapsed / fadeOutDuration;
          const easeProgress = 1 - Math.pow(1 - progress, 3);

          if (overlay) {
            overlay.style.opacity = 1 - easeProgress;
          } else {
            video.style.opacity = 1 - easeProgress;
          }
        } else {
          if (overlay) overlay.remove();
          video.style.opacity = 1;
          setPreviewingFade(null);
          return;
        }

        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    },
    [activeClip, customFadeDuration],
  );

  const exportVideo = async () => {
    if (!clips.length) {
      alert("No clips to export");
      return;
    }
    setProcessing(true);
    setProgress(0);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { alpha: false });

      canvas.width = video.videoWidth || 1080;
      canvas.height = video.videoHeight || 1920;

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 10_000_000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const fps = 30;
      const frameDelay = 1000 / fps;

      const blob = await new Promise(async (resolve) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: "video/webm" }));
        recorder.start();

        for (const clip of clips) {
          const clipDuration = clip.end - clip.start;
          const frames = Math.ceil(clipDuration * fps);

          for (let f = 0; f < frames; f++) {
            const t = clip.start + f / fps;
            if (t >= clip.end) break;

            video.currentTime = t;
            await new Promise((r) => {
              video.onseeked = r;
            });

            await new Promise((r) => requestAnimationFrame(r));

            ctx.save();
            ctx.filter = filterCss;

            if (rotation !== 0) {
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            pipLayers.forEach((layer) => {
              if (t < layer.startTime || t > layer.endTime) return;
              const lx = (layer.x / 100) * canvas.width;
              const ly = (layer.y / 100) * canvas.height;
              const lw = (layer.width / 100) * canvas.width;
              const lh = (layer.height / 100) * canvas.height;
              ctx.globalAlpha = layer.opacity;
              if (layer.type === "image" && layer.imgEl)
                ctx.drawImage(layer.imgEl, lx, ly, lw, lh);
              if (layer.type === "video" && layer.vidEl)
                ctx.drawImage(layer.vidEl, lx, ly, lw, lh);
              ctx.globalAlpha = 1;
            });

            textOverlays.forEach((ov) => {
              if (t < ov.startTime || t > ov.endTime) return;
              ctx.font = `${ov.fontWeight} ${ov.fontSize}px ${ov.fontFamily}`;
              ctx.fillStyle = ov.color;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.shadowColor = "rgba(0,0,0,0.9)";
              ctx.shadowBlur = 12;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;
              ctx.fillText(
                ov.text,
                (ov.x / 100) * canvas.width,
                (ov.y / 100) * canvas.height,
              );
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            });

            ctx.restore();

            const clipProgress = (f / frames) * (1 / clips.length);
            const totalProgress =
              clips.indexOf(clip) / clips.length + clipProgress;
            setProgress(Math.floor(totalProgress * 90));

            await new Promise((r) => setTimeout(r, frameDelay));
          }
        }

        await addGrovaWatermark(ctx, canvas.width, canvas.height, fps);
        setProgress(100);

        recorder.stop();
      });

      const file = new File([blob], `grova_edit_${Date.now()}.webm`, {
        type: "video/webm",
      });

      setExportedVideoFile(file);
      if (onSave) onSave(file);
      setProgress(0);
      setProcessing(false);
      setShowShareModal(true);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + err.message);
      setProcessing(false);
      setProgress(0);
    }
  };

  const addGrovaWatermark = async (ctx, width, height, fps) => {
    const watermarkDuration = 2;
    const totalFrames = fps * watermarkDuration;
    const fadeInFrames = Math.floor(fps * 0.3);

    for (let frame = 0; frame < totalFrames; frame++) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      if (frame < fadeInFrames) {
        ctx.globalAlpha = frame / fadeInFrames;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.font = "bold 120px Arial";
      ctx.fillStyle = "#84cc16";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.fillText("GROVA", width / 2, height / 2);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    }
  };

  const getTotalDuration = () =>
    clips.reduce((s, c) => s + (c.end - c.start), 0);

  const SHEET_PARTIAL = () => Math.round(window.innerHeight * 0.42);
  const SHEET_FULL = () => Math.round(window.innerHeight * 0.85);
  const openSheet = (t) => {
    setActiveTab(t);
    setSheetHeight(SHEET_PARTIAL());
  };
  const closeSheet = () => {
    setActiveTab(null);
    setSheetHeight(0);
  };
  const handleTabClick = (t) => {
    if (activeTab === t) closeSheet();
    else if (activeTab) setActiveTab(t);
    else openSheet(t);
  };

  const checkScrollArrows = useCallback(() => {
    const container = toolTabsRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftArrow(scrollLeft > 5);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  useEffect(() => {
    checkScrollArrows();
    const container = toolTabsRef.current;
    if (container) {
      container.addEventListener("scroll", checkScrollArrows);
      window.addEventListener("resize", checkScrollArrows);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", checkScrollArrows);
      }
      window.removeEventListener("resize", checkScrollArrows);
    };
  }, [checkScrollArrows]);

  const scrollToolTabs = (direction) => {
    const container = toolTabsRef.current;
    if (!container) return;
    const scrollAmount = 200;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const onSheetDragStart = (y) => {
    dragStartY.current = y;
    dragStartH.current = sheetHeight;
    draggingSheet.current = true;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  };

  const onSheetDragMove = useCallback((y) => {
    if (!draggingSheet.current) return;
    const nh = Math.max(
      80,
      Math.min(SHEET_FULL(), dragStartH.current + dragStartY.current - y),
    );
    setSheetHeight(nh);
    if (sheetRef.current) sheetRef.current.style.height = nh + "px";
  }, []);

  const onSheetDragEnd = useCallback(() => {
    if (!draggingSheet.current) return;
    draggingSheet.current = false;
    if (sheetRef.current) sheetRef.current.style.transition = "";
    const p = SHEET_PARTIAL(),
      f = SHEET_FULL();
    setSheetHeight((h) => {
      if (h < p * 0.45) {
        setActiveTab(null);
        return 0;
      }
      return h < (p + f) / 2 ? p : f;
    });
  }, []);

  useEffect(() => {
    const mm = (e) => onSheetDragMove(e.clientY);
    const mu = () => onSheetDragEnd();
    const tm = (e) => {
      if (draggingSheet.current) {
        e.preventDefault();
        onSheetDragMove(e.touches[0].clientY);
      }
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    window.addEventListener("touchmove", tm, { passive: false });
    window.addEventListener("touchend", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", mu);
    };
  }, [onSheetDragMove, onSheetDragEnd]);

  return (
    <div className="video-editor-overlay">
      <div className="video-editor-modal">
        <div className="video-editor-header">
          <button
            className="ve-back-btn"
            onClick={onClose}
            disabled={processing}
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
          <h2 className="ve-title">Video Editor</h2>

          <div className="ve-header-actions">
            <button
              className="ve-share-btn"
              onClick={exportVideo}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader size={16} className="spinner" />
                  {progress}%
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  Share
                </>
              )}
            </button>

            {onPost && (
              <button
                className="ve-post-btn"
                onClick={() => {
                  if (exportedVideoFile) {
                    onPost(exportedVideoFile);
                  } else {
                    exportVideo();
                  }
                }}
                disabled={processing}
              >
                <Check size={16} />
                Post
              </button>
            )}
          </div>
        </div>

        <div className="ve-video-section">
          <div className="ve-video-container" ref={containerRef}>
            <video
              ref={videoRef}
              src={url}
              className="ve-video"
              style={{ filter: filterCss, transform: `rotate(${rotation}deg)` }}
              muted={muted}
              playsInline
            />

            <video
              ref={previewVideoRef}
              src={url}
              style={{ display: "none" }}
              muted
              playsInline
            />

            {!draggingTextId && !draggingPipId && (
              <div className="ve-play-overlay" onClick={togglePlay}>
                {playing ? <Pause size={48} /> : <Play size={48} />}
              </div>
            )}

            {pipLayers.map(
              (layer) =>
                currentTime >= layer.startTime &&
                currentTime <= layer.endTime && (
                  <div
                    key={layer.id}
                    className={`ve-pip-overlay${draggingPipId === layer.id ? " dragging" : ""}`}
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.width}%`,
                      height: `${layer.height}%`,
                      opacity: layer.opacity,
                    }}
                    onMouseDown={(e) => startPipDrag(e, layer)}
                    onTouchStart={(e) => startPipDrag(e, layer)}
                  >
                    {layer.type === "image" ? (
                      <img
                        src={layer.url}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 4,
                          display: "block",
                        }}
                        draggable={false}
                      />
                    ) : (
                      <video
                        src={layer.url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 4,
                          display: "block",
                        }}
                      />
                    )}
                    <div className="ve-pip-drag-handle">
                      <Move size={11} />
                    </div>
                  </div>
                ),
            )}

            {textOverlays.map(
              (overlay) =>
                currentTime >= overlay.startTime &&
                currentTime <= overlay.endTime && (
                  <div
                    key={overlay.id}
                    className={`ve-text-overlay-preview${draggingTextId === overlay.id ? " dragging" : ""}`}
                    style={{
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      fontSize: `clamp(9px, ${overlay.fontSize * 0.17}px, 28px)`,
                      color: overlay.color,
                      fontFamily: overlay.fontFamily,
                      fontWeight: overlay.fontWeight,
                    }}
                    onMouseDown={(e) => startTextDrag(e, overlay)}
                    onTouchStart={(e) => startTextDrag(e, overlay)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openEditText(overlay);
                      openSheet("text");
                    }}
                  >
                    {overlay.text}
                    <span className="ve-text-drag-dot">⠿</span>
                  </div>
                ),
            )}
          </div>

          <div className="ve-time-display">
            <span className="ve-time-current">{fmt(currentTime)}</span>
            <span className="ve-time-sep">/</span>
            <span className="ve-time-total">{fmt(duration)}</span>
          </div>

          <TimelineViewer
            clips={clips}
            activeClipIndex={activeClipIndex}
            currentTime={currentTime}
            duration={duration}
            videoUrl={url}
            onClipClick={jumpToClip}
            onClipDrag={handleClipDragStart}
            onClipDrop={handleClipDrop}
            onClipDelete={deleteClip}
            onTrimStart={(mode) => setTrimMode(mode)}
            canvasRef={timelineCanvasRef}
          />

          <div className="ve-audio-controls-row">
            <div className="ve-audio-mute-wrapper">
              <button
                className="ve-audio-mute-btn"
                onClick={toggleMute}
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              {showVolumeSlider && (
                <div
                  className="ve-volume-popup"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <input
                    type="range"
                    className="ve-volume-slider-vertical"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => changeVolume(parseFloat(e.target.value))}
                    orient="vertical"
                  />
                </div>
              )}
            </div>

            <button
              className="ve-add-sound-btn"
              onClick={() => setShowSoundLibrary(true)}
            >
              <Music size={16} />
              Add Sound
            </button>
          </div>

          {audioTracks.map((track) => (
            <div key={track.id} className="ve-audio-track">
              <Music size={14} />
              <span>{track.name}</span>
              <button onClick={() => deleteAudioTrack(track.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <div className="ve-add-media-section">
            <input
              ref={pipInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handlePipUpload}
              style={{ display: "none" }}
            />
            <button
              className="ve-add-media-btn"
              onClick={() => pipInputRef.current?.click()}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="ve-tools-panel">
          <div className="ve-tool-tabs-wrapper">
            <button
              className={`ve-tool-scroll-btn left${showLeftArrow ? " visible" : ""}`}
              onClick={() => scrollToolTabs("left")}
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="ve-tool-tabs" ref={toolTabsRef}>
              {[
                { id: "split", icon: <Split size={14} />, label: "Split" },
                { id: "text", icon: <Type size={14} />, label: "Text" },
                { id: "pip", icon: <Layers size={14} />, label: "PIP" },
                { id: "filters", icon: <Wand2 size={14} />, label: "Filters" },
                {
                  id: "transitions",
                  icon: <Zap size={14} />,
                  label: "Transitions",
                },
                { id: "fades", icon: <Sun size={14} />, label: "Fades" },
                { id: "adjust", icon: <Settings size={14} />, label: "Adjust" },
                { id: "speed", icon: <RotateCw size={14} />, label: "Speed" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`ve-tool-tab${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <button
              className={`ve-tool-scroll-btn right${showRightArrow ? " visible" : ""}`}
              onClick={() => scrollToolTabs("right")}
              aria-label="Scroll right"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {activeTab && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 199,
            background: "transparent",
          }}
          onClick={closeSheet}
        />
      )}

      {activeTab && (
        <div
          ref={sheetRef}
          className="ve-sheet"
          style={{ height: sheetHeight + "px" }}
        >
          <div
            className="ve-sheet-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              onSheetDragStart(e.clientY);
            }}
            onTouchStart={(e) => onSheetDragStart(e.touches[0].clientY)}
          >
            <div className="ve-sheet-knob" />
          </div>
          <div className="ve-sheet-label">
            <span>
              {
                {
                  split: "⚡ Split",
                  text: "T  Text",
                  pip: "⧉ Overlay",
                  filters: "✦ Filters",
                  transitions: "⚡ Transitions",
                  fades: "☀ Fades",
                  adjust: "◈ Adjust",
                  speed: "⏩ Speed",
                }[activeTab]
              }
            </span>
            <button className="ve-sheet-close-btn" onClick={closeSheet}>
              ✕
            </button>
          </div>

          <div className="ve-tool-content">
            {activeTab === "split" && (
              <div className="ve-section">
                <p className="ve-section-desc">
                  Pause at the exact cut point inside Clip #
                  {activeClipIndex + 1}, then tap Split.
                </p>
                <button className="ve-btn-primary" onClick={splitClip}>
                  <Split size={18} />
                  Split at {fmt(currentTime)}
                </button>
                {activeClip && (
                  <div className="ve-clip-preview">
                    <span>
                      {fmt(activeClip.start)} → {fmt(activeClip.end)}
                    </span>
                    <span>Playhead: {fmt(currentTime)}</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "text" && (
              <div className="ve-section">
                {showTextEditor ? (
                  <div className="ve-text-editor">
                    <input
                      type="text"
                      className="ve-text-input"
                      placeholder="Enter text..."
                      value={draftText.text || ""}
                      onChange={(e) =>
                        setDraftText((d) => ({ ...d, text: e.target.value }))
                      }
                    />
                    <div className="ve-text-controls">
                      <label>Size</label>
                      <input
                        type="range"
                        min="14"
                        max="80"
                        value={draftText.fontSize || 32}
                        onChange={(e) =>
                          setDraftText((d) => ({
                            ...d,
                            fontSize: +e.target.value,
                          }))
                        }
                      />
                      <span>{draftText.fontSize}px</span>
                    </div>
                    <div className="ve-text-controls">
                      <label>Color</label>
                      <input
                        type="color"
                        value={draftText.color || "#ffffff"}
                        onChange={(e) =>
                          setDraftText((d) => ({ ...d, color: e.target.value }))
                        }
                      />
                    </div>
                    <div className="ve-text-controls">
                      <label>Font</label>
                      <select
                        className="ve-text-select"
                        value={draftText.fontFamily || "Arial"}
                        onChange={(e) =>
                          setDraftText((d) => ({
                            ...d,
                            fontFamily: e.target.value,
                          }))
                        }
                      >
                        {FONTS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="ve-button-group">
                      <button className="ve-btn" onClick={saveText}>
                        {editingTextId ? "Update" : "Add"} Text
                      </button>
                      <button
                        className="ve-btn"
                        onClick={() => {
                          setShowTextEditor(false);
                          setEditingTextId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button className="ve-btn-primary" onClick={openAddText}>
                      <Plus size={18} />
                      Add Text
                    </button>
                    <div className="ve-text-list">
                      {textOverlays.map((ov) => (
                        <div key={ov.id} className="ve-text-item">
                          <span style={{ flex: 1 }}>{ov.text}</span>
                          <div className="ve-text-actions">
                            <button onClick={() => openEditText(ov)}>
                              <Type size={14} />
                            </button>
                            <button onClick={() => deleteTextOverlay(ov.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "pip" && (
              <div className="ve-section">
                <div className="ve-pip-list">
                  {pipLayers.map((layer, i) => (
                    <div key={layer.id} className="ve-pip-item">
                      {layer.type === "image" ? (
                        <img
                          src={layer.url}
                          alt=""
                          style={{ width: 36, height: 36, borderRadius: 4 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            background: "#222",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Film size={16} color="#84cc16" />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#fff" }}>
                          Layer {i + 1} · {layer.type}
                        </div>
                      </div>
                      <button onClick={() => deletePipLayer(layer.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "filters" && (
              <div className="ve-section">
                <div className="ve-filters-grid">
                  {FILTERS.map((filter) => (
                    <FilterPreviewCard
                      key={filter.id}
                      filter={filter}
                      videoUrl={url}
                      isActive={activeFilter === filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "transitions" && (
              <div className="ve-section">
                <div className="ve-transitions-grid">
                  {TRANSITIONS.map((trans) => (
                    <TransitionPreviewCard
                      key={trans.id}
                      transition={trans}
                      videoUrl={url}
                      isActive={activeTransition === trans.id}
                      onClick={() => {
                        setActiveTransition(trans.id);
                        previewTransition(trans.id);
                      }}
                      onDurationClick={() =>
                        setShowTransitionDuration(trans.id)
                      }
                      customDuration={customTransitionDuration[trans.id]}
                    />
                  ))}
                </div>

                {showTransitionDuration && (
                  <DurationPicker
                    title="Transition Duration"
                    currentDuration={getTransitionDuration(
                      showTransitionDuration,
                    )}
                    onSelect={(dur) => {
                      setCustomTransitionDuration((prev) => ({
                        ...prev,
                        [showTransitionDuration]: dur,
                      }));
                      setShowTransitionDuration(null);
                    }}
                    onClose={() => setShowTransitionDuration(null)}
                  />
                )}
              </div>
            )}

            {activeTab === "fades" && (
              <div className="ve-section">
                <div className="ve-fades-grid">
                  {FADE_OPTIONS.map((fade) => (
                    <FadePreviewCard
                      key={fade.id}
                      fade={fade}
                      videoUrl={url}
                      isActive={activeFade === fade.id}
                      onClick={() => {
                        setActiveFade(fade.id);
                        previewFade(fade.id);
                      }}
                      onDurationClick={() => setShowFadeDuration(fade.id)}
                      customDuration={customFadeDuration[fade.id]}
                    />
                  ))}
                </div>

                {showFadeDuration && (
                  <FadeDurationPicker
                    currentFade={getFadeDuration(showFadeDuration)}
                    onSelect={(fadeIn, fadeOut) => {
                      setCustomFadeDuration((prev) => ({
                        ...prev,
                        [showFadeDuration]: { in: fadeIn, out: fadeOut },
                      }));
                      setShowFadeDuration(null);
                    }}
                    onClose={() => setShowFadeDuration(null)}
                  />
                )}
              </div>
            )}

            {activeTab === "adjust" && (
              <div className="ve-adjust-tab">
                {EFFECTS.map((effect) => {
                  const val = getEffect(effect.id);
                  return (
                    <div key={effect.id} className="ve-effect-item">
                      <div className="ve-effect-header">
                        <span className="ve-effect-icon">{effect.icon}</span>
                        <span className="ve-effect-name">{effect.name}</span>
                        {val !== effect.default && (
                          <button
                            className="ve-effect-reset"
                            onClick={() => setEffect(effect.id, effect.default)}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="ve-effect-slider-row">
                        <input
                          type="range"
                          className="ve-effect-slider"
                          min={effect.min}
                          max={effect.max}
                          step={effect.step}
                          value={val}
                          onChange={(e) =>
                            setEffect(effect.id, parseFloat(e.target.value))
                          }
                        />
                        <span className="ve-effect-value">
                          {effect.id === "hue"
                            ? Math.round(val)
                            : val.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "speed" && (
              <div className="ve-speed-grid">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    className={`ve-speed-btn${speed === s.value ? " active" : ""}`}
                    onClick={() => changeSpeed(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {processing && (
        <div className="ve-processing">
          <div className="ve-processing-ring" />
          <h3>Processing Video...</h3>
          <div className="ve-progress-bar">
            <div
              className="ve-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p>{progress}% Complete</p>
        </div>
      )}

      {showSoundLibrary && (
        <SoundLibrary
          onSelect={handleSoundSelect}
          onClose={() => setShowSoundLibrary(false)}
        />
      )}

      {showShareModal && exportedVideoFile && (
        <ShareModal
          videoFile={exportedVideoFile}
          onClose={() => setShowShareModal(false)}
          onDownload={() => {
            const url = URL.createObjectURL(exportedVideoFile);
            const a = document.createElement("a");
            a.href = url;
            a.download = exportedVideoFile.name;
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      )}
    </div>
  );
};

const TimelineViewer = ({
  clips,
  activeClipIndex,
  currentTime,
  videoUrl,
  onClipClick,
  onClipDelete,
  onTrimStart,
  canvasRef,
}) => {
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => {
    if (!videoUrl || !clips.length) return;
    const video = document.createElement("video");
    video.src = videoUrl;
    video.muted = true;

    video.onloadeddata = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      const newThumbnails = {};

      for (const clip of clips) {
        const midPoint = (clip.start + clip.end) / 2;
        video.currentTime = midPoint;
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        newThumbnails[clip.id] = canvas.toDataURL();
      }
      setThumbnails(newThumbnails);
    };
  }, [videoUrl, clips]);

  const totalDuration = clips.reduce((sum, c) => sum + (c.end - c.start), 0);

  return (
    <div className="ve-timeline-container" ref={canvasRef}>
      <div className="ve-timeline-header">
        <span>
          {clips.length} clip{clips.length !== 1 ? "s" : ""} · drag to reorder
        </span>
        <span className="ve-timeline-duration">Total {fmt(totalDuration)}</span>
      </div>

      <div className="ve-timeline-track">
        {clips.map((clip, idx) => {
          const clipDuration = clip.end - clip.start;
          const widthPercent =
            (clipDuration / Math.max(totalDuration, 0.001)) * 100;

          return (
            <div
              key={clip.id}
              className={`ve-timeline-clip${idx === activeClipIndex ? " active" : ""}`}
              style={{ width: `${Math.max(widthPercent, 8)}%` }}
              onClick={() => onClipClick(idx)}
            >
              {thumbnails[clip.id] && (
                <img
                  src={thumbnails[clip.id]}
                  alt=""
                  className="ve-timeline-thumbnail"
                />
              )}

              <div
                className="ve-timeline-trim-handle left"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onTrimStart("start");
                }}
              >
                <div className="ve-trim-line" />
              </div>

              <div
                className="ve-timeline-trim-handle right"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onTrimStart("end");
                }}
              >
                <div className="ve-trim-line" />
              </div>

              <div className="ve-timeline-clip-info">
                <span className="ve-timeline-clip-number">#{idx + 1}</span>
                <span className="ve-timeline-clip-duration">
                  {fmt(clipDuration)}
                </span>
                {clips.length > 1 && (
                  <button
                    className="ve-timeline-clip-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClipDelete(idx);
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DurationPicker = ({ title, currentDuration, onSelect, onClose }) => {
  const [customValue, setCustomValue] = useState("");

  return (
    <div className="ve-duration-picker">
      <div className="ve-duration-header">
        <h4>{title}</h4>
        <button onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ve-duration-presets">
        {DURATION_PRESETS.map((dur) => (
          <button
            key={dur}
            className={`ve-duration-preset${currentDuration === dur ? " active" : ""}`}
            onClick={() => onSelect(dur)}
          >
            {dur}s
          </button>
        ))}
      </div>

      <div className="ve-duration-custom">
        <label>Custom (seconds)</label>
        <div className="ve-duration-input-row">
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="0.5"
          />
          <button
            className="ve-duration-apply"
            onClick={() => {
              const val = parseFloat(customValue);
              if (!isNaN(val) && val > 0 && val <= 5) {
                onSelect(val);
              }
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const FadeDurationPicker = ({ currentFade, onSelect, onClose }) => {
  const [fadeIn, setFadeIn] = useState(currentFade.in || 0);
  const [fadeOut, setFadeOut] = useState(currentFade.out || 0);

  return (
    <div className="ve-duration-picker ve-fade-duration-picker">
      <div className="ve-duration-header">
        <h4>Fade Duration</h4>
        <button onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ve-fade-controls">
        <div className="ve-fade-control-group">
          <label>Fade In</label>
          <div className="ve-fade-presets">
            {[0, 0.3, 0.5, 1.0, 1.5, 2.0].map((dur) => (
              <button
                key={`in-${dur}`}
                className={`ve-duration-preset${fadeIn === dur ? " active" : ""}`}
                onClick={() => setFadeIn(dur)}
              >
                {dur}s
              </button>
            ))}
          </div>
        </div>

        <div className="ve-fade-control-group">
          <label>Fade Out</label>
          <div className="ve-fade-presets">
            {[0, 0.3, 0.5, 1.0, 1.5, 2.0].map((dur) => (
              <button
                key={`out-${dur}`}
                className={`ve-duration-preset${fadeOut === dur ? " active" : ""}`}
                onClick={() => setFadeOut(dur)}
              >
                {dur}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="ve-btn-primary"
        onClick={() => onSelect(fadeIn, fadeOut)}
      >
        Apply Fade
      </button>
    </div>
  );
};

const FilterPreviewCard = ({ filter, videoUrl, isActive, onClick }) => {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    const video = videoRef.current;
    const handleLoad = () => {
      setIsLoaded(true);
      video.currentTime = 2;
    };
    video.addEventListener("loadeddata", handleLoad);
    return () => video.removeEventListener("loadeddata", handleLoad);
  }, [videoUrl]);

  return (
    <button
      className={`ve-filter-card${isActive ? " active" : ""}`}
      onClick={onClick}
    >
      <div className="ve-filter-preview">
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          loop
          className="ve-filter-preview-video"
          style={{ filter: filter.css, opacity: isLoaded ? 1 : 0 }}
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 2;
          }}
        />
        {!isLoaded && (
          <div className="ve-filter-loading">
            <div className="ve-filter-loading-spinner" />
          </div>
        )}
      </div>
      <span className="ve-filter-name">{filter.name}</span>
      {isActive && <span className="ve-filter-check">✓</span>}
    </button>
  );
};

const TransitionPreviewCard = ({
  transition,
  videoUrl,
  isActive,
  onClick,
  onDurationClick,
  customDuration,
}) => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const duration = customDuration || transition.duration || 0.5;

  const startPreview = useCallback(() => {
    if (!videoRef.current || !overlayRef.current || transition.type === "cut")
      return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    video.currentTime = 2;
    video.play().catch(() => {});
    const durationMs = duration * 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      switch (transition.type) {
        case "fade":
        case "crossfade":
        case "dissolve":
          const fadeIn = progress < 0.5;
          const fadeProgress = fadeIn ? progress * 2 : (1 - progress) * 2;
          overlay.style.background = transition.color || "#000";
          overlay.style.opacity = fadeIn ? fadeProgress : 1 - fadeProgress;
          break;
        case "wipe":
          const dir = {
            right: "90deg",
            left: "270deg",
            up: "0deg",
            down: "180deg",
          }[transition.direction || "right"];
          overlay.style.background = `linear-gradient(${dir}, #000 ${easeProgress * 100}%, transparent ${easeProgress * 100}%)`;
          break;
        case "slide":
          const slide = easeProgress * 100;
          video.style.transform =
            transition.direction === "right"
              ? `translateX(${slide}%)`
              : `translateX(-${slide}%)`;
          break;
        case "zoom":
          const scale =
            transition.direction === "in"
              ? 1 + easeProgress * 0.3
              : 1 - easeProgress * 0.3;
          video.style.transform = `scale(${scale})`;
          video.style.opacity = 1 - easeProgress * 0.4;
          break;
        case "blur":
          video.style.filter = `blur(${Math.sin(progress * Math.PI) * 15}px)`;
          break;
        case "swirl":
          const rotate = easeProgress * 360;
          video.style.transform = `rotate(${rotate}deg) scale(${1 - Math.sin(progress * Math.PI) * 0.15})`;
          break;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        video.style.transform = "";
        video.style.opacity = 1;
        video.style.filter = "";
        overlay.style.opacity = 0;
        animationRef.current = requestAnimationFrame(() => startPreview());
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  }, [transition, duration]);

  const stopPreview = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.style.transform = "";
      videoRef.current.style.opacity = 1;
      videoRef.current.style.filter = "";
    }
    if (overlayRef.current) {
      overlayRef.current.style.opacity = 0;
    }
  }, []);

  useEffect(() => {
    if (isHovering) startPreview();
    else stopPreview();
  }, [isHovering, startPreview, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  return (
    <button
      className={`ve-transition-btn${isActive ? " active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="ve-transition-preview">
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          loop
          className="ve-transition-preview-video"
        />
        <div ref={overlayRef} className="ve-transition-preview-overlay" />
      </div>
      <div className="ve-transition-icon">{transition.icon}</div>
      <span className="ve-transition-name">{transition.name}</span>
      {duration > 0 && (
        <button
          className="ve-transition-dur clickable"
          onClick={(e) => {
            e.stopPropagation();
            onDurationClick();
          }}
        >
          <Clock size={10} />
          {duration}s
        </button>
      )}
    </button>
  );
};

const FadePreviewCard = ({
  fade,
  videoUrl,
  isActive,
  onClick,
  onDurationClick,
  customDuration,
}) => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const fadeIn = customDuration?.in ?? fade.in ?? 0;
  const fadeOut = customDuration?.out ?? fade.out ?? 0;

  const startPreview = useCallback(() => {
    if (
      !videoRef.current ||
      !overlayRef.current ||
      (fadeIn === 0 && fadeOut === 0)
    )
      return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    video.currentTime = 2;
    video.play().catch(() => {});
    const fadeInDur = fadeIn * 1000;
    const fadeOutDur = fadeOut * 1000;
    const holdDur = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (fadeIn > 0 && elapsed < fadeInDur) {
        const ease = 1 - Math.pow(1 - elapsed / fadeInDur, 3);
        if (fade.color) {
          overlay.style.background = fade.color;
          overlay.style.opacity = ease;
        } else {
          video.style.opacity = ease;
        }
      } else if (elapsed < fadeInDur + holdDur) {
        if (fade.color) overlay.style.opacity = 1;
        else video.style.opacity = 1;
      } else if (fadeOut > 0 && elapsed < fadeInDur + holdDur + fadeOutDur) {
        const ease =
          1 - Math.pow(1 - (elapsed - fadeInDur - holdDur) / fadeOutDur, 3);
        if (fade.color) overlay.style.opacity = 1 - ease;
        else video.style.opacity = 1 - ease;
      } else {
        video.style.opacity = 1;
        overlay.style.opacity = 0;
        animationRef.current = requestAnimationFrame(() => startPreview());
        return;
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
  }, [fade, fadeIn, fadeOut]);

  const stopPreview = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (videoRef.current) videoRef.current.pause();
    if (videoRef.current) videoRef.current.style.opacity = 1;
    if (overlayRef.current) overlayRef.current.style.opacity = 0;
  }, []);

  useEffect(() => {
    if (isHovering) startPreview();
    else stopPreview();
  }, [isHovering, startPreview, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  return (
    <button
      className={`ve-fade-btn${isActive ? " active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="ve-fade-preview-container">
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          loop
          className="ve-fade-preview-video"
        />
        <div ref={overlayRef} className="ve-fade-preview-overlay" />
      </div>
      <div className="ve-fade-icon">{fade.icon}</div>
      <div className="ve-fade-visual">
        <div
          className="ve-fade-in-bar"
          style={{ width: `${Math.min((fadeIn / 2) * 100, 45)}%` }}
        />
        <div
          className="ve-fade-out-bar"
          style={{ width: `${Math.min((fadeOut / 2) * 100, 45)}%` }}
        />
      </div>
      <span className="ve-fade-name">{fade.name}</span>
      {(fadeIn > 0 || fadeOut > 0) && (
        <button
          className="ve-fade-dur clickable"
          onClick={(e) => {
            e.stopPropagation();
            onDurationClick();
          }}
        >
          <Clock size={10} />
          {fadeIn > 0 && `In: ${fadeIn}s`}
          {fadeIn > 0 && fadeOut > 0 && " · "}
          {fadeOut > 0 && `Out: ${fadeOut}s`}
        </button>
      )}
    </button>
  );
};

export default VideoEditor;
