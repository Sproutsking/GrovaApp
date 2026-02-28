// src/components/SmartTextarea/SmartTextarea.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SmartTextarea v5 — Fixed Layout + Maximum Intelligence
//
// KEY FIXES in v5:
//   • Tool strip is now a HORIZONTAL ROW (top-right of textarea, not column)
//   • ALL panels anchor to the textarea container — never overflow left/right
//   • Emoji panel opens centered within the textarea — no more left-overflow
//   • Active tool pushed to far-right edge of strip visually (selected state)
//   • Sub-panels open downward from the strip (never sideways)
//   • Single activeTool state replaces 4 separate show/hide states
//   • 15 topic clusters, 150+ phrase completions, 60+ templates
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { supabase }            from "../../services/config/supabase";
import { useAdaptiveEngine }   from "./useAdaptiveEngine";
import { useUndoStack }        from "./useUndoStack";
import { usePostIntelligence } from "./usePostIntelligence";
import { useSmartSuggestions } from "./useSmartSuggestions";
import { diffWords }           from "./diffWords";
import "./SmartTextarea.css";

// ─── Actions ─────────────────────────────────────────────────────────────────
const ACTIONS = [
  { id:"grammar",  label:"Fix",      icon:"✦", desc:"Fix grammar, spelling & punctuation",         color:"#84cc16", group:"polish"  },
  { id:"shorten",  label:"Shorten",  icon:"◈", desc:"Cut every word that doesn't earn its place",   color:"#38bdf8", group:"polish"  },
  { id:"enhance",  label:"Enhance",  icon:"◆", desc:"Elevate language, sharpen ideas, amplify impact",color:"#f59e0b",group:"upgrade" },
  { id:"rewrite",  label:"Rewrite",  icon:"↺", desc:"Same message, completely reimagined delivery", color:"#a855f7", group:"upgrade" },
  { id:"friendly", label:"Friendly", icon:"☀", desc:"Warm, human, genuine — like a trusted friend", color:"#f97316", group:"style"   },
  { id:"formal",   label:"Formal",   icon:"◻", desc:"Polished, authoritative, thought-leader level",color:"#94a3b8", group:"style"   },
  { id:"hook",     label:"Hook",     icon:"⚡", desc:"Irresistible scroll-stopping opening line",    color:"#fbbf24", group:"power"   },
  { id:"engage",   label:"Engage",   icon:"💬", desc:"Engineered for maximum comments & shares",    color:"#34d399", group:"power"   },
  { id:"punch",    label:"Punch",    icon:"✊", desc:"Hard, direct, no hedging — every word lands",  color:"#f43f5e", group:"power"   },
  { id:"story",    label:"Story",    icon:"📖", desc:"Narrative arc: conflict → turning point → lesson",color:"#818cf8",group:"power"},
];

const COACH_TIPS = [
  "Start with your strongest point, not a warm-up.",
  "If your opener doesn't hook in 5 words, redo it.",
  "Questions create engagement. Does yours end with one?",
  "'Just', 'really', 'basically' — cut them all.",
  "The best posts feel like a letter to one person.",
  "Show don't tell: replace 'good' with something specific.",
  "Stories are remembered. Facts are forgotten.",
  "Short sentences hit harder. Vary your rhythm.",
  "Specificity beats vagueness every time.",
  "Your reader's first question: 'What's in it for me?'",
  "The hook is 80% of the post. Spend 80% of your time there.",
  "Never bury the lede — lead with the most interesting thing.",
  "White space is not wasted space — it's breathing room.",
  "Every paragraph should earn the next one.",
  "Read it out loud. If it sounds awkward, it is awkward.",
];

const BULLET_STYLES = [
  {id:"dot",     symbol:"•", label:"Dot"    },{id:"arrow",   symbol:"→",label:"Arrow"  },
  {id:"star",    symbol:"★", label:"Star"   },{id:"check",   symbol:"✓",label:"Check"  },
  {id:"diamond", symbol:"◆", label:"Diamond"},{id:"circle",  symbol:"○",label:"Circle" },
  {id:"square",  symbol:"▪", label:"Square" },{id:"triangle",symbol:"▸",label:"Triangle"},
  {id:"fire",    symbol:"🔥",label:"Fire"   },{id:"bolt",    symbol:"⚡",label:"Bolt"   },
  {id:"gem",     symbol:"💎",label:"Gem"    },{id:"key",     symbol:"🔑",label:"Key"    },
];
const NUMBER_STYLES = [
  {id:"numeric",    format:(i)=>`${i}.`,         label:"1. 2. 3."    },
  {id:"parenthesis",format:(i)=>`${i})`,         label:"1) 2) 3)"    },
  {id:"roman",      format:(i)=>`${toRoman(i)}.`,label:"I. II. III." },
  {id:"letter",     format:(i)=>`${toLetter(i)}.`,label:"a. b. c."  },
];
const ARROW_STYLES = [
  {id:"right",       symbol:"→",label:"Right"   },{id:"left",      symbol:"←",label:"Left"    },
  {id:"curved",      symbol:"↳",label:"Curved"  },{id:"double",    symbol:"⇒",label:"Double"  },
  {id:"thick",       symbol:"➔",label:"Thick"   },{id:"open",      symbol:"⟹",label:"Open"   },
];
const SPECIAL_CHARS = [
  {char:"✨",label:"Sparkle"},{char:"🔥",label:"Fire"     },{char:"💎",label:"Gem"   },
  {char:"⚡",label:"Bolt"   },{char:"🎯",label:"Target"   },{char:"🚀",label:"Rocket"},
  {char:"💡",label:"Idea"   },{char:"🌟",label:"Star"     },{char:"—", label:"Em dash"},
  {char:"…", label:"Ellipsis"},{char:"©",label:"Copyright"},{char:"™",label:"Trademark"},
  {char:"•", label:"Bullet" },{char:"→",label:"Arrow"    },{char:"★",label:"Star"   },
  {char:"✓", label:"Check"  },{char:"◆",label:"Diamond"  },{char:"▸",label:"Triangle"},
];
const SYMBOL_COLORS = [
  {name:"Lime",  value:"#84cc16"},{name:"Sky",   value:"#38bdf8"},
  {name:"Amber", value:"#fbbf24"},{name:"Purple",value:"#a855f7"},
  {name:"Pink",  value:"#ec4899"},{name:"Red",   value:"#ef4444"},
  {name:"White", value:"#ffffff"},{name:"Orange",value:"#fb923c"},
];

// Expanded emoji categories
const EMOJI_CATEGORIES = [
  { id:"trending", icon:"🔥", label:"Trending",
    emojis:["🔥","✨","💎","⚡","🎯","🚀","💡","🌟","❤️","👉","🙌","💪","🤝","👀","😍","🥳","🎉","💯","🏆","⭐","🌈","💫","🦋","🌸","🎊","🍀","💥","🫶","😎","🤩","🥰","🤯","🙏","✅","💬","📢","🎤","🧠","🌊","🎨","🛡️","🔑","💰","🎵","🏅","🌍","🦁","🪄","🌺","🫡","💸","🧲","🎪","🌙","⭐","🎭","🔮","💫","🌠","🎆"] },
  { id:"smileys",  icon:"😀", label:"Smileys",
    emojis:["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😚","😋","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒","🙄","😬","😌","😔","😪","🤢","🤮","🥵","🥶","🤯","🤠","😈","👿","💀","💩","👻","👽","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"] },
  { id:"hands",    icon:"👋", label:"Hands",
    emojis:["👋","🤚","🖐️","✋","🖖","🤙","👌","✌️","🤞","🤟","🤘","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","🤲","🙏","💪","💅","🤝","👐","🫴","🫳","🤌","👐","🤜","🤛","👊","✊","☝️","👆","👇"] },
  { id:"hearts",   icon:"❤️", label:"Hearts",
    emojis:["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❤️‍🔥","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💌","💋","🌹","🌷","💐","🎀","🫀","💑","💏","👫","👬","👭"] },
  { id:"nature",   icon:"🌿", label:"Nature",
    emojis:["🌿","🌱","🌲","🌳","🌴","🌵","🎋","🎍","🍀","🌾","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","⭐","🌟","💫","✨","⚡","🔥","🌊","🌈","☁️","⛅","🌤️","🌦️","🌧️","⛈️","❄️","🌨️","☃️","⛄","🌬️","🌀","🌪️","🌫️"] },
  { id:"objects",  icon:"💡", label:"Objects",
    emojis:["💡","🔑","🗝️","🔒","🔓","🔨","⚒️","🛠️","⚙️","🔧","🔩","🧲","💻","🖥️","📱","⌨️","🖱️","🖨️","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌚","📡","🔋","💿","💾","📀"] },
  { id:"symbols",  icon:"⚡", label:"Symbols",
    emojis:["✅","❌","⚠️","💯","🔴","🟡","🟢","🔵","⭕","🚫","✔️","➕","➖","✖️","♾️","💲","©️","®️","™️","‼️","❓","❗","🔝","🆙","🆒","🆕","🆓","🆘","🔗","⛓️","🧩","🎯","📌","📍","🏷️","🔖","🚩","🏳️","🏴","🔰","♻️","✴️","❇️","💠","🔷","🔹","🔶","🔸"] },
  { id:"activities",icon:"🎮",label:"Activities",
    emojis:["🎮","🕹️","🎲","♟️","🎯","🎳","🎰","🧩","🎪","🎭","🎨","🖼️","🎬","🎤","🎧","🎵","🎶","🎼","🎹","🥁","🥁","🎷","🎺","🎸","🪕","🎻","🏋️","⛹️","🤸","🤼","🤾","⛷️","🏂","🏄","🚣","🧘","🚴","🏇","⛺","🗺️","🧗","🪂","🏋️"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toRoman(n){const m=[["X",10],["IX",9],["V",5],["IV",4],["I",1]];let r="";for(const[s,v]of m)while(n>=v){r+=s;n-=v;}return r;}
function toLetter(n){return String.fromCharCode(96+n);}
function engColor(s){return s>=75?"#84cc16":s>=50?"#fbbf24":s>=25?"#f97316":"#ef4444";}
function readColor(s){if(!s||s===100)return"rgba(255,255,255,0.2)";return s>=70?"#84cc16":s>=50?"#fbbf24":"#ef4444";}

async function generateAlternates(actionId,text,batchIndex=0,userStyle="neutral"){
  const{data:sd}=await supabase.auth.getSession();
  const token=sd?.session?.access_token;
  const{data,error}=await supabase.functions.invoke("enhance-post",{
    body:JSON.stringify({text,action:actionId,userStyle,batchIndex}),
    headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},
  });
  if(error)throw new Error(error.message||"Edge function error");
  if(!data?.alternates?.length)throw new Error("No alternates returned");
  return{alternates:data.alternates.filter(v=>v&&v.trim()!==text.trim()),improvement:data.improvement||null};
}

// ══════════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS for the horizontal row
// ══════════════════════════════════════════════════════════════════════════════
const TOOL_DEFS = [
  { id:"formatting", title:"Formatting",    icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="2.5" cy="4" r="1.5" fill="currentColor"/><rect x="5.5" y="3" width="9" height="2" rx="1" fill="currentColor"/><circle cx="2.5" cy="8" r="1.5" fill="currentColor"/><rect x="5.5" y="7" width="9" height="2" rx="1" fill="currentColor"/><circle cx="2.5" cy="12" r="1.5" fill="currentColor"/><rect x="5.5" y="11" width="7" height="2" rx="1" fill="currentColor"/></svg> },
  { id:"emoji",      title:"Emoji",         icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M8 14.5C8.67 16.17 10.17 17 12 17C13.83 17 15.33 16.17 16 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9.5" cy="9.5" r="1.2" fill="currentColor"/><circle cx="14.5" cy="9.5" r="1.2" fill="currentColor"/></svg> },
  { id:"templates",  title:"Post Templates",icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
  { id:"insights",   title:"Writing Insights",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SmartTextarea({
  value,onChange,onInsert,placeholder,
  rows=5,disabled=false,maxWords,className="",textareaRef:externalRef,
}){
  const internalRef  = useRef(null);
  const textareaRef  = externalRef||internalRef;
  const fieldWrapRef = useRef(null);   // ← panels anchor to this
  const emojiSearchRef=useRef(null);
  const tipTimerRef  = useRef(null);

  // ── AI state ──────────────────────────────────────────────────────────────
  const [status,        setStatus]       = useState("idle");
  const [activeAction,  setActiveAction] = useState(null);
  const [alternates,    setAlternates]   = useState([]);
  const [altIndex,      setAltIndex]     = useState(0);
  const [originalText,  setOriginalText] = useState(null);
  const [baseText,      setBaseText]     = useState(null);
  const [batchCount,    setBatchCount]   = useState(0);
  const [diff,          setDiff]         = useState(null);
  const [showDiff,      setShowDiff]     = useState(false);
  const [errorMsg,      setErrorMsg]     = useState("");
  const [lastChanges,   setLastChanges]  = useState([]);
  const [improvement,   setImprovement]  = useState(null);

  // ── Tool strip state — ONE activeTool controls which panel is open ─────────
  const [activeTool,     setActiveTool]     = useState(null);   // "formatting" | "emoji" | "templates" | "insights" | null
  const [toolbarTab,     setToolbarTab]     = useState("bullets");
  const [activeListMode, setActiveListMode] = useState(null);
  const [symbolColor,    setSymbolColor]    = useState("#84cc16");
  const [showColorPicker,setShowColorPicker]= useState(false);
  const [recentTools,    setRecentTools]    = useState([]);
  const [emojiCat,       setEmojiCat]       = useState("trending");
  const [emojiSearch,    setEmojiSearch]    = useState("");

  // ── Intelligence / suggestion state ──────────────────────────────────────
  const [showSuggestion,  setShowSuggestion]  = useState(false);
  const [activeSuggestion,setActiveSuggestion]= useState(null);
  const [showActionsRow2, setShowActionsRow2] = useState(false);
  const [showHookPanel,   setShowHookPanel]   = useState(false);
  const [showCTAPanel,    setShowCTAPanel]    = useState(false);
  const [currentTip,      setCurrentTip]      = useState(0);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const{acceptImprovement,rejectImprovement,userStyle}=useAdaptiveEngine();
  const{push:pushUndo,pop:popUndo,canUndo}=useUndoStack();
  const intelligence=usePostIntelligence(value);
  const{
    wordSuggestions,phraseSuggestions,openingPhrases,
    hookSuggestions,ctaSuggestions,templateSuggestions,
    showCTAHint,detectedTopics,
    acceptWordSuggestion,acceptPhraseSuggestion,acceptOpeningPhrase,
    acceptHookSuggestion,acceptCTASuggestion,acceptTemplate,acceptFirstWord,
  }=useSmartSuggestions(textareaRef,value);

  // ── Derived ───────────────────────────────────────────────────────────────
  const wordCount  = useMemo(()=>(!value?.trim()?0:value.trim().split(/\s+/).filter(Boolean).length),[value]);
  const charCount  = value?.length||0;
  const hasContent = charCount>3;
  const isOverLimit= maxWords&&wordCount>maxWords;
  const isLoading  = status==="loading";
  const hasAlts    = status==="has-alternates"&&alternates.length>0;
  const currentAlt = hasAlts?alternates[altIndex]:null;
  const mainActions= ACTIONS.slice(0,6);
  const powerActions=ACTIONS.slice(6);
  const engScore   = intelligence?.engagement?.score||0;
  const innerBarActive=!!(errorMsg||wordSuggestions.length>0||phraseSuggestions.length>0||openingPhrases.length>0);

  // ── Toggle tool (closes if same, opens if different) ──────────────────────
  const toggleTool=useCallback((id)=>{
    setActiveTool(prev=>prev===id?null:id);
    if(id!=="emoji")setEmojiSearch("");
  },[]);

  const closeTool=useCallback(()=>setActiveTool(null),[]);

  // ── Outside click closes panels ───────────────────────────────────────────
  useEffect(()=>{
    const fn=(e)=>{
      if(fieldWrapRef.current&&!fieldWrapRef.current.contains(e.target)){
        setActiveTool(null);setShowColorPicker(false);
        setShowHookPanel(false);setShowCTAPanel(false);
      }
    };
    document.addEventListener("mousedown",fn);
    return()=>document.removeEventListener("mousedown",fn);
  },[]);

  useEffect(()=>{if(activeTool==="emoji")setTimeout(()=>emojiSearchRef.current?.focus(),60);else setEmojiSearch("");},[activeTool]);

  // ── Proactive suggestion banner ───────────────────────────────────────────
  useEffect(()=>{
    clearTimeout(tipTimerRef.current);
    if(!intelligence?.recommendations?.length||hasAlts||isLoading){setShowSuggestion(false);return;}
    tipTimerRef.current=setTimeout(()=>{
      const rec=intelligence.recommendations[0];
      const act=ACTIONS.find(a=>a.id===rec.action);
      if(act){setActiveSuggestion({...act,reason:rec.detail});setShowSuggestion(true);setTimeout(()=>setShowSuggestion(false),7000);}
    },2500);
    return()=>clearTimeout(tipTimerRef.current);
  },[value,intelligence,hasAlts,isLoading]);

  // ── List mode enter handler ────────────────────────────────────────────────
  useEffect(()=>{
    if(!textareaRef?.current||!activeListMode)return;
    const el=textareaRef.current;
    const fn=(e)=>{
      if(e.key!=="Enter")return;
      e.preventDefault();e.stopPropagation();
      const s=el.selectionStart,end=el.selectionEnd,val=el.value;
      const ls=val.lastIndexOf("\n",s-1)+1;
      const cl=val.substring(ls,s);
      let only=false;
      if(activeListMode.type==="bullet"||activeListMode.type==="arrow"){const esc=activeListMode.symbol.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");only=new RegExp(`^\\s*${esc}\\s*$`).test(cl);}
      else if(activeListMode.type==="number")only=/^\s*\d+[.)\]]\s*$/.test(cl);
      if(only){_commit(val.substring(0,ls)+val.substring(end));setTimeout(()=>{el.focus?.();el.setSelectionRange?.(ls,ls);},0);setActiveListMode(null);return;}
      const INDENT="    ",SPACE="  ";
      let cont="\n";
      if(activeListMode.type==="bullet"||activeListMode.type==="arrow")cont+=`${INDENT}${activeListMode.symbol}${SPACE}`;
      else if(activeListMode.type==="number"){const m=cl.match(/(\d+)/);cont+=`${INDENT}${activeListMode.format(m?parseInt(m[1])+1:1)}${SPACE}`;}
      _commit(val.substring(0,end)+cont+val.substring(end));
      setTimeout(()=>{el.focus?.();el.setSelectionRange?.(end+cont.length,end+cont.length);},0);
    };
    el.addEventListener("keydown",fn,true);
    return()=>el.removeEventListener("keydown",fn,true);
  },[activeListMode,textareaRef]);

  // ── Tab = accept first word suggestion ────────────────────────────────────
  useEffect(()=>{
    const el=textareaRef?.current;if(!el)return;
    const fn=(e)=>{
      if(e.key==="Tab"&&wordSuggestions.length>0){
        e.preventDefault();e.stopPropagation();
        const nv=acceptFirstWord();if(nv){_commit(nv);setTimeout(()=>{el.focus?.();el.setSelectionRange?.(nv.length,nv.length);},0);}
      }
      if((e.metaKey||e.ctrlKey)&&e.key==="z"&&canUndo){e.preventDefault();handleUndo();}
    };
    el.addEventListener("keydown",fn,true);
    return()=>el.removeEventListener("keydown",fn,true);
  },[textareaRef,wordSuggestions,acceptFirstWord,canUndo]);

  // ── Show alternate ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(hasAlts&&currentAlt){setDiff(diffWords(baseText||"",currentAlt));setShowDiff(true);_commit(currentAlt);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[altIndex,alternates]);

  // ── Core helpers ──────────────────────────────────────────────────────────
  const _commit=useCallback((nv)=>{if(onInsert)onInsert(nv);else if(onChange)onChange({target:{value:nv}});},[onInsert,onChange]);
  const saveCursor=useCallback(()=>{const el=textareaRef.current;return el?{s:el.selectionStart??0,e:el.selectionEnd??0}:{s:0,e:0};},[textareaRef]);
  const restoreCursor=useCallback((pos,nv)=>{const el=textareaRef.current;if(!el)return;const p=Math.min(pos.s,nv.length);requestAnimationFrame(()=>{el.focus?.();el.setSelectionRange?.(p,p);});},[textareaRef]);

  const commitSuggestion=useCallback((newVal,appendMode=false)=>{
    const el=textareaRef.current;
    if(appendMode){const cur=el?el.value:"";_commit(cur+newVal);}
    else _commit(newVal);
    setTimeout(()=>{if(el){el.focus?.();const l=(appendMode?(el.value||"").length:newVal.length);el.setSelectionRange?.(l,l);}},0);
  },[textareaRef,_commit]);

  // ── AI action ─────────────────────────────────────────────────────────────
  const handleAction=useCallback(async(actionId)=>{
    if(!hasContent||isLoading||disabled)return;
    setShowSuggestion(false);
    const txt=value;const cur=saveCursor();
    pushUndo(txt);setOriginalText(txt);setBaseText(txt);setActiveAction(actionId);
    setStatus("loading");setAlternates([]);setAltIndex(0);setShowDiff(false);setErrorMsg("");setBatchCount(0);setImprovement(null);
    try{
      const{alternates:res,improvement:imp}=await generateAlternates(actionId,txt,0,userStyle);
      if(!res?.length){setStatus("idle");setActiveAction(null);setErrorMsg("✦ Already optimal — try a different action");setTimeout(()=>setErrorMsg(""),3500);return;}
      setAlternates(res);setAltIndex(0);setBatchCount(1);setStatus("has-alternates");setImprovement(imp);
      const first=res[0];setDiff(diffWords(txt,first));setShowDiff(true);_commit(first);restoreCursor(cur,first);
      setLastChanges([{from:txt,to:first,type:actionId}]);
    }catch(err){
      setStatus("error");setErrorMsg(`${err.message}`);setActiveAction(null);
      setTimeout(()=>{setStatus("idle");setErrorMsg("");},5000);
    }
  },[value,hasContent,isLoading,disabled,saveCursor,pushUndo,_commit,restoreCursor,userStyle]);

  const handleNextAlternate=useCallback(async()=>{
    if(!activeAction||!baseText)return;
    const ni=altIndex+1;
    if(ni<alternates.length){setAltIndex(ni);return;}
    setStatus("loading");
    try{
      const{alternates:nr}=await generateAlternates(activeAction,baseText,batchCount,userStyle);
      if(!nr?.length){setAltIndex(0);setStatus("has-alternates");return;}
      const combined=[...alternates,...nr];
      setAlternates(combined);setAltIndex(ni<combined.length?ni:0);setBatchCount(c=>c+1);setStatus("has-alternates");
    }catch{setAltIndex(0);setStatus("has-alternates");}
  },[activeAction,baseText,altIndex,alternates,batchCount,userStyle]);

  const handleAccept=useCallback(()=>{
    if(!currentAlt)return;
    setShowDiff(false);setStatus("idle");setActiveAction(null);setAlternates([]);setAltIndex(0);setOriginalText(null);setBaseText(null);setImprovement(null);
    acceptImprovement(activeAction,lastChanges);_commit(currentAlt);
  },[currentAlt,activeAction,lastChanges,acceptImprovement,_commit]);

  const handleReject=useCallback(()=>{
    if(originalText==null)return;
    setShowDiff(false);setStatus("idle");setActiveAction(null);setAlternates([]);setAltIndex(0);setImprovement(null);
    rejectImprovement(activeAction,lastChanges);_commit(originalText);setOriginalText(null);setBaseText(null);
  },[originalText,activeAction,lastChanges,rejectImprovement,_commit]);

  const handleUndo=useCallback(()=>{
    const prev=popUndo();if(!prev)return;
    _commit(prev);requestAnimationFrame(()=>{const el=textareaRef.current;if(el){el.focus?.();el.setSelectionRange?.(prev.length,prev.length);}});
    if(lastChanges.length>0&&activeAction)rejectImprovement(activeAction,lastChanges);
    if(hasAlts){setShowDiff(false);setStatus("idle");setActiveAction(null);setAlternates([]);setAltIndex(0);setOriginalText(null);setBaseText(null);}
  },[popUndo,_commit,textareaRef,lastChanges,activeAction,rejectImprovement,hasAlts]);

  // ── Formatting helpers ────────────────────────────────────────────────────
  const saveToRecent=useCallback((t)=>{setRecentTools(p=>{const n=[t,...p.filter(x=>x.id!==t.id)].slice(0,4);try{localStorage.setItem("textToolbarRecent",JSON.stringify(n));}catch{}return n;});},[]);
  useEffect(()=>{try{const s=localStorage.getItem("textToolbarRecent");if(s)setRecentTools(JSON.parse(s));}catch{}},[]);

  const insertTool=useCallback((text,tool)=>{
    const el=textareaRef.current;if(!el)return;
    const s=el.selectionStart??0,end=el.selectionEnd??s,cur=el.value??"";
    const INDENT="    ",SPACE="  ";
    let nt="",np=s;
    if(tool.type==="bullet"||tool.type==="arrow"){nt=`${INDENT}${text}${SPACE}`;np=s+nt.length;setActiveListMode({type:tool.type,symbol:text,label:tool.label,id:tool.id,indent:INDENT,spacing:SPACE});}
    else if(tool.type==="number"){nt=`${INDENT}${tool.format(1)}${SPACE}`;np=s+nt.length;setActiveListMode({type:"number",format:tool.format,label:tool.label,id:tool.id,indent:INDENT,spacing:SPACE});}
    else if(tool.type==="char"){nt=text;np=s+text.length;}
    _commit(cur.substring(0,s)+nt+cur.substring(end));
    setTimeout(()=>{el.focus?.();el.setSelectionRange?.(np,np);},0);
    saveToRecent(tool);setActiveTool(null);
  },[textareaRef,_commit,saveToRecent]);

  const insertEmoji=useCallback((emoji)=>{
    const el=textareaRef.current;if(!el)return;
    const s=el.selectionStart??0,cur=el.value??"";
    _commit(cur.substring(0,s)+emoji+cur.substring(s));
    setTimeout(()=>{el.focus?.();el.setSelectionRange?.(s+emoji.length,s+emoji.length);},0);
    setActiveTool(null);
  },[textareaRef,_commit]);

  const filteredEmojis=useMemo(()=>{
    const q=emojiSearch.trim().toLowerCase();
    if(q)return EMOJI_CATEGORIES.flatMap(c=>c.emojis).filter(e=>e.includes(q));
    return EMOJI_CATEGORIES.find(c=>c.id===emojiCat)?.emojis??[];
  },[emojiCat,emojiSearch]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return(
    <div className={["smart-textarea-wrapper",isLoading?"is-processing":"",hasAlts?"is-has-alts":"",status==="error"?"is-error-state":"",className].join(" ")}>

      {/* Proactive suggestion banner */}
      {showSuggestion&&activeSuggestion&&!hasAlts&&!isLoading&&(
        <div className="smart-suggestion-banner" style={{borderColor:activeSuggestion.color+"55"}}>
          <span className="ssb-icon" style={{color:activeSuggestion.color}}>{activeSuggestion.icon}</span>
          <span className="ssb-text">{activeSuggestion.reason||`Try ${activeSuggestion.label} to improve this`}</span>
          <button className="ssb-action" style={{borderColor:activeSuggestion.color+"66",color:activeSuggestion.color}} onClick={()=>{setShowSuggestion(false);handleAction(activeSuggestion.id);}}>
            {activeSuggestion.label} →
          </button>
          <button className="ssb-dismiss" onClick={()=>setShowSuggestion(false)}>×</button>
        </div>
      )}

      {/* CTA hint */}
      {showCTAHint&&!hasAlts&&!isLoading&&wordCount>30&&(
        <div className="smart-cta-hint">
          <span className="cta-hint-icon">💬</span>
          <span className="cta-hint-text">No engagement hook — posts with a question get 2× more comments</span>
          <button className="cta-hint-btn" onClick={()=>{setShowCTAPanel(p=>!p);setShowHookPanel(false);}}>
            Add CTA {showCTAPanel?"↑":"↓"}
          </button>
          <button className="cta-hint-or-action" onClick={()=>handleAction("engage")}>Auto-Engage →</button>
        </div>
      )}
      {showCTAPanel&&ctaSuggestions.length>0&&(
        <div className="sug-panel sug-panel--cta">
          <div className="sug-panel-header">💬 Add a call-to-action</div>
          {ctaSuggestions.map((cta,i)=>(
            <button key={i} className="sug-panel-item" onClick={()=>{commitSuggestion(acceptCTASuggestion(cta),true);setShowCTAPanel(false);}}>
              <span className="sug-item-text">{cta}</span><span className="sug-item-add">+ Append</span>
            </button>
          ))}
        </div>
      )}

      {/* Hook panel */}
      {showHookPanel&&hookSuggestions.length>0&&(
        <div className="sug-panel sug-panel--hook">
          <div className="sug-panel-header">⚡ Replace your opening with a stronger hook</div>
          {hookSuggestions.map((hook,i)=>(
            <button key={i} className="sug-panel-item" onClick={()=>{const l=value.split("\n");l[0]=hook;commitSuggestion(l.join("\n"));setShowHookPanel(false);}}>
              <span className="sug-item-text">{hook}</span><span className="sug-item-add">Use →</span>
            </button>
          ))}
        </div>
      )}

      {/* ════ FIELD WRAP — all panels anchor here ═══════════════════════════ */}
      <div className="smart-textarea-field-wrap" ref={fieldWrapRef}>

        <textarea
          ref={textareaRef}
          className={`smart-textarea-field${isLoading?" shimmer-active":""}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled||isLoading}
          spellCheck={true}
        />

        {/* ── HORIZONTAL TOOL STRIP (row, top-right) ───────────────────── */}
        <div className="sft-row">

          {/* Active list mode chip */}
          {activeListMode&&(
            <div className="sft-list-chip">
              <button
                className="sft-list-chip-btn"
                style={{color:symbolColor}}
                onClick={()=>setShowColorPicker(p=>!p)}
                title="Change colour"
              >
                <span>{activeListMode.type==="number"?activeListMode.label?.split(" ")[0]:activeListMode.symbol}</span>
                <svg width="6" height="5" viewBox="0 0 6 5" fill="none"><path d="M1 1L3 4L5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </button>
              <button className="sft-list-exit" onClick={()=>{setActiveListMode(null);setShowColorPicker(false);}} title="Exit list mode">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1L7 7M7 1L1 7" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )}

          {/* Recent tools (quick access) */}
          {!activeListMode&&recentTools.slice(0,2).map(t=>(
            <button key={t.id} className="sft-recent" title={t.label}
              onClick={()=>{if(t.type==="number")insertTool(t.format(1),t);else insertTool(t.symbol||t.char,t);}}>
              {t.type==="number"?t.label?.split(" ")[0]:(t.symbol||t.char)}
            </button>
          ))}

          {/* Main tools — the active one is visually at the right edge */}
          {TOOL_DEFS.map(tool=>{
            const isActive=activeTool===tool.id;
            const isInsightsWithScore=tool.id==="insights"&&engScore>0;
            return(
              <button
                key={tool.id}
                className={`sft-tool${isActive?" sft-tool--active":""}`}
                style={isActive?{borderColor:isInsightsWithScore?engColor(engScore):"#84cc16",color:isInsightsWithScore?engColor(engScore):"#84cc16"}:{}}
                onClick={()=>toggleTool(tool.id)}
                disabled={disabled}
                title={tool.title}
              >
                {tool.icon}
                {isInsightsWithScore&&!isActive&&<span className="sft-eng-dot" style={{background:engColor(engScore)}}/>}
              </button>
            );
          })}
        </div>

        {/* ── COLOR PICKER PANEL ───────────────────────────────────────────── */}
        {showColorPicker&&(
          <div className="smart-panel smart-panel--colors">
            {SYMBOL_COLORS.map(c=>(
              <button key={c.value} className={`sft-swatch${symbolColor===c.value?" active":""}`}
                style={{background:c.value}} title={c.name}
                onClick={()=>{setSymbolColor(c.value);setActiveListMode(m=>m?{...m,color:c.value}:m);setShowColorPicker(false);}}/>
            ))}
          </div>
        )}

        {/* ── FORMATTING PANEL ─────────────────────────────────────────────── */}
        {activeTool==="formatting"&&(
          <div className="smart-panel smart-panel--formatting">
            <div className="sp-header">
              {[{id:"bullets",sym:"•",text:"Bullets"},{id:"numbers",sym:"1.",text:"Numbers"},{id:"arrows",sym:"→",text:"Arrows"},{id:"special",sym:"✨",text:"Special"}].map(tab=>(
                <button key={tab.id} className={`sp-tab${toolbarTab===tab.id?" active":""}`} onClick={()=>setToolbarTab(tab.id)}>
                  <span className="sp-tab-sym">{tab.sym}</span><span className="sp-tab-txt">{tab.text}</span>
                </button>
              ))}
              <button className="sp-close" onClick={closeTool}>×</button>
            </div>
            <div className="sp-body">
              {toolbarTab==="bullets"&&<div className="sp-grid">{BULLET_STYLES.map(b=><button key={b.id} className="sp-item" onClick={()=>insertTool(b.symbol,{...b,type:"bullet"})}><span className="sp-sym">{b.symbol}</span><span className="sp-lbl">{b.label}</span></button>)}</div>}
              {toolbarTab==="numbers"&&<div className="sp-grid">{NUMBER_STYLES.map(n=><button key={n.id} className="sp-item" onClick={()=>insertTool(n.format(1),{...n,type:"number"})}><span className="sp-lbl">{n.label}</span></button>)}</div>}
              {toolbarTab==="arrows" &&<div className="sp-grid">{ARROW_STYLES.map(a=><button key={a.id} className="sp-item" onClick={()=>insertTool(a.symbol,{...a,type:"arrow"})}><span className="sp-sym">{a.symbol}</span><span className="sp-lbl">{a.label}</span></button>)}</div>}
              {toolbarTab==="special"&&<div className="sp-grid sp-grid--wide">{SPECIAL_CHARS.map(c=><button key={c.char} className="sp-item sp-char-item" onClick={()=>insertTool(c.char,{id:c.char,char:c.char,type:"char",label:c.label})} title={c.label}><span className="sp-char">{c.char}</span></button>)}</div>}
            </div>
          </div>
        )}

        {/* ── EMOJI PANEL — centered, never overflows left or right ────────── */}
        {activeTool==="emoji"&&(
          <div className="smart-panel smart-panel--emoji">
            <div className="ep-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <input ref={emojiSearchRef} className="ep-search" placeholder="Search emojis…" value={emojiSearch} onChange={e=>setEmojiSearch(e.target.value)}/>
              {emojiSearch&&<button className="ep-clear" onClick={()=>setEmojiSearch("")}>×</button>}
              <button className="sp-close" onClick={closeTool}>×</button>
            </div>
            {!emojiSearch&&(
              <>
                <div className="ep-cats">{EMOJI_CATEGORIES.map(c=><button key={c.id} className={`ep-cat${emojiCat===c.id?" active":""}`} onClick={()=>setEmojiCat(c.id)} title={c.label}>{c.icon}</button>)}</div>
                <div className="ep-cat-label">{EMOJI_CATEGORIES.find(c=>c.id===emojiCat)?.label}</div>
              </>
            )}
            {emojiSearch&&<div className="ep-search-hint">{filteredEmojis.length} result{filteredEmojis.length!==1?"s":""}</div>}
            <div className="ep-grid">
              {filteredEmojis.map((e,i)=><button key={`${e}-${i}`} className="ep-emoji" onClick={()=>insertEmoji(e)} title={e}>{e}</button>)}
              {filteredEmojis.length===0&&<div className="ep-empty">No emojis found</div>}
            </div>
          </div>
        )}

        {/* ── TEMPLATES PANEL ──────────────────────────────────────────────── */}
        {activeTool==="templates"&&templateSuggestions.length>0&&(
          <div className="smart-panel smart-panel--templates">
            <div className="sp-header">
              <span className="sp-header-title">✦ Post Templates</span>
              <button className="sp-close" onClick={closeTool}>×</button>
            </div>
            <div className="tp-list">
              {templateSuggestions.map(t=>(
                <button key={t.id} className="tp-item" onClick={()=>{commitSuggestion(acceptTemplate(t));closeTool();}}>
                  <span className="tp-icon">{t.icon}</span>
                  <div className="tp-info">
                    <div className="tp-label">{t.label}</div>
                    <div className="tp-preview">{t.text.substring(0,55)}…</div>
                  </div>
                  <span className="tp-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── INSIGHTS PANEL ───────────────────────────────────────────────── */}
        {activeTool==="insights"&&intelligence&&(
          <div className="smart-panel smart-panel--insights">
            <div className="sp-header">
              <span className="sp-header-title" style={{color:engColor(engScore)}}>Writing Insights</span>
              <button className="sp-close" onClick={closeTool}>×</button>
            </div>
            {/* Engagement ring */}
            <div className="wip-eng-row">
              <div className="wip-eng-score">
                <div className="wip-eng-ring" style={{"--ec":engColor(engScore),"--deg":`${(engScore/100)*360}deg`}}>
                  <span className="wip-eng-num" style={{color:engColor(engScore)}}>{engScore}</span>
                </div>
                <div className="wip-eng-info">
                  <div style={{fontSize:12,fontWeight:600,color:engColor(engScore)}}>
                    {engScore>=75?"High Engagement":engScore>=50?"Good Engagement":engScore>=25?"Low Engagement":"Needs Work"}
                  </div>
                  <div style={{fontSize:"9.5px",color:"rgba(255,255,255,0.35)"}}>
                    Hook {intelligence.engagement.breakdown.hook}/30 · CTA {intelligence.engagement.breakdown.cta}/20 · Format {intelligence.engagement.breakdown.format}/10
                  </div>
                </div>
              </div>
              {intelligence.intent&&(
                <div className="wip-intent-chip" style={{borderColor:intelligence.intent.color+"55",color:intelligence.intent.color}}>
                  {intelligence.intent.emoji} {intelligence.intent.label}
                </div>
              )}
            </div>
            {/* Topic */}
            {intelligence.primaryTopic&&(
              <div className="wip-topic-row">
                <span className="wip-topic-label">Topic:</span>
                <span className="wip-topic-badge">{intelligence.primaryTopic}</span>
                {intelligence.topics.slice(1,3).map(t=><span key={t} className="wip-topic-badge wip-topic-badge--secondary">{t}</span>)}
              </div>
            )}
            {/* Recommendations */}
            {intelligence.recommendations?.length>0&&(
              <div className="wip-recs">
                {intelligence.recommendations.slice(0,3).map((rec,i)=>(
                  <button key={i} className={`wip-rec wip-rec--${rec.priority}`} onClick={()=>{closeTool();handleAction(rec.action);}} disabled={isLoading} title={rec.detail}>
                    <span className="wip-rec-label">{rec.label}</span>
                    <span className="wip-rec-action">→ {rec.action}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Hook strip */}
            {wordCount>=3&&wordCount<=40&&hookSuggestions.length>0&&(
              <div className="wip-hook-strip">
                <span className="wip-hook-label">⚡ Hook ideas:</span>
                <div className="wip-hooks">
                  {hookSuggestions.slice(0,3).map((h,i)=>(
                    <button key={i} className="wip-hook-chip" onClick={()=>{const l=value.split("\n");l[0]=h;commitSuggestion(l.join("\n"));closeTool();}}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Overused words */}
            {intelligence.overused?.length>0&&(
              <div className="wip-overused">
                <span className="wip-overused-label">⚠ Overused:</span>
                {intelligence.overused.map(({word,count})=><span key={word} className="wip-overused-word">"{word}" ×{count}</span>)}
              </div>
            )}
            {/* Readability */}
            <div className="wip-read-row">
              <div className="wip-read-score" style={{color:readColor(intelligence.readability.score)}}>{intelligence.readability.score}</div>
              <div className="wip-read-info">
                <span style={{fontSize:12,fontWeight:600,color:readColor(intelligence.readability.score)}}>{intelligence.readability.level}</span>
                <span style={{fontSize:"10px",color:"rgba(255,255,255,0.35)"}}> · {wordCount}w · ~{Math.ceil(intelligence.readTimeSeconds/60)||1}m read</span>
              </div>
            </div>
            {/* Tip */}
            <div className="wip-tip">
              <span>💡</span>
              <span className="wip-tip-text">{COACH_TIPS[currentTip%COACH_TIPS.length]}</span>
              <button className="wip-tip-next" onClick={()=>setCurrentTip(i=>i+1)} title="Next tip">↻</button>
            </div>
          </div>
        )}

        {/* Diff overlay */}
        {showDiff&&diff&&(
          <div className="smart-diff-overlay" aria-hidden="true">
            {diff.map((p,i)=>(
              <span key={i} className={p.type==="added"?"diff-added":p.type==="removed"?"diff-removed":"diff-equal"} style={{animationDelay:`${i*14}ms`}}>{p.value}</span>
            ))}
          </div>
        )}

        {/* Shimmer */}
        {isLoading&&<div className="smart-shimmer-bar" aria-hidden="true"><div className="smart-shimmer-fill"/></div>}

        {/* Alt HUD */}
        {hasAlts&&(
          <div className="alt-hud">
            <div className="alt-hud-left">
              <span className="alt-badge">{altIndex+1}/{alternates.length}+</span>
              <span className="alt-action-name">{ACTIONS.find(a=>a.id===activeAction)?.label}</span>
              {improvement?.wordCountDelta!==0&&improvement&&(
                <span className={`alt-delta${improvement.wordCountDelta<0?" alt-delta--cut":" alt-delta--added"}`}>
                  {improvement.wordCountDelta<0?`−${Math.abs(improvement.wordCountDelta)}w`:`+${improvement.wordCountDelta}w`}
                </span>
              )}
            </div>
            <div className="alt-hud-right">
              <button className="alt-btn alt-btn-next" onClick={handleNextAlternate} disabled={isLoading}>{isLoading?<SpinnerDots/>:<>↻ Next</>}</button>
              <button className="alt-btn alt-btn-accept" onClick={handleAccept}>✓ Keep</button>
              <button className="alt-btn alt-btn-reject" onClick={handleReject}>✕ Revert</button>
            </div>
          </div>
        )}

        {/* ── INNER STATUS BAR ─────────────────────────────────────────────── */}
        <div className="smart-inner-bar">
          <span className={`sib-watermark${innerBarActive?" sib-watermark--faded":""}`}>✦ Writing assistance · under development</span>
          {errorMsg&&<span className={`sib-message${errorMsg.startsWith("✦")?" sib-message--info":" sib-message--error"}`}>{errorMsg}</span>}
          {!errorMsg&&openingPhrases.length>0&&(
            <div className="sib-chips">
              <span className="sib-chips-label">Start:</span>
              {openingPhrases.map((p,i)=><button key={i} className="sib-chip sib-chip--phrase" onClick={()=>commitSuggestion(acceptOpeningPhrase(p))} disabled={disabled}>{p}</button>)}
            </div>
          )}
          {!errorMsg&&!openingPhrases.length&&wordSuggestions.length>0&&(
            <div className="sib-chips">
              {wordSuggestions.map((w,i)=>(
                <button key={i} className="sib-chip sib-chip--word" onClick={()=>commitSuggestion(acceptWordSuggestion(w))} disabled={disabled}>
                  {w}{i===0&&<kbd>Tab</kbd>}
                </button>
              ))}
            </div>
          )}
          {!errorMsg&&!openingPhrases.length&&!wordSuggestions.length&&phraseSuggestions.length>0&&(
            <div className="sib-chips">
              <span className="sib-chips-label">Continue:</span>
              {phraseSuggestions.slice(0,2).map((p,i)=>(
                <button key={i} className="sib-chip sib-chip--phrase" onClick={()=>commitSuggestion(acceptPhraseSuggestion(p),true)} disabled={disabled}>
                  {p.length>44?p.slice(0,44)+"…":p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>{/* end field-wrap */}

      {/* ── BOTTOM BAR ────────────────────────────────────────────────────── */}
      <div className={`smart-bottom-bar${hasContent?" has-content":""}`}>
        <div className="smart-actions">
          {mainActions.map(action=>(
            <SmartActionButton key={action.id} action={action}
              isActive={activeAction===action.id}
              isLoading={isLoading&&activeAction===action.id}
              disabled={!hasContent||(isLoading&&activeAction!==action.id)||disabled}
              onClick={()=>{
                if(hasAlts&&activeAction===action.id)handleNextAlternate();
                else if(hasAlts){handleAccept();setTimeout(()=>handleAction(action.id),50);}
                else handleAction(action.id);
              }}/>
          ))}
          <button className={`sft-more-btn${showActionsRow2?" active":""}`} onClick={()=>setShowActionsRow2(p=>!p)} disabled={disabled} title="Power actions">
            {showActionsRow2?"−":"+4"}
          </button>
        </div>

        {showActionsRow2&&(
          <div className="smart-actions smart-actions--power">
            {powerActions.map(action=>(
              <SmartActionButton key={action.id} action={action}
                isActive={activeAction===action.id}
                isLoading={isLoading&&activeAction===action.id}
                disabled={!hasContent||(isLoading&&activeAction!==action.id)||disabled}
                onClick={()=>{
                  if(hasAlts&&activeAction===action.id)handleNextAlternate();
                  else if(hasAlts){handleAccept();setTimeout(()=>handleAction(action.id),50);}
                  else handleAction(action.id);
                }}/>
            ))}
          </div>
        )}

        <div className="smart-meta">
          {canUndo&&status==="idle"&&<button className="smart-undo-btn" onClick={handleUndo} title="Undo (⌘Z)">↩ Undo</button>}
          {wordCount>=3&&wordCount<=30&&!hasAlts&&(
            <button className="smart-meta-hook-btn" onClick={()=>{setShowHookPanel(p=>!p);setShowCTAPanel(false);}} title="Hook suggestions" style={{color:"#fbbf24",borderColor:"#fbbf2433"}}>
              ⚡ Hook
            </button>
          )}
          {intelligence&&engScore>0&&(
            <div className="smart-eng-badge" style={{color:engColor(engScore),borderColor:engColor(engScore)+"44"}} title={`Engagement: ${engScore}/100`}>{engScore}</div>
          )}
          {intelligence?.primaryTopic&&<div className="smart-topic-chip">{intelligence.primaryTopic}</div>}
          {intelligence?.intent&&<div className="smart-intent-chip" style={{color:intelligence.intent.color}} title={intelligence.intent.label}>{intelligence.intent.emoji}</div>}
          <span className={`smart-count${isOverLimit?" over-limit":""}`}>
            {maxWords
              ?<><span className={wordCount>maxWords*0.9?"count-warn":""}>{wordCount}</span>/{maxWords}w</>
              :<>{charCount}c</>}
          </span>
        </div>
      </div>
    </div>
  );
}

function SmartActionButton({action,isActive,isLoading,disabled,onClick}){
  return(
    <button className={`smart-action-btn${isActive?" is-active":""}${isLoading?" is-loading":""}`} onClick={onClick} disabled={disabled} title={action.desc} style={{"--btn-color":action.color}}>
      <span className="action-icon" aria-hidden="true">{isLoading?<SpinnerDots/>:action.icon}</span>
      <span className="action-label">{action.label}</span>
    </button>
  );
}
function SpinnerDots(){return<span className="spinner-dots"><span/><span/><span/></span>;}