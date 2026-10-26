import { useState, useEffect, useRef } from "react";
import {
  Home, Search, PlusSquare, Users, Wallet, User, LayoutGrid, Pencil, Bookmark, UserPlus, ShieldCheck, Hash,
  Sprout, MapPin, Cake, Heart, BadgeCheck, MoreHorizontal, Mail, Bell, X, Check, Lock, Globe, Eye, GitBranch,
  FileText, MessageSquareQuote, Sparkles, ScrollText, Settings as SettingsIcon, Shield, ArrowLeft, Fingerprint, Layers, Network,
  Activity as ActivityIcon, Send, Briefcase, GraduationCap, Award, FolderGit2, ChevronRight, Plus, Link2, MessageCircle, Repeat2,
  Share, Clock, Radio, ChevronDown, Download, Ban, AlertTriangle, Hourglass, RefreshCw, WifiOff, Copy, Share2, Image as ImageIcon, Images, BellRing, BellOff, Flag, UserX, Camera,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════
   SPLIT NOTICE — ONE FILE FOR PROTOTYPING ONLY. Split at each "FILE:" banner:
     src/data/xrdData.js                    → DATA
     src/styles/xeevia-xrd.css              → CSS (the template string)
     src/components/profile/ProfilePage.jsx → ProfilePage, LeftSidebar, RightSidebar, XrdEntryCard
     src/components/profile/PeopleStack.jsx → PAv, PeopleStack, PeopleSheet
     src/components/xrd/XrdApp.jsx          → XrdApp shell + section router
     src/components/xrd/sections/*.jsx      → one file per section
     src/components/xrd/RemarkParts.jsx     → RemarkCard, TraceModal, Composer
     src/App.jsx                            → routes: /:handle and /:handle/xrd
   Styling uses plain CSS classes (no Tailwind) so it renders anywhere.
   ══════════════════════════════════════════════════════════════════════ */

/* ═════════ FILE: src/styles/xeevia-xrd.css ═════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
.xv{--bg:#000;--pn:#050505;--bd:#2a2d2a;--bh:#4a4f4a;--ac:#a3e635;--tx:#ececec;--mu:#8a918a;--r:18px;min-height:100vh;background:#000;color:var(--tx);font-family:'DM Sans',ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5}
.xv *{box-sizing:border-box}.xv button{font-family:inherit;color:inherit;cursor:pointer}
.mu{color:var(--mu)}.ac{color:var(--ac)}.sm{font-size:12px}.xs{font-size:11px}.b{font-weight:700}.mono{font-family:'JetBrains Mono',ui-monospace,monospace}.row{display:flex;align-items:center;gap:10px}.col{display:flex;flex-direction:column;gap:10px}.fl{flex:1;min-width:0}.tr{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pn{background:var(--pn);border:1px solid var(--bd);border-radius:var(--r);padding:16px}
.pn h3{margin:0 0 12px;font-size:15px;font-weight:700}.hrow{display:flex;align-items:center;gap:10px;margin-bottom:14px}.hrow h3{margin:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 16px;border-radius:999px;border:1px solid #3a3e3a;background:#000;font-weight:600;font-size:13px;transition:.15s}
.btn:hover{border-color:var(--bh);background:#0d0d0d}.btn.p{background:var(--ac);color:#0a1400;border-color:var(--ac)}.btn.p:hover{filter:brightness(1.1)}
.btn.w{background:#fff;color:#000;border-color:#fff}.btn.s{padding:5px 12px;font-size:12px}.btn:disabled{opacity:.4;cursor:default}
.ib{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid #3a3e3a;background:#000}.ib:hover{border-color:var(--bh)}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 9px;border-radius:999px;border:1px solid #33372f;background:#000;color:var(--mu);white-space:nowrap}
.chip.g{color:var(--ac);border-color:rgba(163,230,53,.35)}.chip.o{color:#fbbf24;border-color:rgba(251,191,36,.35)}.chip.r{color:#f87171;border-color:rgba(248,113,113,.35)}.chip.bl{color:#60a5fa;border-color:rgba(96,165,250,.35)}.chip.pu{color:#c4b5fd;border-color:rgba(196,181,253,.35)}.chip.pk{color:#f0abfc;border-color:rgba(240,171,252,.35)}
.av{border-radius:50%;display:grid;place-items:center;font-weight:800;color:#06100a;flex:none}
.bg-grid{background-image:linear-gradient(rgba(163,230,53,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.05) 1px,transparent 1px);background-size:22px 22px}
.bg-dots{background-image:radial-gradient(rgba(255,255,255,.09) 1px,transparent 1px);background-size:14px 14px}
.bg-hatch{background-image:repeating-linear-gradient(135deg,rgba(251,191,36,.07) 0 2px,transparent 2px 10px)}
.bg-scan{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px)}
.bg-circuit{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cpath d='M0 45h22l10-10h24M56 35V8M34 90V68l10-10h46M70 58V40' fill='none' stroke='%23a3e635' stroke-opacity='.11'/%3E%3Ccircle cx='22' cy='45' r='2' fill='%23a3e635' fill-opacity='.25'/%3E%3Ccircle cx='56' cy='8' r='2' fill='%23a3e635' fill-opacity='.25'/%3E%3Ccircle cx='70' cy='40' r='2' fill='%23a3e635' fill-opacity='.25'/%3E%3C/svg%3E")}
.glow{box-shadow:inset 0 0 60px rgba(163,230,53,.05)}
.pg{display:grid;grid-template-columns:72px 290px minmax(0,640px) 300px;gap:16px;max-width:1440px;margin:0 auto;padding:14px}
.rail{position:sticky;top:14px;align-self:start;display:flex;flex-direction:column;gap:8px}
.rail .it{height:48px;border-radius:14px;display:grid;place-items:center;border:1px solid var(--bd);background:#000;color:var(--mu)}.rail .it.on{color:var(--ac);border-color:var(--ac)}
.side{position:sticky;top:14px;align-self:start;display:flex;flex-direction:column;gap:14px}
.ban{height:190px;position:relative;overflow:hidden;background:radial-gradient(circle at 18% 40%,#1f3d0e,transparent 55%),radial-gradient(circle at 90% 80%,#08362b,transparent 50%),#050805}
.ban:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(163,230,53,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.12) 1px,transparent 1px);background-size:30px 30px;mask-image:linear-gradient(90deg,transparent,#000 70%)}
.hex{position:absolute;right:26px;top:26px;width:92px;height:92px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(135deg,var(--ac),#10b981);display:grid;place-items:center;font-size:40px;font-weight:800;color:#041004;animation:fl 5s ease-in-out infinite}
@keyframes fl{50%{transform:translateY(-6px)}}
.tabs{display:flex;border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}.tabs button{flex:1;background:none;border:0;padding:14px 0;color:var(--mu);font-weight:600;position:relative}.tabs button.on{color:var(--tx)}.tabs button.on:after{content:"";position:absolute;left:30%;right:30%;bottom:0;height:3px;border-radius:3px;background:var(--ac)}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tile{--c:#a3e635;text-align:left;display:flex;gap:12px;align-items:center;padding:14px;border-radius:16px;border:1px solid var(--bd);background:#000;transition:.15s}
.tile:hover{border-color:var(--bh)}.tile .ti{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:var(--c);border:1px solid var(--bd);background:#0a0a0a}.tile b{color:var(--tx)}
.xrdc{position:relative;border-radius:20px;padding:18px;border:1px solid rgba(163,230,53,.45);background-color:#000;background-image:linear-gradient(rgba(163,230,53,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.05) 1px,transparent 1px);background-size:22px 22px}
.stat{background:#000;border:1px solid var(--bd);border-radius:12px;padding:10px;text-align:center}.stat b{display:block;font-size:20px;color:var(--tx)}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.post{padding:16px;border-bottom:1px solid var(--bd)}
.xs-shell{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}
.nav{position:sticky;top:0;height:100vh;overflow-y:auto;border-right:1px solid var(--bd);padding:16px 12px;background:#000}
.nav button{width:100%;display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:12px;background:none;border:0;color:var(--mu);font-size:13px;font-weight:600;text-align:left}.nav button:hover{background:#0d0d0d;color:var(--tx)}.nav button.on{background:#0d0d0d;color:var(--ac)}
.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:12px 24px;background:rgba(0,0,0,.94);border-bottom:1px solid var(--bd)}
.seg{display:flex;border:1px solid #3a3e3a;border-radius:999px;padding:3px;background:#000}.seg button{background:none;border:0;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;color:var(--mu)}.seg button.on{background:var(--ac);color:#0a1400}
.main{padding:24px;max-width:1040px}
.rec{display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;border:1px solid var(--bd);background-color:#000;cursor:pointer;transition:.15s;width:100%;text-align:left;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:14px 14px}.rec:hover{border-color:var(--bh)}
.ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#0a0a0a;border:1px solid var(--bd);color:var(--ac);flex:none}
.rm{border-radius:16px;border:1px solid var(--bd);background:#000;overflow:hidden;margin-bottom:12px}.rm .hd{padding:8px 14px;background-color:#080808;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 4px);border-bottom:1px solid var(--bd);display:flex;gap:8px;align-items:center;font-size:11px;letter-spacing:.04em;color:var(--mu)}
.rm blockquote{margin:12px 0;padding-left:12px;border-left:3px solid var(--ac);font-size:15px}.own{margin:0 14px 14px;padding:12px;border:1px dashed #4a4f4a;border-radius:12px;background:#050505}
.sys{border:1px solid #1f3552;background-color:#02060c;background-image:repeating-linear-gradient(0deg,rgba(96,165,250,.05) 0 1px,transparent 1px 4px);border-radius:14px;padding:12px}
.mod{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.8);display:grid;place-items:center;padding:16px}.mod>div{width:100%;max-width:480px;max-height:92vh;overflow:auto;background-color:#000;border:1px solid #3a3e3a;border-radius:20px;padding:20px}
.fsm>div{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cpath d='M0 45h22l10-10h24M56 35V8M34 90V68l10-10h46' fill='none' stroke='%23a3e635' stroke-opacity='.08'/%3E%3C/svg%3E")}
.kv{padding:10px 0;border-top:1px solid var(--bd)}
.chain{position:relative;margin-left:10px;padding-left:22px;border-left:2px solid #33372f}.chain>div{position:relative;margin-bottom:14px}.chain>div:before{content:"";position:absolute;left:-30px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--ac);box-shadow:0 0 12px var(--ac)}
.tg{width:38px;height:22px;border-radius:99px;background:#222;border:1px solid #3a3e3a;position:relative;flex:none}.tg:after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s}.tg.on{background:var(--ac);border-color:var(--ac)}.tg.on:after{left:18px;background:#0a1400}
input.in,textarea.in{width:100%;background:#000;border:1px solid #3a3e3a;border-radius:12px;padding:10px 12px;color:var(--tx);font:inherit;outline:none}input.in:focus,textarea.in:focus{border-color:var(--ac)}
.toast{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:90;background:#000;border:1px solid var(--ac);padding:10px 18px;border-radius:99px;font-weight:600;font-size:13px}
.dd{position:relative;max-width:420px;margin-bottom:16px;z-index:5}.ddb{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 14px;background:#000;border:1px solid #3a3e3a;border-radius:14px}.ddb:hover{border-color:var(--bh)}.ddb.on{border-color:var(--ac)}.ddb.on .dch{transform:rotate(180deg)}.dch{transition:.2s;color:var(--mu)}
.ddx{position:fixed;inset:0;z-index:30}.ddm{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:31;background:#000;border:1px solid #3a3e3a;border-radius:14px;max-height:320px;overflow:auto;padding:6px;box-shadow:0 24px 60px #000;animation:pop .14s ease-out}
@keyframes pop{from{opacity:0;transform:translateY(-6px)}}
.ddi{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;border-radius:10px;background:none;border:0}.ddi:hover{background:#0f0f0f}.ddi.on{background:#0a0a0a}
.nd{--t:#a3e635;position:relative;display:flex;gap:14px;padding:16px;background-color:#000;border:1px solid var(--bd);border-radius:16px;overflow:hidden;transition:.15s}.nd[role=button]:hover{border-color:var(--t)}
.nd:before,.nd:after{content:"";position:absolute;width:14px;height:14px;border:2px solid var(--t);opacity:.8}.nd:before{top:6px;left:6px;border-right:0;border-bottom:0;border-top-left-radius:6px}.nd:after{bottom:6px;right:6px;border-left:0;border-top:0;border-bottom-right-radius:6px}
.t-bl{--t:#60a5fa}.t-o{--t:#fbbf24}.t-w{--t:#d4d8d2}.ndi{width:42px;height:42px;border-radius:12px;border:1px solid var(--t);color:var(--t);display:grid;place-items:center;flex:none;background:#000}.ndt{color:var(--t);letter-spacing:.08em;font-weight:700}
.wire{position:relative;width:2px;height:30px;margin-left:37px;background:#33372f}.wire:after{content:"";position:absolute;left:-2px;top:-4px;width:6px;height:6px;border-radius:50%;background:var(--ac);box-shadow:0 0 10px var(--ac);animation:flow 2.2s linear infinite}.wire.o:after{background:#fbbf24;box-shadow:0 0 10px #fbbf24}
@keyframes flow{to{top:100%}}
.mini{width:100%;display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 10px;background:#000;border:1px solid var(--bd);border-radius:10px;font-size:12.5px;text-align:left}.mini:hover{border-color:var(--bh)}
.vw{background:#050505;border:1px solid var(--bd);border-radius:14px;overflow:hidden}.vwt{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--bd);font-size:12px;color:var(--mu)}.vwb{padding:16px;display:flex;flex-direction:column;gap:16px}
table.tb{width:100%;border-collapse:collapse;font-size:12.5px;min-width:360px}.tb th{text-align:left;color:var(--mu);font-weight:600;padding:8px 6px;border-bottom:1px solid var(--bd)}.tb td{padding:9px 6px;border-bottom:1px solid #151815}
.paper{background:#f3f0e6;color:#1d1d1d;padding:26px 20px;text-align:center;border:3px double #9a9482;font-family:Georgia,serif}.redb{height:11px;background:#2a2a2a;border-radius:3px}
.fsh{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.mnav{display:none}.sh-bd{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.75);animation:fade .2s}@keyframes fade{from{opacity:0}}
.sheet{position:fixed;left:0;right:0;bottom:0;z-index:51;background:#000;border-top:1px solid #3a3e3a;border-radius:24px 24px 0 0;padding:10px 16px calc(22px + env(safe-area-inset-bottom));max-height:82vh;overflow:auto;animation:up .3s cubic-bezier(.2,.9,.3,1)}@keyframes up{from{transform:translateY(100%)}}
.grab{width:40px;height:4px;border-radius:4px;background:#3a3e3a;margin:0 auto 16px}.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.si{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 6px;background:#000;border:1px solid var(--bd);border-radius:16px;font-size:12px;font-weight:600;color:var(--tx)}.si.on{border-color:var(--ac);color:var(--ac)}.si:active{background:#0d0d0d}
@media(max-width:1180px){.pg{grid-template-columns:72px 280px minmax(0,1fr)}.pg .rs{display:none}}
@media(max-width:900px){.pg{grid-template-columns:minmax(0,1fr)}.pg .rail,.pg .ls{display:none}.xs-shell{grid-template-columns:minmax(0,1fr)}.nav{display:none}.mnav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;z-index:40;background:#000;border-top:1px solid var(--bd);padding-bottom:env(safe-area-inset-bottom)}.mnav button{background:none;border:0;padding:10px 0;font-size:10px;color:var(--mu);display:flex;flex-direction:column;align-items:center;gap:3px}.mnav button.on{color:var(--ac)}.main{padding:16px 14px 96px}.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.top{padding:10px 14px}.dd{max-width:none}
.fsm{padding:0;place-items:stretch;background:#000}.fsm>div{max-width:none;max-height:none;height:100%;border:0;border-radius:0;padding:22px 18px 40px}.fsm .kv{border:0;padding:12px 0}.fsm .chain{border-left-color:#222}
.fsv{position:fixed;inset:0;z-index:70;background:#000;overflow:auto;padding:16px 16px 48px}.fsv .vw,.fsv .pn{border:0;border-radius:0;background:#050505}.fsv .vwt{border-bottom:0}.fsv .tb td,.fsv .tb th{border-bottom:0}}
.ddr{display:flex;gap:10px;flex-wrap:wrap}.ddr .dd{flex:1;min-width:200px;max-width:none}.stk,.stkpad{display:none}
.bar{height:3px;background:#1a1a1a;overflow:hidden;border-radius:3px}.bar:after{content:"";display:block;height:100%;width:40%;background:var(--ac);animation:ld 1s ease-in-out infinite}@keyframes ld{from{margin-left:-40%}to{margin-left:100%}}
.ck{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #151815}
@media(max-width:900px){.stk{display:flex;gap:8px;position:fixed;left:0;right:0;bottom:calc(58px + env(safe-area-inset-bottom));z-index:35;background:#000;border-top:1px solid var(--bd);padding:10px 14px}.stk .btn{flex:1}.stkpad{display:block;height:64px}}
.gx{position:relative;border-radius:20px;overflow:hidden;border:1px solid var(--bd);background-color:#000}
.gx:before,.gx:after{content:"";position:absolute;z-index:3;width:18px;height:18px;border:2px solid var(--ac);opacity:.7;pointer-events:none}
.gx:before{top:8px;left:8px;border-right:0;border-bottom:0;border-top-left-radius:8px}.gx:after{bottom:8px;right:8px;border-left:0;border-top:0;border-bottom-right-radius:8px}
.gwrap{overflow-x:auto}.gsvg{display:block;width:100%;min-width:700px;height:auto}
.ghud{position:absolute;z-index:2;font-size:10px;letter-spacing:.1em;pointer-events:none}
.live{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ac);box-shadow:0 0 8px var(--ac);animation:blink 1.4s ease-in-out infinite;margin-right:6px}@keyframes blink{50%{opacity:.25}}
.gn{cursor:pointer;transition:opacity .25s}.gn:focus{outline:none}.gn:focus-visible .gsh{stroke-width:3.5}.gn .gsh{transition:.2s}.gn:hover .gsh{filter:url(#gglow)}
.ge{cursor:pointer;transition:opacity .25s}.gdim{opacity:.13}
.gflow{stroke-dasharray:2 16;stroke-linecap:round;animation:gfl 1.6s linear infinite}@keyframes gfl{to{stroke-dashoffset:-36}}
.gsweep{transform-origin:420px 290px;animation:rot 16s linear infinite}
.gring{animation:grn 40s linear infinite}@keyframes grn{to{stroke-dashoffset:-400}}
.gpulse{transform-box:fill-box;transform-origin:center;animation:gpl 2.4s ease-out infinite}@keyframes gpl{from{opacity:.75;transform:scale(.8)}to{opacity:0;transform:scale(1.9)}}
@keyframes rot{to{transform:rotate(360deg)}}
.orc{position:relative;overflow:hidden;border-radius:26px;border:1px solid rgba(163,230,53,.42);background:#000;padding:22px 20px 18px;isolation:isolate;margin-bottom:16px}
.orc>*{position:relative;z-index:2}.orc>.obg{position:absolute;z-index:0;pointer-events:none}.orc>.ohud{position:absolute;z-index:3;font-size:10px;letter-spacing:.12em;color:var(--mu)}
.o-aur{inset:-10%;background:radial-gradient(40% 50% at 20% 25%,rgba(163,230,53,.24),transparent 70%),radial-gradient(45% 55% at 82% 30%,rgba(16,185,129,.22),transparent 70%),radial-gradient(40% 50% at 55% 95%,rgba(124,58,237,.18),transparent 70%);filter:blur(10px);animation:aur 14s ease-in-out infinite alternate}@keyframes aur{to{transform:translate3d(-3%,3%,0) scale(1.08)}}
.o-stars{inset:0;background-image:radial-gradient(1px 1px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 78% 12%,#cfe8b8,transparent),radial-gradient(1.6px 1.6px at 33% 72%,#a3e635,transparent),radial-gradient(1px 1px at 90% 66%,#fff,transparent),radial-gradient(1px 1px at 55% 40%,#a7f3d0,transparent),radial-gradient(1px 1px at 8% 84%,#fff,transparent),radial-gradient(1.6px 1.6px at 66% 82%,#fff,transparent),radial-gradient(1px 1px at 44% 8%,#fff,transparent),radial-gradient(1px 1px at 95% 30%,#fff,transparent),radial-gradient(1px 1px at 22% 50%,#fff,transparent);opacity:.75;animation:tw 5s ease-in-out infinite alternate}@keyframes tw{to{opacity:.25}}
.o-floor{left:-40%;right:-40%;bottom:-32%;height:75%;background-image:linear-gradient(rgba(163,230,53,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.3) 1px,transparent 1px);background-size:46px 46px;transform:perspective(420px) rotateX(64deg);transform-origin:50% 0;animation:flr 3s linear infinite;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 40%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 40%,transparent 100%)}@keyframes flr{to{background-position:0 46px}}
.o-scan{left:0;right:0;top:0;height:90px;background:linear-gradient(to bottom,transparent,rgba(163,230,53,.11),transparent);animation:scn 6s linear infinite}@keyframes scn{from{transform:translateY(-100px)}to{transform:translateY(620px)}}
.orb{display:block;width:min(300px,70vw);height:auto;margin:14px auto 0;overflow:visible}
.o-spin{transform-origin:200px 200px;animation:rot 30s linear infinite}.o-spin.r{animation-direction:reverse;animation-duration:44s}.orb.busy .o-spin{animation-duration:4s}.orb.busy .o-spin.r{animation-duration:6s}
.o-core{transform-origin:200px 200px;animation:cor 3.2s ease-in-out infinite}.orb.busy .o-core{animation-duration:.9s}@keyframes cor{50%{transform:scale(1.1)}}
.obeam{stroke:#a3e635;opacity:.07;transition:opacity .4s}.orb.busy .obeam{opacity:.6}
.ostat{text-align:center;font-size:11px;letter-spacing:.16em;color:var(--ac);min-height:18px;margin:8px 0 16px}
.cmd{padding:1.5px;border-radius:18px;background:linear-gradient(90deg,#a3e635,#10b981,#7c3aed,#a3e635);background-size:300% 100%;animation:cmdb 6s linear infinite;box-shadow:0 0 44px rgba(163,230,53,.14)}@keyframes cmdb{to{background-position:300% 0}}
.cmd-in{display:flex;align-items:center;gap:10px;background:#030503;border-radius:17px;padding:6px 6px 6px 16px}.cmd-in input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--tx);font:inherit;font-size:15px;padding:10px 0}
.sug{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.sug button{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:11px 12px;border-radius:14px;border:1px solid #23271f;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);transition:.15s;font-size:12.5px}.sug button:hover{border-color:var(--ac);background:rgba(163,230,53,.07);transform:translateY(-1px)}.sug button:disabled{opacity:.4;cursor:default;transform:none}.sug b{font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--ac);font-size:11px;padding-top:1px}
.ans{position:relative;border-radius:20px;border:1px solid var(--bd);background:#020302;overflow:hidden;margin-bottom:14px;animation:rise .4s ease-out}@keyframes rise{from{opacity:0;transform:translateY(10px)}}
.ans:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(to bottom,var(--ac),#10b981,transparent)}
.ahd{display:flex;align-items:center;gap:10px;padding:10px 16px 10px 20px;border-bottom:1px solid var(--bd);background-color:#050505}
.aans{font-size:16px;line-height:1.55;min-height:24px}.caret:after{content:"\\25CD";color:var(--ac);animation:blink 1s steps(2) infinite}
.stag{animation:rise .5s ease-out both}.cbar{display:flex;height:10px;border-radius:6px;overflow:hidden;gap:2px}.cbar div{min-width:6px}
@media(max-width:900px){.sug{grid-template-columns:1fr}}
/* ═════ ELEVATION LAYER — shared detail design: buttons, chips, panels, accordion, ledgers, banners, pipelines ═════ */
.btn{position:relative;overflow:hidden;background:linear-gradient(180deg,#0e100e,#000);border:1px solid #33372f;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);transition:transform .15s,border-color .15s,box-shadow .2s,background .2s}
.btn:hover{border-color:rgba(163,230,53,.55);background:linear-gradient(180deg,#121512,#050505);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 22px -6px rgba(163,230,53,.35);transform:translateY(-1px)}
.btn:active{transform:translateY(0) scale(.98)}
.btn.p{background:linear-gradient(180deg,#b9f54f,#84cc16);border-color:#bef264;color:#0a1400;box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 6px 24px -8px rgba(163,230,53,.55)}
.btn.p:hover{filter:none;background:linear-gradient(180deg,#c6f96a,#8fd61f);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 8px 30px -6px rgba(163,230,53,.7)}
.btn.w:hover{background:#f1f5ee}
.btn.p:before,.xv .vbtn:before{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);transition:left .6s;pointer-events:none}
.btn.p:hover:before,.xv .vbtn:hover:before{left:130%}
.btn:disabled,.btn:disabled:hover{opacity:.4;transform:none;box-shadow:none;filter:none}.btn:disabled:before{display:none}
.btn:focus-visible,.xv .vbtn:focus-visible,.xv .act:focus-visible,.sec-h:focus-visible,.rec:focus-visible,.mini:focus-visible,.ib:focus-visible,.tg:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.ib{background:linear-gradient(180deg,#0e100e,#000);transition:.15s}.ib:hover{border-color:var(--ac);box-shadow:0 0 18px -6px rgba(163,230,53,.5)}
.chip{background:rgba(255,255,255,.02);font-weight:500}
.chip.g{background:rgba(163,230,53,.07)}.chip.o{background:rgba(251,191,36,.07)}.chip.r{background:rgba(248,113,113,.08)}.chip.bl{background:rgba(96,165,250,.08)}.chip.pu{background:rgba(196,181,253,.08)}.chip.pk{background:rgba(240,171,252,.08)}
.kdot{width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor;display:inline-block}
.pn{box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
.pn h3:before{content:"";display:inline-block;width:3px;height:12px;border-radius:2px;background:var(--ac);margin-right:8px;vertical-align:-1px;box-shadow:0 0 10px var(--ac)}
.stat{position:relative;overflow:hidden;background:linear-gradient(180deg,#080a08,#000)}
.stat:after{content:"";position:absolute;left:22%;right:22%;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--ac),transparent);opacity:.55}
.stat b{font-size:22px;letter-spacing:-.02em}.stat span{text-transform:uppercase;letter-spacing:.09em;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px}
.tile{transition:.18s}.tile:hover{transform:translateY(-2px);box-shadow:0 10px 30px -14px var(--c)}
.rec{position:relative;overflow:hidden;padding-left:16px}
.rec:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--t,#2a2d2a);box-shadow:0 0 12px var(--t,transparent);opacity:.9}
.rec:hover{border-color:var(--t,var(--bh));transform:translateX(2px);background-color:#050605}
.mini{background-color:#040504;transition:.15s}.mini:hover{border-color:var(--ac);background-color:#070a05;transform:translateX(2px)}
.sys{border-left:3px solid #3b82f6;box-shadow:inset 0 0 40px rgba(59,130,246,.05)}
.tb th{font-family:'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;font-size:10px}.tb tbody tr{transition:.12s}.tb tbody tr:hover td{background:rgba(163,230,53,.04)}
.tg{width:42px;height:24px;transition:.2s}.tg:after{top:3px;left:3px}.tg.on{box-shadow:0 0 16px rgba(163,230,53,.45)}.tg.on:after{left:21px}
.chain:before{content:"";position:absolute;left:-3px;top:6px;bottom:6px;width:2px;background:linear-gradient(to bottom,var(--ac),#23271f 55%,transparent)}.chain{border-left:0}
.chain>div:first-child:before{animation:blink 1.8s ease-in-out infinite}.chain .xs.mu{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em}
.mod{backdrop-filter:blur(8px)}.mod>div{box-shadow:0 30px 90px #000,0 0 0 1px rgba(163,230,53,.12),inset 0 1px 0 rgba(163,230,53,.25);animation:pop2 .22s ease-out}@keyframes pop2{from{opacity:0;transform:translateY(14px) scale(.98)}}
.ddb .xs{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase;font-size:10px}
.top{backdrop-filter:blur(12px);background:rgba(0,0,0,.82)}
.nav-g{font-size:10px;letter-spacing:.16em;color:#4f564f;margin:18px 12px 6px}
.nav button{position:relative;transition:.15s}.nav button.on{background:linear-gradient(90deg,rgba(163,230,53,.12),transparent)}
.nav button.on:before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--ac);box-shadow:0 0 12px var(--ac)}
.hd0{position:relative;margin-bottom:22px;padding-bottom:16px}.hd0:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,var(--ac),rgba(163,230,53,.15) 30%,transparent)}
.hd0 h1{margin:0;font-size:28px;letter-spacing:-.025em;background:linear-gradient(90deg,#fff,#d9f2b8);-webkit-background-clip:text;background-clip:text;color:transparent}
.hexf{--t:#a3e635;width:56px;height:62px;flex:none;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(135deg,var(--t),#10b981)}
.hexf>div{width:52px;height:58px;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:#050805;color:var(--t)}
.hexf.sm{width:44px;height:49px}.hexf.sm>div{width:41px;height:46px}
.sec{--t:#a3e635;position:relative;margin-bottom:10px;border:1px solid var(--bd);border-radius:16px;background:linear-gradient(180deg,#060706,#030403);transition:border-color .2s,box-shadow .2s}
.sec:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:16px 0 0 16px;background:#23271f;transition:.25s}
.sec.open{border-color:#34392f;box-shadow:0 14px 40px -26px var(--t)}.sec.open:before{background:linear-gradient(to bottom,var(--t),transparent);box-shadow:0 0 14px var(--t)}
.sec.st-o{--t:#fbbf24}.sec.st-r{--t:#f87171}
.sec-h{display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px 13px 18px;background:none;border:0;border-radius:15px;text-align:left;font-size:14px}.sec-h:hover{background:rgba(255,255,255,.02)}
.sec-i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;border:1px solid var(--bd);background:#0a0a0a;color:var(--mu);transition:.2s;flex:none}
.sec.open .sec-i{color:var(--t);border-color:var(--t);box-shadow:0 0 14px -4px var(--t)}
.sec-x{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--bd);color:var(--mu);transition:.25s;flex:none}.sec.open .sec-x{transform:rotate(180deg);color:var(--t);border-color:var(--t)}
.sec-b{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .3s ease,visibility 0s linear .3s}.sec.open .sec-b{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .3s ease,visibility 0s}
.sec-b>div{overflow:hidden;min-height:0}.sec.ov .sec-b>div{overflow:visible}.sec-p{padding:2px 18px 18px}
.kvl{display:block}.kvr{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid #151815}.kvr:last-child{border-bottom:0}
.kvk{flex:none;max-width:46%;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}
.kvd{flex:1;min-width:12px;border-bottom:1px dotted #2a2d2a;transform:translateY(-3px)}.kvv{text-align:right;min-width:0;word-break:break-word;font-weight:500}
.bn{--t:#a3e635;position:relative;overflow:hidden;display:flex;gap:14px;align-items:center;padding:14px 16px 14px 18px;border-radius:16px;border:1px solid var(--bd);background-color:#030403;margin-bottom:12px}
.bn:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--t);box-shadow:0 0 14px var(--t)}
.bn-i{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:var(--t);border:1px solid var(--t);background:#000;flex:none;box-shadow:0 0 18px -4px var(--t)}
.xv .vbtn{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;border-radius:16px;border:1px solid #bef264;background:linear-gradient(180deg,#b9f54f,#84cc16);color:#0a1400;text-align:left;box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 12px 40px -12px rgba(163,230,53,.6);transition:.2s}
.xv .vbtn:hover{transform:translateY(-2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 18px 50px -12px rgba(163,230,53,.8)}
.vbtn-i{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(0,0,0,.88);color:var(--ac);flex:none}
.vbtn b{display:block;font-size:16px}.vbtn small{display:block;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.06em;opacity:.7}
.dock{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.act{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:14px;border:1px solid var(--bd);background:linear-gradient(180deg,#0a0c0a,#000);font-size:11.5px;font-weight:600;transition:.15s}
.act:hover{border-color:var(--ac);background:rgba(163,230,53,.05);transform:translateY(-2px);box-shadow:0 10px 24px -14px var(--ac)}.act svg{color:var(--ac)}.act .nb{position:absolute;top:6px;right:6px;padding:0 6px;font-size:10px}
.vd{--t:#a3e635;position:relative;overflow:hidden;display:flex;gap:18px;align-items:center;padding:20px 20px 20px 22px;border-radius:20px;border:1px solid var(--bd);background-color:#030403}
.vd-ring{position:relative;width:68px;height:68px;border-radius:50%;display:grid;place-items:center;color:var(--t);border:2px solid var(--t);background:#000;flex:none;box-shadow:0 0 30px -4px var(--t)}
.vd-ring:before{content:"";position:absolute;inset:-9px;border-radius:50%;border:1px dashed var(--t);opacity:.55;animation:rot 14s linear infinite}
.pbar{display:flex;gap:3px;margin-top:14px}.pbar i{flex:1;height:6px;border-radius:3px}
.pipe{display:block}.pst{--c:#4a4f4a;position:relative;display:flex;gap:12px;align-items:flex-start;padding:9px 0}
.pst:not(:last-child):after{content:"";position:absolute;left:13px;top:38px;bottom:-6px;width:2px;background:linear-gradient(var(--c),#23271f)}
.pst-i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--c);color:var(--c);background:#000;flex:none;box-shadow:0 0 14px -2px var(--c)}
.spin{display:inline-block;width:14px;height:14px;border:2px solid #2a2d2a;border-top-color:var(--ac);border-radius:50%;animation:rot .7s linear infinite}
.stl{display:flex;gap:12px;align-items:flex-start;padding:9px 12px;margin-bottom:6px;border-radius:12px;border:1px solid var(--bd);border-left:3px solid var(--t);background:#000}
.lad{display:flex;align-items:center;margin-bottom:16px;overflow-x:auto;padding-bottom:4px}
.lad-n{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:11px;padding:4px 10px 4px 5px;border-radius:99px;border:1px solid rgba(163,230,53,.35);background:rgba(163,230,53,.06);color:var(--ac)}
.lad-n b{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--ac);color:#0a1400;font-size:10px}.lad-l{flex:1;min-width:14px;height:2px;background:linear-gradient(90deg,rgba(163,230,53,.6),rgba(163,230,53,.15))}
.feed-i{position:relative;display:flex;gap:14px;padding-bottom:18px}.feed-i:not(:last-child):after{content:"";position:absolute;left:19px;top:44px;bottom:0;width:2px;background:linear-gradient(#33372f,transparent)}
.feed-n{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;border:1px solid var(--bd);background:#050505;color:var(--ac);flex:none;box-shadow:0 0 18px -8px var(--ac)}
.setr{display:flex;align-items:center;gap:12px;padding:13px 8px;border-bottom:1px solid var(--bd);border-radius:10px;transition:.15s}.setr:hover{background:rgba(255,255,255,.02)}
.vw{position:relative}.vwt{background:linear-gradient(180deg,#0b0d0b,#060706);font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:.02em}
.vdots{display:flex;gap:5px}.vdots i{width:8px;height:8px;border-radius:50%;background:#2a2d2a}.vdots i:first-child{background:#f87171}.vdots i:nth-child(2){background:#fbbf24}.vdots i:nth-child(3){background:var(--ac)}
.vwf{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;padding:9px 14px;border-top:1px solid var(--bd);font-size:10px;letter-spacing:.1em;color:var(--mu);background:#050605}
@media(max-width:900px){.dock{grid-template-columns:repeat(3,minmax(0,1fr))}.vd{flex-direction:column;align-items:flex-start}}
@media(prefers-reduced-motion:reduce){.bar:after{animation:none}.hex,.wire:after,.sheet{animation:none}.gflow,.gsweep,.gring,.gpulse,.o-aur,.o-stars,.o-floor,.o-scan,.o-spin,.o-core,.cmd,.live,.ans,.stag,.vd-ring:before,.spin,.chain>div:first-child:before,.mod>div{animation:none}.btn,.act,.rec,.mini{transition:none}}
/* ═════ ACCENT REFINEMENT — replaces the full-height curved left bars with
   (1) a short inset tick centred on the row/header, and
   (2) a thin top hairline for banners and answer cards ═════ */
.sec:before{left:0;top:18px;bottom:auto;width:2px;height:20px;border-radius:0 2px 2px 0;background:#2a2d2a;box-shadow:none;transition:background .25s,box-shadow .25s}
.sec.open:before{background:var(--t);box-shadow:0 0 8px var(--t)}
.rec{padding-left:18px}
.rec:before{left:0;top:50%;bottom:auto;width:2px;height:18px;transform:translateY(-50%);border-radius:0 2px 2px 0;background:var(--t,#2a2d2a);box-shadow:0 0 6px var(--t,transparent);opacity:.85}
.bn{padding-left:16px}
.bn:before{left:18px;right:18px;top:0;bottom:auto;width:auto;height:1px;background:linear-gradient(90deg,transparent,var(--t),transparent);box-shadow:none}
.ans:before{left:18px;right:18px;top:0;bottom:auto;width:auto;height:1px;background:linear-gradient(90deg,transparent,var(--ac),transparent)}
.sys{position:relative;border-left:1px solid #1f3552;box-shadow:inset 0 0 40px rgba(59,130,246,.04)}
.sys:before{content:"";position:absolute;left:-1px;top:50%;width:2px;height:16px;transform:translateY(-50%);border-radius:0 2px 2px 0;background:#3b82f6;opacity:.8}
.stl{position:relative;border-left:1px solid var(--bd)}
.stl:before{content:"";position:absolute;left:-1px;top:50%;width:2px;height:14px;transform:translateY(-50%);border-radius:0 2px 2px 0;background:var(--t)}
.nav button.on:before{top:50%;bottom:auto;width:2px;height:16px;transform:translateY(-50%);box-shadow:0 0 8px var(--ac)}
/* ═════ DRAGGABLE GRAPH CANVAS ═════ */
.gpan{overflow:hidden;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.gpan.drag{cursor:grabbing}.gpan.drag .gn,.gpan.drag .ge{cursor:grabbing}
.gpan .gsvg{min-width:0}
.gtools{position:absolute;z-index:4;right:22px;bottom:14px;display:flex;gap:8px}
/* ═════ WIDTH CONTAINMENT — a wide child (map, table) must scroll inside its own box, never widen the page ═════ */
.xs-shell>div,.main,.main>*{min-width:0;max-width:100%}
.xs-shell{overflow-x:clip}
.gx,.gwrap,.vw,.pn{max-width:100%}
.gwrap{-webkit-overflow-scrolling:touch}
.kvv{overflow-wrap:anywhere}
/* ═════ PROFILE IDENTITY BLOCK ═════ */
.pid{margin-top:14px;display:flex;flex-direction:column;gap:10px}
.pname{margin:0;font-size:24px;line-height:1.15;letter-spacing:-.02em}
.phandle{color:var(--mu);font-size:14px;margin-top:-6px}
.ptags{display:flex;flex-wrap:wrap;gap:6px}
.pbio{margin:2px 0 0;font-size:15px;line-height:1.55;max-width:62ch}
.pmeta{display:flex;flex-wrap:wrap;gap:8px}
.pm{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--bd);background:linear-gradient(180deg,#0a0c0a,#000);color:var(--mu);font-size:12.5px}.pm svg{color:var(--ac)}
.pstats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:2px}
.psb{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;border:1px solid var(--bd);background:linear-gradient(180deg,#0a0c0a,#000);text-align:left;transition:.15s}
.psb:hover{border-color:var(--ac);transform:translateY(-1px);box-shadow:0 10px 24px -14px var(--ac)}
.psb>span:nth-child(2){flex:1;min-width:0}.psb b{display:block;font-size:20px;line-height:1.1;letter-spacing:-.02em}.psb small{color:var(--mu);font-size:12px}
.psi{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;border:1px solid var(--bd);background:#0a0a0a;color:var(--ac);flex:none}
@media(max-width:520px){.pname{font-size:21px}.pstats{gap:8px}.psb{padding:10px 12px}}

/* ═════ PEOPLE STACK — one slim row per card: faces | divider | count + label + names | arrow.
   Faces build in size and brightness toward the last, which sits on top, fully lit.
   Hover or focus fans the stack open, slides the arrow forward and sweeps a light across the card. ═════ */
.pk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:2px;min-width:0}
.pk>*{min-width:0}
.pkc{min-height:56px}
@media(max-width:560px){.pk{grid-template-columns:minmax(0,1fr)}}
.pkc{position:relative;overflow:hidden;display:flex;align-items:center;gap:0;width:100%;min-width:0;padding:10px 10px 10px 12px;border-radius:18px;border:1px solid var(--bd);background:radial-gradient(120% 160% at 100% 0%,rgba(163,230,53,.08),transparent 60%),linear-gradient(180deg,#0a0c0a,#000);text-align:left;transition:transform .2s,border-color .2s,box-shadow .25s}
.pkc:before{content:"";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--ac),transparent);opacity:.5}
.pkc:after{content:"";position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(100deg,transparent,rgba(163,230,53,.10),transparent);transform:skewX(-20deg);transition:left .7s;pointer-events:none}
.pkc:hover,.pkc:focus-visible{border-color:rgba(163,230,53,.6);transform:translateY(-1px);box-shadow:0 14px 30px -18px var(--ac);outline:none}
.pkc:hover:after,.pkc:focus-visible:after{left:130%}
.pkc:active{transform:translateY(0) scale(.99)}
.pks{display:flex;align-items:center;flex:none;padding-right:2px}
.pkm{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;overflow:hidden;margin-left:14px;padding-left:14px;border-left:1px solid var(--bd);line-height:1}
.pkt{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:7px;row-gap:4px;min-width:0}
.pkc{container-type:inline-size}
.pkn{font-size:21px;font-weight:800;letter-spacing:-.03em}
.pkt small{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--mu)}
.pkw{font-style:normal;font-size:11px;color:#5f675f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pkgo{flex:none;margin-left:8px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:1px solid #33372f;background:#000;color:var(--ac);transition:transform .25s cubic-bezier(.2,.9,.3,1),background .2s,color .2s,border-color .2s,box-shadow .25s}
.pkc:hover .pkgo,.pkc:focus-visible .pkgo{transform:translateX(3px);background:var(--ac);color:#0a1400;border-color:var(--ac);box-shadow:0 0 18px -2px rgba(163,230,53,.7)}
.pka{--s:30px;--b:1;position:relative;flex:none;display:grid;place-items:center;width:var(--s);height:var(--s);margin-left:-11px;border-radius:50%;border:2px solid #060706;background:linear-gradient(135deg,var(--g1),var(--g2));color:#06100a;font-weight:800;font-size:calc(var(--s) * .4);filter:brightness(var(--b));transition:margin .32s cubic-bezier(.2,.9,.3,1),filter .3s,box-shadow .3s;animation:pkin .55s cubic-bezier(.2,.9,.3,1) both;animation-delay:calc(var(--i) * 70ms)}
.pka:first-child{margin-left:0}
.pka.lead{box-shadow:0 0 0 1px rgba(163,230,53,.75),0 8px 20px -8px rgba(163,230,53,.65)}
.pka.solo{margin-left:0;animation:none;filter:none}
.pkc:hover .pka,.pkc:focus-visible .pka{--b:1 !important;margin-left:-5px}
.pkc:hover .pka:first-child,.pkc:focus-visible .pka:first-child{margin-left:0}
.pkv{position:absolute;right:-6px;bottom:-5px;width:19px;height:19px;display:grid;place-items:center;z-index:2;pointer-events:none;filter:drop-shadow(0 0 0 #060706) drop-shadow(0 0 1.5px #060706) drop-shadow(0 0 7px rgba(163,230,53,.55));animation:pkpop .5s cubic-bezier(.2,1.4,.4,1) .45s both}
.pkv svg{display:block;fill:#a3e635;stroke:#041004}
@keyframes pkpop{from{opacity:0;transform:scale(.2) rotate(-40deg)}}
@keyframes pkin{from{opacity:0;transform:translateX(-12px) scale(.7)}}
.prow{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #151815}.prow:last-child{border-bottom:0}
@container (max-width:270px){.pka:nth-child(1){display:none}.pka:nth-child(2){margin-left:0}.pkw{display:none}.pkm{margin-left:10px;padding-left:10px}}
@container (max-width:200px){.pka:nth-child(2){display:none}.pka:nth-child(3){margin-left:0}.pkgo{width:24px;height:24px;margin-left:4px}}
@media(prefers-reduced-motion:reduce){.pka,.pkv{animation:none}.pkc,.pka,.pkgo{transition:none}.pkc:after{display:none}}

/* ═════ MOBILE PERFECTION PASS ═════ */
/* -- profile header: avatar + actions. Actions become round icon buttons on phones, full labelled buttons on PC -- */
.phd{margin-top:-52px;align-items:flex-end}
.pav{position:relative;z-index:2;width:108px;height:108px;font-size:44px;border:4px solid #030504;background:linear-gradient(135deg,#a3e635,#10b981);box-shadow:0 0 30px rgba(163,230,53,.3)}
.pact{padding-bottom:6px;flex-wrap:nowrap;justify-content:flex-end}
.pbt .lbl{display:inline}
.xh{flex-wrap:wrap}
.xh>.fl{flex:1 1 150px}
/* -- overview hero -- */
.ovh{gap:22px;padding:22px;flex-wrap:wrap}
.ovt{min-width:220px}
.ovn{margin:8px 0 2px;font-size:28px;line-height:1.15;letter-spacing:-.02em;overflow-wrap:anywhere}
.ovb{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
/* -- question cards: icon + arrow on top, label, then one tidy description -- */
.qg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media(min-width:901px){.qg{grid-template-columns:repeat(4,minmax(0,1fr))}}
.qc{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:stretch;gap:12px;min-height:118px;padding:14px;border-radius:16px;border:1px solid var(--bd);background:radial-gradient(120% 140% at 100% 0%,rgba(163,230,53,.07),transparent 60%),linear-gradient(180deg,#0a0c0a,#000);text-align:left;transition:transform .2s,border-color .2s,box-shadow .25s}
.qc:before{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--ac),transparent);opacity:.45}
.qc:hover,.qc:focus-visible{border-color:rgba(163,230,53,.6);transform:translateY(-2px);box-shadow:0 14px 30px -18px var(--ac);outline:none}
.qc:active{transform:translateY(0) scale(.99)}
.qc-t{display:flex;align-items:center;justify-content:space-between;gap:8px}
.qc .ico{width:36px;height:36px;border-radius:11px}
.qc-go{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1px solid #33372f;background:#000;color:var(--mu);transition:transform .25s cubic-bezier(.2,.9,.3,1),background .2s,color .2s,border-color .2s}
.qc:hover .qc-go,.qc:focus-visible .qc-go{transform:translateX(2px);background:var(--ac);color:#0a1400;border-color:var(--ac)}
.qc-b{display:flex;flex-direction:column;gap:5px;min-width:0}
.qc-q{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;font-weight:500;letter-spacing:.08em;color:var(--ac);line-height:1.3;overflow-wrap:anywhere}
.qc-d{font-size:13px;line-height:1.35;color:var(--tx);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* -- record rows: chips ride in their own group so they can drop under the title on phones -- */
.rr-c{display:flex;align-items:center;gap:6px;flex:none}
@media(max-width:700px){
  .pact{flex-wrap:nowrap;gap:6px}
  .phd{margin-top:-46px;gap:8px}
  .pav{width:92px;height:92px;font-size:38px}
  .pact .ib,.pbt{width:36px;height:36px;padding:0;border-radius:50%;flex:none}
  .pbt .lbl{display:none}
  .xh>.btn{flex:1 1 100%}
  .ovh{flex-direction:column;align-items:flex-start;gap:16px;padding:18px}
  .ovt{min-width:0;width:100%}
  .ovn{font-size:24px}
  .ovb{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .ovb .btn{width:100%;padding:10px 8px;white-space:nowrap}
  .ovb .dsk{display:none}
  .rr{display:grid;grid-template-columns:40px minmax(0,1fr);column-gap:12px;row-gap:8px;align-items:center}
  .rr>.ico,.rr>.av{grid-column:1;grid-row:1;justify-self:start}
  .rr>.fl{grid-column:2;grid-row:1}
  .rr>.rr-c{grid-column:2;grid-row:2;flex-wrap:wrap;justify-content:flex-start}
  .rr:hover{transform:none}
  .tile{padding:12px;gap:10px}.tile>span:last-child{min-width:0}
  .bn{flex-wrap:wrap}.bn>.btn{width:100%}
  .stl{flex-wrap:wrap;row-gap:4px}.stl>span:first-child{width:auto!important}.stl>.fl{flex:1 1 100%;order:3}.stl>.chip.mono{margin-left:auto}
  .rm .hd{flex-wrap:wrap}
  .ahd{flex-wrap:wrap}.ahd>.xs{flex-basis:100%}
  .hd0 h1{font-size:24px}.hd0 .row{flex-wrap:wrap}.hd0 .row>.fl{flex:1 1 180px}
}
@media(max-width:380px){.pav{width:80px;height:80px;font-size:34px}.phd{margin-top:-40px}.pact .ib,.pbt{width:32px;height:32px}.pact{gap:5px}}
/* ═════ PICKERS & FILTERS — popover on PC, bottom sheet on phones ═════ */
.dd.open{z-index:80}
.ddh{display:none}
.ddb{transition:border-color .15s,background .2s,box-shadow .2s}
.ddb.act{border-color:rgba(163,230,53,.55);background:linear-gradient(180deg,rgba(163,230,53,.08),#000)}
.ddb.act .b{color:var(--ac)}
.ddot{width:7px;height:7px;border-radius:50%;background:var(--ac);box-shadow:0 0 8px var(--ac);flex:none}
.ddc{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 8px currentColor}
.ddi{min-height:46px}
.ddi.on .b{color:var(--ac)}
.fsum{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:6px 6px 6px 14px;border:1px dashed #33372f;border-radius:12px;font-size:12.5px;color:var(--mu)}.fsum b{color:var(--tx)}
@media(max-width:700px){
  .ddr{flex-wrap:nowrap;gap:8px}
  .ddr .dd{flex:1 1 0;min-width:0;margin-bottom:12px}
  .ddb{padding:9px 12px;gap:8px}
  .ddx{z-index:1;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);animation:fade .2s}
  .ddm{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:2;display:flex;flex-direction:column;max-height:78vh;overflow:hidden;padding:10px 14px calc(18px + env(safe-area-inset-bottom));border:0;border-top:1px solid #3a3e3a;border-radius:24px 24px 0 0;animation:up .3s cubic-bezier(.2,.9,.3,1)}
  .ddh{display:block;margin-bottom:6px}
  .ddl{overflow:auto;min-height:0;padding-bottom:4px}
  .ddi{min-height:52px;padding:12px;border-radius:14px}
  .ddi.on{background:rgba(163,230,53,.08)}
  /* what-can-this-answer cards: one per row, icon | text | arrow */
  .qg{grid-template-columns:minmax(0,1fr);gap:8px}
  .qc{flex-direction:row;align-items:center;gap:12px;min-height:0;padding:12px 14px}
  .qc-t{display:contents}
  .qc .ico{order:0}
  .qc-b{order:1;flex:1}
  .qc-go{order:2}
  .qc-d{-webkit-line-clamp:2}
  /* source ladder wraps instead of scrolling sideways */
  .lad{flex-wrap:wrap;gap:6px;overflow:visible}
  .lad>span{flex:0 0 auto!important}.lad-l{display:none}
}
@media(max-width:480px){.prow .chip{display:none}}
/* ═════ FULL-SCREEN PROFILE — the profile card measures ITS OWN width, so the layout is right whether the screen is a phone,
   a laptop with three columns, or a wide monitor. Narrow card → round icon buttons, one-column people cards, 2×2 stats. ═════ */
.pfm{container-type:inline-size;container-name:prof}
.phd{position:relative;z-index:3}
.pact{gap:8px}
.pact .ib{width:38px;height:38px}
.pbt{height:38px;padding:0 16px;white-space:nowrap}
.main{margin:0 auto;width:100%}
@container prof (max-width:600px){
  .pact{gap:6px}
  .pact .ib,.pbt{width:36px;height:36px;padding:0;border-radius:50%;flex:none}
  .pbt .lbl{display:none}
  .pk{grid-template-columns:minmax(0,1fr)}
  .xg{grid-template-columns:repeat(2,minmax(0,1fr))}
  .xh>.btn{flex:1 1 100%}
}

/* ═════ PROFILE ACTION BUTTONS — ringed, larger icon buttons; XRD is a hexagon badge (the same hex used on the Banner and page headers) ═════ */
.pact{align-items:center;gap:8px}
.pact .ib,.pbt:not(.xrbtn){width:42px;height:42px;padding:0;border-radius:50%;border:1px solid #3a3f3a;background:radial-gradient(circle at 30% 18%,#181c18,#050605 70%);color:#d6dcd2;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 18px -12px #000;transition:transform .18s,border-color .18s,color .18s,box-shadow .2s}
.pact .ib:hover,.pbt:not(.xrbtn):hover{border-color:var(--ac);color:var(--ac);transform:translateY(-2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 22px -10px rgba(163,230,53,.55)}
.pact svg{width:18px;height:18px}
/* wide card: Edit / Follow keep their word, in a ringed pill */
.pbt:not(.xrbtn){width:auto;min-width:42px;padding:0 18px;border-radius:999px;flex:none}
.pbt.w:not(.xrbtn){background:#fff;color:#000;border-color:#fff}
.pbt.w:not(.xrbtn):hover{background:#f1f5ee;color:#000}
/* XRD: green pill with a dark hex badge on the left */
.xrw{display:inline-flex;flex:none}
.xrbtn{height:42px;padding:0 18px 0 5px;gap:9px}
.xrh{display:grid;place-items:center;width:32px;height:35px;flex:none;color:var(--ac);background:#041004;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);transition:background .2s,color .2s}
.xrbtn:hover .xrh{background:#0a1a02}
@container prof (max-width:600px){
  .pact{gap:7px}
  .pact .ib,.pbt:not(.xrbtn){width:40px;height:40px;min-width:0;padding:0;border-radius:50%}
  .pbt .lbl{display:none}
  /* XRD becomes a hexagon: green ring, dark centre, glowing */
  .xrw{filter:drop-shadow(0 0 9px rgba(163,230,53,.5))}
  .xrbtn{width:46px;height:50px;padding:0;gap:0;border:0;border-radius:0;box-shadow:none;background:linear-gradient(135deg,#d4ff7a,#a3e635 45%,#10b981);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);transition:filter .2s}
  .xrbtn:before{display:none}
  .xrbtn:hover{transform:none;background:linear-gradient(135deg,#d4ff7a,#a3e635 45%,#10b981);box-shadow:none;filter:brightness(1.1)}
  .xrbtn .xrh{width:40px;height:44px}
  .xrbtn:hover .xrh{background:var(--ac);color:#0a1400}
}
@container prof (max-width:400px){
  .pact{gap:5px}
  .pact .ib,.pbt:not(.xrbtn){width:36px;height:36px}
  .xrbtn{width:42px;height:46px}.xrbtn .xrh{width:36px;height:40px}
  .pav{width:80px;height:80px;font-size:34px}.phd{margin-top:-40px;gap:6px}
}
/* ═════ PROFILE IMAGE HUB — Xeevia photo + verification ring side by side; the button opens every photo across connected platforms ═════ */
.ovp{display:flex;align-items:center;gap:22px;flex:none}
.ovr{width:130px;height:130px;flex:none}.ovr svg{display:block}
.ova{position:relative;width:132px;height:132px;flex:none;border-radius:50%;display:grid;place-items:center;transition:transform .2s}
.ova-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 200deg,#a3e635,#10b981,#7c3aed,#a3e635);animation:rot 10s linear infinite;filter:drop-shadow(0 0 14px rgba(163,230,53,.45))}
.ova-in{position:relative;width:118px;height:118px;border-radius:50%;border:4px solid #030403;display:grid;place-items:center;font-weight:800;font-size:46px;color:#06100a;background:linear-gradient(135deg,#a3e635,#10b981)}
.ova-btn{position:absolute;right:-5px;bottom:-3px;z-index:2;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,#c6f96a,#84cc16);color:#0a1400;border:3px solid #030403;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 10px 24px -6px rgba(163,230,53,.8);transition:transform .2s cubic-bezier(.2,.9,.3,1)}
.ova-btn:before{content:"";position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(163,230,53,.6);animation:ovpulse 2.8s ease-out infinite;pointer-events:none}
@keyframes ovpulse{0%{transform:scale(.82);opacity:.9}100%{transform:scale(1.4);opacity:0}}
.ova-btn:hover,.ova-btn:focus-visible{transform:scale(1.1) rotate(-6deg);outline:none}
.ova-n{position:absolute;top:-8px;right:-8px;min-width:22px;height:22px;padding:0 6px;border-radius:99px;display:grid;place-items:center;background:#050805;border:2px solid var(--ac);color:var(--ac);font-size:11px;font-weight:800;line-height:1}
.ova-tip{position:absolute;right:calc(100% + 12px);top:50%;transform:translateY(-50%) translateX(6px);opacity:0;pointer-events:none;white-space:nowrap;padding:6px 13px;border-radius:999px;background:#0b0d0b;border:1px solid rgba(163,230,53,.45);font-size:12px;font-weight:700;color:var(--tx);transition:opacity .18s,transform .18s}
@media(hover:hover){.ova-btn:hover .ova-tip,.ova-btn:focus-visible .ova-tip{opacity:1;transform:translateY(-50%)}}
.ova.sm{width:96px;height:96px}.ova.sm .ova-in{width:84px;height:84px;font-size:34px}
.pim>div{max-width:680px}
.pim-main{display:flex;align-items:center;gap:18px;padding:18px;border-radius:20px;border:1px solid rgba(163,230,53,.4);background:radial-gradient(120% 140% at 0 0,rgba(163,230,53,.12),transparent 60%),#030403;margin:16px 0}
.pim-main .ovr{width:92px;height:92px}
.pim-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.pit{--c:#8a918a;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;padding:16px 8px 14px;border-radius:18px;border:1px solid var(--bd);background:linear-gradient(180deg,#0a0c0a,#030403);text-align:center;transition:transform .18s,border-color .18s,box-shadow .25s}
.pit:hover,.pit:focus-visible{transform:translateY(-3px);border-color:var(--c);box-shadow:0 16px 36px -22px var(--c);outline:none}
.pit-i{position:relative;width:86px;height:86px;border-radius:50%;padding:3px;background:conic-gradient(var(--c),rgba(0,0,0,0) 70%,var(--c));display:grid;place-items:center;margin-bottom:4px}
.pit-a{width:100%;height:100%;border-radius:50%;border:3px solid #030403;display:grid;place-items:center;font-weight:800;font-size:32px;color:#06100a;background:linear-gradient(135deg,var(--g1),var(--g2))}
.pit-b{position:absolute;right:-3px;bottom:-3px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#000;border:2px solid var(--c);color:var(--c)}
.pit.off .pit-a{filter:grayscale(1) brightness(.4)}.pit.off .pit-i{background:none;border:2px dashed #3a3e3a}
.pit b{max-width:100%;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pit small{max-width:100%;color:var(--mu);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pim-bar{display:flex;gap:4px;margin:18px 0 8px}.pim-bar i{flex:1;height:6px;border-radius:3px}
@media(max-width:560px){.pim-g{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.ovp{width:100%;justify-content:flex-start;gap:16px}.ova{width:112px;height:112px}.ova-in{width:100px;height:100px;font-size:40px}.ovr{width:108px;height:108px}.ova-btn{width:42px;height:42px}.pim-main{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.ova-ring,.ova-btn:before{animation:none}}

/* ═════ ORACLE (phone) — a full-screen chat that sits above the header and the bottom nav ═════ */
.orx{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;background:#000;animation:fade .2s}
.orx-h{flex:none;display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;border-bottom:1px solid var(--bd);background:rgba(0,0,0,.92);backdrop-filter:blur(14px)}
.orx-o{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#041004;background:radial-gradient(circle at 35% 30%,#ecfccb,#a3e635 42%,#10b981 85%);box-shadow:0 0 18px rgba(163,230,53,.55);animation:cor 3.2s ease-in-out infinite}.orx-o.busy{animation-duration:.9s}
.orx-mid{position:relative;flex:1;min-height:0}
.orx-b{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;scroll-behavior:smooth;padding:14px 14px 12px}
.orx-in{display:flex;flex-direction:column;gap:14px;width:100%;max-width:680px;margin:0 auto}
.orx-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;display:flex;align-items:center;justify-content:center;transition:opacity .5s}.orx-bg.dim{opacity:.38}
.orx-bg .o-aur,.orx-bg .o-stars{position:absolute}
.orx-bgc{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;max-width:420px;padding:0 24px 6%}
.orx-bg .orb{width:min(250px,62vw,34dvh);margin:0 0 8px}
.orx-bg h2{margin:0 0 6px;font-size:clamp(22px,6.4vw,28px);letter-spacing:-.025em;background:linear-gradient(90deg,#fff,#d9f2b8);-webkit-background-clip:text;background-clip:text;color:transparent}
.orx-bg p{margin:0;color:var(--mu);font-size:13.5px;line-height:1.55}
.orx-st{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;margin-top:14px;font-size:10px;letter-spacing:.14em;color:#5a615a}
.orx-pm{position:absolute;top:10px;right:12px;z-index:3;display:flex;align-items:center;gap:8px}.orx-pm .seg button{padding:4px 11px;font-size:11px}
@media(max-height:640px){.orx-bg p,.orx-st{display:none}.orx-bg .orb{width:min(190px,48vw,30dvh)}}
.orx-tk{display:flex;align-items:center;gap:6px;min-width:0;height:16px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.08em;color:var(--mu)}
.orx-tkv{display:flex;flex:1;min-width:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
.orx-tki{display:flex;flex:none;white-space:nowrap;animation:orxtick 26s linear infinite}.orx-tki>span{display:inline-flex;margin-right:10px}.orx-tki i{font-style:normal;margin-left:10px;opacity:.45}
@keyframes orxtick{to{transform:translateX(-100%)}}.orx-tkv:active .orx-tki{animation-play-state:paused}
@media(prefers-reduced-motion:reduce){.orx-tki{animation:none}.orx-tkv{overflow-x:auto}}
.orx-qs{display:flex;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:2px 12px 12px;margin:0 -12px;-webkit-overflow-scrolling:touch}
.orx-sc{position:relative;flex:none;scroll-snap-align:start;width:min(236px,72vw);display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:18px;border:1px solid #23271f;background:linear-gradient(180deg,#0b0d0b,#040504);text-align:left;overflow:hidden;transition:border-color .15s,background .15s,transform .15s}
.orx-sc:before{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--ac),transparent);opacity:.45}
.orx-sc .t{display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.12em;color:var(--ac)}
.orx-sc .ic{width:26px;height:26px;border-radius:8px;border:1px solid rgba(163,230,53,.4);background:rgba(163,230,53,.07);display:grid;place-items:center}
.orx-sc p{margin:0;font-size:13px;line-height:1.38;color:#e4e8e1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.orx-sc .go{position:absolute;right:12px;top:15px;color:#4f564f}
.orx-sc:active{border-color:var(--ac);background:rgba(163,230,53,.07);transform:scale(.985)}.orx-sc:disabled{opacity:.5}

.orx-hero{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:2px}.orx-hero .orb{width:min(160px,42vw);margin:0}
.orx-s{display:flex;align-items:flex-start;gap:12px;width:100%;padding:13px 14px;border-radius:16px;border:1px solid #23271f;background:linear-gradient(180deg,#0a0c0a,#030403);text-align:left;font-size:14px;transition:.15s}.orx-s:active{background:rgba(163,230,53,.08);border-color:var(--ac)}.orx-s b{font-family:'JetBrains Mono',ui-monospace,monospace;color:var(--ac);font-size:11px;padding-top:2px}
.orx-u{align-self:flex-end;max-width:84%;padding:10px 14px;border-radius:18px 18px 4px 18px;background:linear-gradient(180deg,#b9f54f,#84cc16);color:#0a1400;font-weight:600;overflow-wrap:anywhere;animation:rise .25s ease-out}
.orx-m{display:flex;gap:10px;align-items:flex-start;animation:rise .3s ease-out}.orx-m .ans{flex:1;min-width:0;margin:0;border-radius:6px 20px 20px 20px}
.orx-th{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:6px 18px 18px 18px;border:1px solid var(--bd);background:#050605;font-size:11px;letter-spacing:.12em;color:var(--ac)}
.dots i{display:inline-block;width:5px;height:5px;margin-left:3px;border-radius:50%;background:var(--ac);animation:blink 1s infinite}.dots i:nth-child(2){animation-delay:.2s}.dots i:nth-child(3){animation-delay:.4s}
.orx-f{flex:none;padding:8px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--bd);background:rgba(0,0,0,.94);backdrop-filter:blur(14px)}
.orx-q{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px}.orx-q button{flex:none;max-width:78vw;padding:8px 14px;border-radius:999px;border:1px solid #2b2f2b;font-size:12.5px;color:#cfd6cb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.orx .cmd-in input{font-size:16px}

/* ═════ PROFILE: owner vs visitor ═════ */
.pmode{display:none;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;border-bottom:1px solid var(--bd);background:#050605}.pmode .seg button{padding:4px 12px;font-size:11.5px}
@media(max-width:900px){.pmode{display:flex}}
.ban-ed{position:absolute;top:14px;left:14px;z-index:3;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 13px;border-radius:999px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);font-size:12px;font-weight:700;transition:.15s}.ban-ed:hover{border-color:var(--ac);color:var(--ac)}
.pact .ib.on{color:var(--ac);border-color:var(--ac);box-shadow:0 0 16px -4px var(--ac)}
.pstr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:14px;border:1px dashed #33372f;font-size:12.5px;text-align:left;transition:border-color .15s}.pstr:hover{border-color:var(--ac)}
.pstr-b{flex:1;min-width:90px;height:6px;border-radius:3px;background:#1a1d1a;overflow:hidden}.pstr-b i{display:block;height:100%;background:var(--ac);box-shadow:0 0 10px var(--ac)}
.pmut{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--mu)}.pmut b{color:var(--tx);font-weight:600}.pmut-f{display:flex;flex:none}
.pmut-a{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;color:#06100a;border:2px solid #030504;margin-left:-8px}.pmut-a:first-child{margin-left:0}
.sheet.pmenu{max-width:520px;margin:0 auto}.pmi{display:flex;align-items:center;gap:14px;width:100%;padding:15px 8px;border-bottom:1px solid #151815;font-weight:600;font-size:15px;text-align:left}.pmi:last-child{border-bottom:0}.pmi:hover{background:rgba(255,255,255,.03)}

/* ═════ NO SCROLLBARS — scrolling stays smooth, the bars stay hidden ═════ */
html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}
.xv,.xv *{scrollbar-width:none;-ms-overflow-style:none}.xv *::-webkit-scrollbar{display:none;width:0;height:0}
.xv .gwrap,.xv .lad,.xv .sheet,.xv .ddl,.xv .ddm,.xv .mod>div{-webkit-overflow-scrolling:touch}
`;

/* ═════════ FILE: src/data/xrdData.js ═════════ */
const ME = { name: "Emmanuel Ali Sunday", handle: "emmanuel", tag: "Founder • Builder • Creator", bio: "Founder & CEO of Sproutlight-Group. Building Xeevia & Infinite Sprouts — one identity across every network, with proof behind it." };
/* People shown in the stacked cards. rel = relevance score (shared work, verified relationship, mutuals, recent interaction).
   The stack shows the top few by rel; the most relevant person ends up last, on top, fully lit. */
const PEOPLE = {
  following: { label: "Following", icon: Users, total: 12, list: [
    { id: "f1", n: "Amina Bello", why: "Collaborator on Xeevia", mut: 6, v: 1, rel: 98, g: ["#a3e635", "#10b981"] },
    { id: "f2", n: "Kemi A.", why: "Engineer on Xeevia", mut: 5, v: 1, rel: 94, g: ["#60a5fa", "#a78bfa"] },
    { id: "f3", n: "Godwin Jacob", why: "Replies to you most", mut: 9, v: 0, rel: 88, g: ["#fb923c", "#f43f5e"] },
    { id: "f4", n: "Lukas Isaac", why: "Abuja Builders Meetup", mut: 4, v: 0, rel: 81, g: ["#2dd4bf", "#3b82f6"] },
    { id: "f5", n: "Donrik Vibez", why: "Creator in Discovery", mut: 3, v: 0, rel: 74, g: ["#f0abfc", "#fb7185"] },
    { id: "f6", n: "Sylvester Junior", why: "Mutual connection", mut: 7, v: 0, rel: 66, g: ["#fde047", "#fb923c"] },
    { id: "f7", n: "Cassandra Nwogu", why: "Federal University alumna", mut: 2, v: 1, rel: 61, g: ["#a3e635", "#2dd4bf"] },
    { id: "f8", n: "Devine Nka", why: "Mutual connection", mut: 3, v: 0, rel: 55, g: ["#c4b5fd", "#60a5fa"] },
  ] },
  followers: { label: "Followers", icon: UserPlus, total: 7, list: [
    { id: "w1", n: "John Doe", why: "Project Administrator · Xeevia", mut: 4, v: 1, rel: 96, g: ["#fbbf24", "#fb923c"] },
    { id: "w2", n: "Grace Okafor", why: "HR · Sproutlight-Group", mut: 3, v: 1, rel: 91, g: ["#f0abfc", "#a78bfa"] },
    { id: "w3", n: "Mikeson Smith", why: "Top streamer · 10 streams", mut: 5, v: 0, rel: 85, g: ["#60a5fa", "#2dd4bf"] },
    { id: "w4", n: "Evreni Merak", why: "Likes and reposts your posts", mut: 2, v: 0, rel: 78, g: ["#a3e635", "#10b981"] },
    { id: "w5", n: "Mintern", why: "Joined from Discovery", mut: 1, v: 0, rel: 70, g: ["#fb7185", "#f43f5e"] },
    { id: "w6", n: "Interesting Things", why: "Community account", mut: 0, v: 0, rel: 62, g: ["#fde047", "#a3e635"] },
    { id: "w7", n: "Cassandra Nwogu", why: "Federal University alumna", mut: 2, v: 1, rel: 58, g: ["#2dd4bf", "#60a5fa"] },
  ] },
};
const VIS = ["PUBLIC", "CONNECTIONS ONLY", "VERIFIERS ONLY", "PRIVATE", "CUSTOM"];
const ST = {
  VERIFIED: { c: "g", I: ShieldCheck, l: "Verified against registered source", m: "The record currently matches the recognised source." },
  "SELF-ASSERTED": { c: "", I: User, l: "Self-asserted · not independently verified", m: "This record comes from the owner and no independent source has confirmed it." },
  PENDING: { c: "bl", I: Clock, l: "Verification pending", m: "Verification has been requested or has not finished." },
  "SOURCE UNAVAILABLE": { c: "o", I: WifiOff, l: "Source could not be reached", m: "The source did not respond. The last known result is kept until it can be checked again." },
  MISMATCH: { c: "r", I: AlertTriangle, l: "Does not match the registered source", m: "The source returned information that differs from this record." },
  REVOKED: { c: "r", I: Ban, l: "Revoked by the issuer", m: "The issuer has withdrawn this record. History is preserved." },
  EXPIRED: { c: "o", I: Hourglass, l: "Validity period has ended", m: "The record was valid but has passed its validity period." },
  DISPUTED: { c: "o", I: MessageSquareQuote, l: "Challenged by a relevant party", m: "An authorised party has challenged the claim. Both sides and the evidence are shown." },
  SUPERSEDED: { c: "", I: Layers, l: "Replaced by a newer record", m: "A newer record has replaced this one. It stays visible for history." },
};
const HEX = { g: "#a3e635", o: "#fbbf24", r: "#f87171", bl: "#60a5fa", pu: "#c4b5fd", pk: "#f0abfc", "": "#8a918a" };
const St = ({ s, full }) => { const x = ST[s]; return <span className={`chip ${x.c}`}><x.I size={11} />{full ? x.l : s}</span>; };
const AUTHR = { Projects: ["Verified Project Administrator", "Project Administrator"], Academia: ["Verified University Administrator", "Registrar"], Employment: ["Verified Employer Representative", "HR representative"], Credentials: ["Verified Certification Issuer", "Issuer"], Communities: ["Verified Community Administrator", "Community Administrator"], Achievements: ["Xeevia System Record", "Platform"], Creator: ["Xeevia System Record", "Platform"], Identity: ["Xeevia System Record", "Platform"] };
const ATT = { Academia: "Institution registrar", Employment: "Employer HR representative", Projects: "Project administrator", Credentials: "Issuing authority", Communities: "Community administrator", Achievements: "Xeevia", Creator: "Xeevia", Identity: "Xeevia identity service" };
const RAW = [
  ["r1", "Projects", FolderGit2, "Xeevia", "Founder · 2025–Present", "PUBLIC", "DISPUTED", "GitHub", "2025", "Xeevia Labs", "Emmanuel founded and led the Xeevia platform.", "Claim contested by a project administrator"],
  ["r2", "Employment", Briefcase, "Sproutlight-Group", "CEO · 2024–Present", "PUBLIC", "VERIFIED", "LinkedIn", "2024", "Sproutlight-Group HR", "Emmanuel has been CEO of Sproutlight-Group since 2024.", "Role confirmed by HR representative"],
  ["r3", "Academia", GraduationCap, "B.Sc. Computer Science", "Federal University · 2024", "PUBLIC", "VERIFIED", "University registry", "2024", "Federal University", "Emmanuel was awarded a B.Sc. in Computer Science in 2024.", "Degree status confirmed by registry"],
  ["r4", "Academia", ScrollText, "Full Transcript", "Federal University", "PRIVATE", "VERIFIED", "University registry", "2024", "Federal University", "Official transcript with CGPA 4.52 / 5.00.", "Transcript retrieved from registry"],
  ["r5", "Credentials", Award, "Cloud Practitioner", "Issuer-verified · 2025", "PUBLIC", "EXPIRED", "Certifier", "2025", "Cloud Certifier", "Holds the Cloud Practitioner certification, valid to June 2026.", "Validity ended Jun 30, 2026"],
  ["r6", "Employment", FileText, "Employment contract", "Sproutlight-Group", "PRIVATE", "PENDING", "Employer HR", "2024", "Sproutlight-Group HR", "A signed employment contract is on file.", "Verification requested from HR"],
  ["r7", "Identity", Fingerprint, "Personal identity document", "Restricted evidence", "VERIFIERS ONLY", "VERIFIED", "Xeevia", "2026", "Xeevia identity service", "A government-issued identity document is bound to this profile.", "Document checked by Xeevia"],
  ["r8", "Achievements", Award, "Top Creator — Discovery", "Xeevia activity · 2026", "PUBLIC", "VERIFIED", "Xeevia", "2026", "Xeevia", "Ranked among top creators in the Discovery feed.", "Ranking logged by the platform"],
  ["r9", "Communities", Users, "Infinite Sprouts Community", "Founder & admin", "PUBLIC", "VERIFIED", "Xeevia", "2026", "Xeevia", "Founder and administrator of Infinite Sprouts.", "Admin role confirmed by the platform"],
  ["r10", "Creator", Radio, "Live streams (4)", "Creator evidence", "CONNECTIONS ONLY", "VERIFIED", "Xeevia", "2026", "Xeevia", "Hosted four live streams with 118–301 peak viewers.", "Session logs captured"],
  ["r11", "Projects", GitBranch, "Open-source contributions", "47 repositories · GitHub", "PUBLIC", "VERIFIED", "GitHub", "2026", "GitHub", "Authored commits and pull requests across 47 repositories.", "Synchronized from GitHub 2 minutes ago"],
  ["r12", "Credentials", Award, "Cloud Security Fundamentals", "Issuer-verified · 2025", "PUBLIC", "REVOKED", "Certifier", "2025", "Cloud Certifier", "Holds the Cloud Security Fundamentals certificate.", "Revoked by the issuer on Aug 22, 2026"],
  ["r13", "Academia", GraduationCap, "M.Sc. Data Science", "Claimed · Northbridge University", "PUBLIC", "MISMATCH", "University registry", "2025", "Northbridge University", "Emmanuel holds an M.Sc. in Data Science.", "Registry returned a different award"],
  ["r14", "Achievements", Award, "Hackathon Winner 2025", "Self-reported", "PUBLIC", "SELF-ASSERTED", "Xeevia", "2025", "Emmanuel (self)", "Won first place at the 2025 Abuja Hackathon.", "Added by the owner; no issuer attached"],
  ["r15", "Employment", Briefcase, "Product Lead, Nova Labs", "2022–2023", "PUBLIC", "SOURCE UNAVAILABLE", "LinkedIn", "2023", "Nova Labs", "Emmanuel was Product Lead at Nova Labs, 2022–2023.", "Latest check could not reach the source"],
  ["r16", "Projects", FolderGit2, "Xeevia Beta (v0.9)", "Early build · 2025", "PUBLIC", "SUPERSEDED", "GitHub", "2025", "Xeevia Labs", "Early public beta of Xeevia.", "Replaced by Xeevia (r1)"],
  ["r17", "Credentials", Award, "Python Professional", "Issuer-verified · 2024", "PUBLIC", "VERIFIED", "Certifier", "2024", "Python Institute", "Holds the Python Professional certification.", "Issuer signature validated"],
  ["r18", "Communities", Users, "Abuja Builders Meetup", "Organizer", "PUBLIC", "PENDING", "Xeevia", "2026", "Meetup organizers", "Organizer of the Abuja Builders Meetup.", "Awaiting organizer confirmation"],
];
const VDATE = { VERIFIED: "Oct 02, 2026", DISPUTED: "Sep 18, 2026", EXPIRED: "Aug 11, 2026", REVOKED: "Aug 22, 2026", MISMATCH: "Oct 03, 2026", "SOURCE UNAVAILABLE": "Aug 11, 2026", SUPERSEDED: "Sep 01, 2026" };
const R0 = RAW.map(([id, k, ic, t, s, v, st, src, d, iss, claim, note]) => ({ id, k, ic, t, s, v, st, ok: st === "VERIFIED", src, d, iss, claim, sub: claim, ver: VDATE[st] || null, hist: [[VDATE[st] || "Today", note], [d, "Record created from " + src]] }));
const EV = [
  { id: "e1", t: "xeevia/core repository", f: "github.com/xeevia/core", src: "GitHub", rec: "r1", acc: "PUBLIC", d: "Sep 14, 2026", by: "GitHub API", b: [{ k: "stats", v: [["1,284", "Commits"], ["4", "Contributors"], ["61%", "Owner commits"]] }, { k: "bar", v: [["Emmanuel", 61, "#a3e635"], ["Amina B.", 19, "#60a5fa"], ["Kemi A.", 12, "#a78bfa"], ["Others", 8, "#6b726a"]] }, { k: "table", h: ["Commit", "Author", "Message"], r: [["a91f3c2", "Emmanuel", "Add identity consolidation module"], ["7be20d4", "Amina B.", "Wire Discovery feed ranking"], ["c0d81ea", "Emmanuel", "Initial public build"], ["3f6a9b1", "Kemi A.", "Harden auth sessions"]] }] },
  { id: "e2", t: "Project documentation", f: "Xeevia-Product-Overview-v2.3.pdf", src: "GitHub", rec: "r1", acc: "PUBLIC", d: "Aug 30, 2026", by: "Repository docs", b: [{ k: "doc", t: "Xeevia — Product Overview", p: ["Xeevia is a mobile social platform that consolidates a person's digital identity across X, Facebook, Instagram and LinkedIn, and distributes content to all of them.", "The Discovery feed ranks creators by verified activity. XRD attaches evidence to each claim a person makes about themselves."] }, { k: "kv", v: [["Author", "Emmanuel Ali Sunday"], ["Version", "2.3"], ["Last edited", "August 2026"]] }] },
  { id: "e3", t: "Team record", f: "xeevia-team.json", src: "Xeevia", rec: "r1", acc: "PUBLIC", d: "Sep 02, 2026", by: "Xeevia platform", b: [{ k: "table", h: ["Member", "Role", "Since"], r: [["Emmanuel Ali Sunday", "Founder", "2025"], ["Amina Bello", "Engineer", "2025"], ["Kemi A.", "Engineer", "2026"], ["John Doe", "Project Administrator", "2025"]] }] },
  { id: "e4", t: "Company registration", f: "RC-7241903.pdf", src: "Employer HR", rec: "r2", acc: "PUBLIC", d: "Jul 20, 2026", by: "Corporate registry", b: [{ k: "kv", v: [["Company", "Sproutlight-Group"], ["Registration no.", "RC 7241903"], ["Incorporated", "March 2024"], ["Status", "Active"], ["Director", "Emmanuel Ali Sunday"]] }] },
  { id: "e5", t: "Profile employment entry", f: "linkedin.com/in/emmanuel", src: "LinkedIn", rec: "r2", acc: "PUBLIC", d: "Jun 03, 2026", by: "LinkedIn connection", b: [{ k: "kv", v: [["Title", "Founder & CEO"], ["Company", "Sproutlight-Group"], ["Started", "2024"], ["Location", "Abuja, Nigeria"]] }] },
  { id: "e6", t: "Registry confirmation", f: "FU-REG-2024-04417.pdf", src: "University registry", rec: "r3", acc: "PUBLIC", d: "Aug 11, 2026", by: "Federal University registry", b: [{ k: "cert", u: "Federal University", n: "Emmanuel Ali Sunday", a: "Bachelor of Science in Computer Science", y: "2024", no: "FU/REG/2024/04417" }] },
  { id: "e7", t: "Transcript PDF", f: "transcript-official.pdf", src: "University registry", rec: "r4", acc: "PRIVATE", d: "Aug 11, 2026", by: "Federal University registry", b: [{ k: "table", h: ["Course", "Credits", "Grade"], r: [["CSC 301 Data Structures", "4", "A"], ["CSC 342 Databases", "3", "A"], ["CSC 410 Distributed Systems", "4", "B+"], ["CSC 499 Final Project", "6", "A"]] }, { k: "kv", v: [["CGPA", "4.52 / 5.00"], ["Class", "First Class"]] }] },
  { id: "e8", t: "Issuer signature", f: "cloud-practitioner.sig", src: "Certifier", rec: "r5", acc: "PUBLIC", d: "Mar 18, 2025", by: "Certification authority", b: [{ k: "kv", v: [["Issuer", "Certifier"], ["Algorithm", "Ed25519"], ["Key ID", "cf-2025-04"], ["Result", "Signature valid"]] }, { k: "hex", v: "3045022100c7d1a4e09b52f3e6a8841dd02f9c7b3a5e6014f8d2ab93c7710e5f4a62b8d0319022049ad7e1c05b8f2336d90ae4b17c85f20" }] },
  { id: "e9", t: "Contract scan", f: "employment-contract.pdf", src: "Employer HR", rec: "r6", acc: "PRIVATE", d: "Jul 20, 2026", by: "Employer HR", b: [{ k: "red" }] },
  { id: "e10", t: "Stream session logs", f: "streams-2026.csv", src: "Xeevia", rec: "r10", acc: "CONNECTIONS ONLY", d: "Sep 10, 2026", by: "Xeevia platform", b: [{ k: "table", h: ["Session", "Date", "Duration", "Peak viewers"], r: [["Building in public #4", "Sep 09", "1h 12m", "212"], ["Q&A with builders", "Aug 28", "48m", "164"], ["Launch walkthrough", "Aug 14", "1h 31m", "301"], ["Sprouts community call", "Jul 30", "55m", "118"]] }] },
  { id: "e11", t: "Contribution graph", f: "github.com/emmanuel-dev", src: "GitHub", rec: "r11", acc: "PUBLIC", d: "Oct 03, 2026", by: "GitHub API", b: [{ k: "stats", v: [["47", "Repositories"], ["612", "Pull requests"], ["1,904", "Commits (12 mo)"]] }, { k: "bar", v: [["TypeScript", 48, "#60a5fa"], ["JavaScript", 27, "#fbbf24"], ["Python", 17, "#a3e635"], ["Other", 8, "#6b726a"]] }] },
  { id: "e12", t: "Revocation notice", f: "revocation-cf-0457.json", src: "Certifier", rec: "r12", acc: "PUBLIC", d: "Aug 22, 2026", by: "Cloud Certifier", b: [{ k: "kv", v: [["Credential", "Cloud Security Fundamentals"], ["Status", "Revoked"], ["Revoked on", "Aug 22, 2026"], ["Reason", "Issuer re-assessment"], ["Issued by", "Cloud Certifier"]] }] },
  { id: "e13", t: "Registry lookup result", f: "northbridge-registry-response.json", src: "University registry", rec: "r13", acc: "PUBLIC", d: "Oct 03, 2026", by: "Northbridge registry", b: [{ k: "kv", v: [["Award on registry", "Postgraduate Diploma, Data Science"], ["Year", "2025"], ["Status", "Active"]] }] },
  { id: "e14", t: "Certificate record", f: "cloud-practitioner-record.json", src: "Certifier", rec: "r5", acc: "PUBLIC", d: "Jun 30, 2026", by: "Cloud Certifier", b: [{ k: "kv", v: [["Credential", "Cloud Practitioner"], ["Issued", "Jun 30, 2025"], ["Valid until", "Jun 30, 2026"], ["State", "Expired"]] }] },
];
const M0 = [
  { id: "m1", rec: "r1", type: "CORRECTION", by: "John Doe", auth: "Verified Project Administrator", rel: "Project Administrator · Xeevia", text: "This project was not solely created by Emmanuel. Three other contributors were responsible for the core engineering work.", ev: 2, date: "September 18, 2026", status: "Contested", resp: "Core architecture and the first public build are in the commit history. I credit all contributors in the team record.",
    chain: ["Remark", "Author · John Doe", "Verified identity", "Relationship · Project Administrator", "Project · Xeevia", "Underlying record", "Evidence · 2 supporting records"] },
  { id: "m2", rec: "r1", type: "CONFIRM", by: "Amina Bello", auth: "Verified Project Collaborator", rel: "Collaborator · Xeevia", text: "I confirm Emmanuel led product direction and shipped the identity-consolidation module.", ev: 3, date: "September 02, 2026", status: "Published", resp: null,
    chain: ["Remark", "Author · Amina Bello", "Verified identity", "Relationship · Collaborator", "Project · Xeevia", "Underlying record", "Evidence · 3 records"] },
  { id: "m3", rec: "r3", type: "CONFIRM", by: "Registrar's Office", auth: "Verified University Administrator", rel: "Registrar · Federal University", text: "Degree conferred. Details match the institutional registry.", ev: 1, date: "August 11, 2026", status: "Published", resp: null,
    chain: ["Remark", "Institution · Federal University", "Verified institution", "Relationship · Registrar", "Credential · B.Sc.", "Underlying record", "Registry evidence"] },
  { id: "m4", rec: "r2", type: "CONTEXT", by: "Grace Okafor", auth: "Verified Employer Representative", rel: "HR · Sproutlight-Group", text: "Role is CEO. Start date was confirmed against company registration.", ev: 1, date: "July 21, 2026", status: "Resolved", resp: null,
    chain: ["Remark", "Author · Grace Okafor", "Verified identity", "Relationship · HR representative", "Employment · Sproutlight-Group", "Underlying record", "Registration evidence"] },
  { id: "m5", rec: "r8", type: "RECOGNITION", by: "Xeevia", auth: "Xeevia System Record", rel: "Platform · Discovery ranking", text: "Ranked among top creators in the Discovery feed.", ev: 1, date: "June 30, 2026", status: "Published", resp: null,
    chain: ["Remark", "Xeevia platform", "System identity", "Relationship · Platform", "Achievement · Top Creator", "Underlying record", "Ranking log"] },
  { id: "m6", rec: "r13", type: "CORRECTION", by: "Northbridge Registrar", auth: "Verified University Administrator", rel: "Registrar · Northbridge University", text: "Our registry lists a Postgraduate Diploma in Data Science, not an M.Sc.", ev: 1, date: "October 03, 2026", status: "Published", resp: null, chain: ["Remark", "Institution · Northbridge University", "Verified institution", "Relationship · Registrar", "Credential · M.Sc. Data Science", "Underlying record", "Registry lookup result"] },
  { id: "m7", rec: "r12", type: "CONTEXT", by: "Cloud Certifier", auth: "Verified Certification Issuer", rel: "Issuer · Cloud Certifier", text: "Credential revoked after re-assessment. The holder may re-sit the exam.", ev: 1, date: "August 22, 2026", status: "Published", resp: null, chain: ["Remark", "Issuer · Cloud Certifier", "Verified issuer", "Relationship · Certification authority", "Credential · Cloud Security Fundamentals", "Underlying record", "Revocation notice"] },
];
const TYPES = { CONFIRM: ["g", "I confirm this record."], CORRECTION: ["o", "This record contains inaccurate information."], CONTEXT: ["bl", "Additional context about this record."], DISPUTE: ["r", "I dispute this claim."], ASSESSMENT: ["pu", "Professional assessment of the contribution."], RECOGNITION: ["pk", "Recognition of contribution or achievement."] };
const STAT = { Published: "g", "Under Review": "bl", Contested: "o", Withdrawn: "", Superseded: "", Resolved: "g", Disputed: "r" };
const AUD = [
  { id: "a1", t: "Oct 03, 2026 · 14:20", e: "Verification run on M.Sc. Data Science returned a mismatch", tag: "AUDIT RECORD", actor: "XRC verification service", aid: "svc:xrc-verify", auth: "Scheduled re-verification", rec: "r13", prev: "Self-asserted", next: "Mismatch", src: "University registry", ev: "e13" },
  { id: "a2", t: "Aug 22, 2026 · 10:05", e: "Cloud Security Fundamentals revoked by issuer", tag: "INSTITUTIONAL STATUS", actor: "Cloud Certifier", aid: "org:cloud-certifier", auth: "Issuing authority", rec: "r12", prev: "Verified", next: "Revoked", src: "Certifier", ev: "e12" },
  { id: "a3", t: "Sep 18, 2026 · 14:02", e: "Remark m1 marked Contested after owner response", tag: "AUDIT RECORD", actor: "Emmanuel Ali Sunday (owner)", aid: "usr:emmanuel", auth: "Owner response right", rec: "r1", prev: "Verified", next: "Disputed", src: "Xeevia", ev: "e3" },
  { id: "a4", t: "Aug 11, 2026 · 09:30", e: "Degree status confirmed by institution", tag: "INSTITUTIONAL STATUS", actor: "Federal University registry", aid: "org:federal-university", auth: "Registrar", rec: "r3", prev: "Pending", next: "Verified", src: "University registry", ev: "e6" },
  { id: "a5", t: "Aug 11, 2026 · 00:00", e: "Cloud Practitioner passed its validity date", tag: "INSTITUTIONAL STATUS", actor: "Cloud Certifier", aid: "org:cloud-certifier", auth: "Issuing authority", rec: "r5", prev: "Verified", next: "Expired", src: "Certifier", ev: "e14" },
  { id: "a6", t: "Jul 29, 2026 · 17:45", e: "New sign-in verified from Abuja, NG", tag: "SYSTEM RECORD", actor: "Xeevia security", aid: "svc:xeevia-security", auth: "Automatic", rec: null, prev: "—", next: "Session created", src: "Xeevia", ev: null },
  { id: "a9", t: "Jun 04, 2026 · 09:15", e: "Human identity verified with Self", tag: "SYSTEM RECORD", actor: "Self verification provider", aid: "svc:self", auth: "Proof submitted by owner", rec: null, prev: "Not verified", next: "Verified", src: "Self", ev: null },
  { id: "a7", t: "Jun 03, 2026 · 11:10", e: "GitHub source connected", tag: "SYSTEM RECORD", actor: "Emmanuel Ali Sunday (owner)", aid: "usr:emmanuel", auth: "OAuth read-only grant", rec: "r11", prev: "Not connected", next: "Connected", src: "GitHub", ev: "e11" },
  { id: "a8", t: "May 12, 2026 · 08:00", e: "Identity document verified by Xeevia", tag: "SYSTEM RECORD", actor: "Xeevia identity service", aid: "svc:xeevia-identity", auth: "Platform verifier", rec: "r7", prev: "Pending", next: "Verified", src: "Xeevia", ev: null },
];
const SRCS = [
  { id: "s1", n: "GitHub", type: "Developer platform", state: "Connected", acct: "@emmanuel-dev", caps: ["Repositories", "Organizations", "Contributions", "Pull requests", "Reviews", "Issues"], disc: 47, gen: 2, sync: "2 minutes ago", lv: "Oct 03, 2026", auth: "OAuth · read-only", scopes: ["read:user", "read:org", "repo:status"], hist: [["Oct 03, 2026", "Synchronized · 47 records"], ["Jun 03, 2026", "Connected via OAuth"]] },
  { id: "s2", n: "LinkedIn", type: "Professional network", state: "Connected", acct: "in/emmanuel", caps: ["Positions", "Education", "Skills"], disc: 6, gen: 3, sync: "3 days ago", lv: "Sep 30, 2026", auth: "OAuth · read-only", scopes: ["r_basicprofile"], hist: [["Sep 30, 2026", "Synchronized · 6 records"], ["Jun 03, 2026", "Connected via OAuth"]] },
  { id: "s3", n: "X", type: "Social network", state: "Connected", acct: "@Sproutsking_001", caps: ["Profile", "Posts", "Followers"], disc: 1, gen: 0, sync: "1 hour ago", lv: "Oct 03, 2026", auth: "OAuth · read-only", scopes: ["users.read", "tweet.read"], hist: [["Feb 2026", "Connected via OAuth"]] },
  { id: "s4", n: "Facebook", type: "Social network", state: "Connected", acct: "Boss Ladi", caps: ["Profile", "Friends"], disc: 1, gen: 0, sync: "1 day ago", lv: "Oct 02, 2026", auth: "OAuth · read-only", scopes: ["public_profile"], hist: [["Feb 2026", "Connected via OAuth"]] },
  { id: "s5", n: "Instagram", type: "Social network", state: "Disconnected", acct: "—", caps: ["Profile", "Media"], disc: 0, gen: 0, sync: "Never", lv: "—", auth: "None", scopes: [], hist: [["Sep 20, 2026", "Disconnected by owner"]] },
  { id: "s6", n: "University registry", type: "Institution registry", state: "Connected", acct: "Federal University", caps: ["Credentials", "Enrolment status"], disc: 2, gen: 2, sync: "Aug 11, 2026", lv: "Aug 11, 2026", auth: "Institution-signed responses", scopes: ["credential:read"], hist: [["Aug 11, 2026", "Degree status confirmed"], ["May 2026", "Registry binding created"]] },
  { id: "s7", n: "Northbridge registry", type: "Institution registry", state: "Sync failed", acct: "Northbridge University", caps: ["Credentials"], disc: 1, gen: 1, sync: "Failed 2 hours ago", lv: "Oct 03, 2026", auth: "Institution-signed responses", scopes: ["credential:read"], hist: [["Oct 03, 2026", "Sync failed · source returned 503"], ["Oct 03, 2026", "Lookup returned a different award"]] },
  { id: "s8", n: "Certifier", type: "Credential issuer", state: "Connected", acct: "Cloud Certifier", caps: ["Certificates", "Revocation status"], disc: 3, gen: 3, sync: "Aug 22, 2026", lv: "Aug 22, 2026", auth: "Issuer-signed responses", scopes: ["credential:read"], hist: [["Aug 22, 2026", "Revocation received"], ["2025", "Connected"]] },
];
const IDN = [
  { id: "i0", g: "Core Identity", n: "XRC Identity", a: "Emmanuel Ali Sunday", ic: Fingerprint, s: "Verified", lv: "Institutionally attested", how: "Government ID checked by the Xeevia identity service", sync: "Oct 02, 2026", h: [["May 12, 2026", "Core identity created and bound to an identity document"]] },
  { id: "i11", g: "Human Identity", n: "Self", a: "Proof of personhood", ic: ShieldCheck, s: "Verified", lv: "Verified identity", how: "Zero-knowledge proof submitted through the Self app and checked by Xeevia", sync: "Jun 04, 2026", h: [["Jun 04, 2026", "Self proof received and checked"], ["Jun 04, 2026", "Verification started from XRD"]] },
  { id: "i1", g: "Developer Identities", n: "GitHub", a: "@emmanuel-dev", ic: GitBranch, s: "Verified", lv: "Verified identity", how: "OAuth authorization plus a proof gist on the account", sync: "2 minutes ago", h: [["Jun 03, 2026", "Proof gist published and matched"], ["Jun 03, 2026", "Account connected via OAuth"]] },
  { id: "i2", g: "Professional Identities", n: "LinkedIn", a: "in/emmanuel", ic: Briefcase, s: "Verified", lv: "Verified identity", how: "OAuth authorization and profile URL match", sync: "3 days ago", h: [["Jun 03, 2026", "Account connected and URL matched"]] },
  { id: "i3", g: "Social Identities", n: "X", a: "@Sproutsking_001", ic: Hash, s: "Connected", lv: "Connected identity", how: "OAuth sign-in. This proves control of the account only.", sync: "1 hour ago", h: [["Feb 2026", "Account connected via OAuth"]] },
  { id: "i4", g: "Social Identities", n: "Facebook", a: "Boss Ladi", ic: Users, s: "Connected", lv: "Connected identity", how: "OAuth sign-in. This proves control of the account only.", sync: "1 day ago", h: [["Feb 2026", "Account connected via OAuth"]] },
  { id: "i5", g: "Social Identities", n: "Instagram", a: "—", ic: Heart, s: "Disconnected", lv: "User assertion", how: "Disconnected by the owner", sync: "Never", h: [["Sep 20, 2026", "Disconnected by owner"]] },
  { id: "i6", g: "Institutional Identities", n: "Federal University", a: "Student ID FU/2020/1182", ic: GraduationCap, s: "Verified", lv: "Institutionally attested", how: "Student record returned and signed by the registry", sync: "Aug 11, 2026", h: [["Aug 11, 2026", "Registry confirmed enrolment and award"]] },
  { id: "i7", g: "Institutional Identities", n: "Northbridge University", a: "Not confirmed", ic: GraduationCap, s: "Pending", lv: "User assertion", how: "Binding requested. The registry response differs from the claim.", sync: "Oct 03, 2026", h: [["Oct 03, 2026", "Binding requested; registry returned a different award"]] },
  { id: "i8", g: "Professional Identities", n: "Work email", a: "emmanuel@sproutlight.group", ic: Mail, s: "Pending", lv: "User assertion", how: "Confirmation email sent; link not opened yet", sync: "Never", h: [["Oct 01, 2026", "Confirmation email sent"]] },
  { id: "i9", g: "Wallets", n: "Wallet", a: "0x7a3…c91e", ic: Wallet, s: "Unverified", lv: "User assertion", how: "Address entered by the owner. No signed message yet.", sync: "Never", h: [["Sep 12, 2026", "Address added by owner"]] },
  { id: "i10", g: "Domains", n: "emmanuel.dev", a: "DNS TXT record", ic: Globe, s: "Verified", lv: "Verified identity", how: "DNS TXT record matched the XRC challenge", sync: "Sep 28, 2026", h: [["Sep 28, 2026", "DNS TXT record matched"]] },
];
/* Self is one identity verification layer. XRC is the wider identity/evidence graph; XRD is the owner's interface to it. */
const SELF_ID = "i11";
const SELF_COPY = {
  Verified: "A real person is confirmed behind this XRC identity. Self verifies this one layer; your records and evidence come from their own sources.",
  Pending: "Waiting for a proof from the Self app. Nothing is verified until the proof arrives.",
  "Not connected": "Verify with Self to confirm that a real person holds this identity. Your other connections and records do not depend on it.",
};
const SELF_EDGE = {
  Verified: "Self confirmed that a real person holds this XRC identity. It verifies this layer only; it does not own or replace your other identities.",
  Pending: "A Self verification was requested. No proof has been received yet.",
};
const NAV = [["Overview", Layers], ["Identity", Fingerprint], ["Records", ScrollText], ["Evidence", FileText], ["Graph", Network], ["Chains", GitBranch], ["Remarks", MessageSquareQuote], ["Verification", ShieldCheck], ["Sources", Link2], ["Projects", FolderGit2], ["Credentials", GraduationCap], ["Achievements", Award], ["Activity", ActivityIcon], ["Permissions", Users], ["Audit", Shield], ["XRC Oracle", Sparkles], ["Settings", SettingsIcon]];
const OWNER_ONLY = ["Sources", "Permissions", "Settings"];
const NAVG = [["CORE", ["Overview", "Identity"]], ["GRAPH", ["Records", "Evidence", "Graph", "Chains", "Remarks", "Verification", "Sources"]], ["COLLECTIONS", ["Projects", "Credentials", "Achievements"]], ["CONTROL", ["Activity", "Permissions", "Audit", "XRC Oracle", "Settings"]]];
const SETS = {
  Visibility: ["Default visibility for new records", "Show record counts to visitors", "Hide restricted records from search"], "Record Display": ["Pin selected records first", "Show evidence counts publicly", "Show provenance where permitted"],
  Remarks: ["Allow people to request remark access", "Show remarks publicly", "Enable owner responses", "Require evidence for remarks", "Show contested remarks publicly"], Verification: ["Allow public verification checks", "Show verification history", "Notify me when a record is verified"],
  Connections: ["Show connection-only records to followers", "Allow connections to request evidence"], Permissions: ["Require approval for evidence access", "Allow verifiers to view restricted records"], Sharing: ["Allow share links to XRD", "Share links expire after 30 days"],
  Notifications: ["New remark on my records", "Remark access requests", "Evidence access requests"], Privacy: ["Hide XRD from search engines", "Show XRD stats on profile"], Security: ["Require re-authentication for visibility changes", "Alert on new sign-ins"],
  Sources: ["Require approval before a source syncs new records", "Notify me when a source fails to sync"], Account: ["Show my XRD link on my profile", "Allow XRC Oracle to cite public records"], Audit: ["Keep my own audit view enabled (system log is always kept)"], Oracle: ["Let Oracle answer public questions", "Include restricted records in my private Oracle"],
};
const ASK = ["What evidence supports my software development experience?", "Which institutions have verified my education?", "Show my employment history.", "What projects are connected to my GitHub identity?", "Which claims are currently disputed?", "What evidence supports my role in Xeevia?", "What records have not been independently verified?", "Is my identity verified with Self?", "Which identities are connected to me?"];

const ASK_PUB = ["Which institutions have verified Emmanuel's education?", "Show Emmanuel's employment history.", "What projects are connected to his GitHub identity?", "Which claims are currently disputed?", "Is his identity verified with Self?", "What evidence supports his role in Xeevia?", "What records are not independently verified?", "Which identities are connected to him?"];
const ASKS = [[0, GitBranch, "Software"], [1, GraduationCap, "Education"], [2, Briefcase, "Employment"], [3, FolderGit2, "Projects"], [4, AlertTriangle, "Disputes"], [5, Award, "Role"], [6, Clock, "Unverified"], [7, ShieldCheck, "Self"], [8, Fingerprint, "Identities"]].map(([i, I, l]) => ({ q: ASK[i], I, l }));
const ASKS_PUB = [[0, GraduationCap, "Education"], [1, Briefcase, "Employment"], [2, FolderGit2, "Projects"], [3, AlertTriangle, "Disputes"], [4, ShieldCheck, "Self"], [5, Award, "Role"], [6, Clock, "Unverified"], [7, Fingerprint, "Identities"]].map(([i, I, l]) => ({ q: ASK_PUB[i], I, l }));
/* ═════════ FILE: src/services/xrcService.js (mock XRC service layer) ═════════ */
const CHK = ["Record exists at registered source", "Subject identity matches", "Issuer matches registered institution", "Record status is active", "Record has not been revoked", "Source response is consistent with XRC record"];
const DISC = { r13: [["Award title", "M.Sc. Data Science", "Postgraduate Diploma, Data Science"], ["Award level", "Master's degree", "Diploma"]] };
function runOf(r) {
  const det = ["Found at " + r.src, "Matches the XRC identity binding", "Issued by " + r.iss, "Active at the time of the check", "No revocation on file", "Source response agrees with the record"];
  let c = CHK.map((l, i) => [l, "ok", det[i]]);
  const set = (i, st, d) => { c[i] = [CHK[i], st, d]; };
  const all = (first, st) => { c = CHK.map((l, i) => (i === 0 ? [l, st, first] : [l, "skip", "Not checked"])); };
  const S = r.st;
  if (S === "MISMATCH") set(5, "fail", "Source returned a different award. See the discrepancy.");
  if (S === "REVOKED") { set(3, "fail", "Issuer marks the record inactive"); set(4, "fail", "Revoked by " + r.iss + " on " + r.ver); }
  if (S === "EXPIRED") set(3, "warn", "Validity ended " + r.ver);
  if (S === "SUPERSEDED") set(3, "warn", "Replaced by Xeevia (r1)");
  if (S === "DISPUTED") set(5, "warn", "Source agrees. An open dispute exists on the claim.");
  if (S === "SOURCE UNAVAILABLE") all("No response from " + r.src + " (timeout)", "fail");
  if (S === "PENDING") all("Request queued with " + r.iss, "skip");
  if (S === "SELF-ASSERTED") all("No independent source is registered", "warn");
  return { id: "vr-" + r.id + "-" + (r.ver || "none").replace(/\W/g, ""), method: r.src === "Xeevia" ? "Platform record lookup" : "Source API lookup and issuer signature check", ts: r.ver ? r.ver + " · 14:20" : "No run completed", checks: c, disc: DISC[r.id] || null,
    resp: S === "SOURCE UNAVAILABLE" ? "No response (timeout after 10s)" : S === "PENDING" || S === "SELF-ASSERTED" ? "No response requested yet" : S === "MISMATCH" ? "200 OK · returned a different award" : S === "REVOKED" ? "200 OK · status: revoked" : "200 OK · " + r.iss + " record returned",
    hist: [[r.ver || "—", ST[S].l], ["Sep 01, 2026", S === "VERIFIED" ? "Verified against registered source" : "Previously verified against source"], [r.d, "Imported from " + r.src]] };
}
function oracle(q, vis, idv = []) {
  const l = q.toLowerCase(), by = (f) => vis.filter(f), cnt = (rs, st) => rs.filter((r) => r.st === st).length;
  let rs = [], a = "", idn = [];
  if (/\bself\b|human|personhood/.test(l)) {
    const s = idv.find((i) => i.id === SELF_ID);
    if (!s) return { a: "No Self verification is visible to you on this identity.", rs: [], idn: [], srcs: [] };
    idn = [s];
    a = s.s === "Verified" ? "This identity is verified with Self. Self confirms that a real person holds it. It does not confirm your records, education or employment; those are traced to their own sources." : s.s === "Pending" ? "A Self verification has been requested and is pending. Nothing is verified until a proof arrives." : "This identity is not verified with Self.";
  }
  else if (/not.*(independ|verif)|unverif/.test(l)) { rs = by((r) => ["SELF-ASSERTED", "PENDING", "SOURCE UNAVAILABLE"].includes(r.st)); a = `${rs.length} accessible records have no independent confirmation right now: ${cnt(rs, "SELF-ASSERTED")} self-asserted, ${cnt(rs, "PENDING")} pending, ${cnt(rs, "SOURCE UNAVAILABLE")} with an unreachable source.`; }
  else if (/disput|challeng|contest/.test(l)) { rs = by((r) => ["DISPUTED", "MISMATCH", "REVOKED"].includes(r.st)); a = `${rs.length} records are in question: ${cnt(rs, "DISPUTED")} disputed, ${cnt(rs, "MISMATCH")} not matching the source, ${cnt(rs, "REVOKED")} revoked. I show the evidence and do not decide who is right.`; }
  else if (/xeevia|founder/.test(l)) { rs = by((r) => /xeevia/i.test(r.t) && r.k === "Projects"); a = `The Xeevia project record is ${rs[0] ? ST[rs[0].st].l.toLowerCase() : "not accessible"}. A project administrator has filed a correction and the owner has responded; both are shown with the repository, documentation and team record.`; }
  else if (/academ|educat|universit|institution|degree/.test(l)) { rs = by((r) => r.k === "Academia"); const v = rs.filter((r) => r.st === "VERIFIED"); a = `${rs.length} academic records are accessible. ${v.length} verified against ${[...new Set(v.map((r) => r.iss))].join(", ") || "no institution"}. ${cnt(rs, "MISMATCH")} does not match its registry.`; }
  else if (/github|software|develop|engineer|code/.test(l)) { rs = by((r) => r.src === "GitHub"); a = `${rs.length} records come from the GitHub identity (@emmanuel-dev), including 47 repositories of contributions. ${cnt(rs, "DISPUTED")} is disputed.`; }
  else if (/employ|work|job|career/.test(l)) { rs = by((r) => r.k === "Employment"); a = `${rs.length} employment records are accessible: ${cnt(rs, "VERIFIED")} verified, ${cnt(rs, "SOURCE UNAVAILABLE")} with an unreachable source, ${cnt(rs, "PENDING")} pending.`; }
  else if (/identit|connected|account|wallet|domain/.test(l)) {
    idn = idv.filter((i) => i.id !== "i0");
    const n = (s) => idn.filter((i) => i.s === s).length;
    a = `${idn.length} identities are bound to this XRC identity: ${n("Verified")} verified, ${n("Connected")} connected, ${idn.length - n("Verified") - n("Connected")} pending, unverified or disconnected. Connecting an account proves control of it; verification needs a second proof.`;
  }
  if (!rs.length && !idn.length) return { a: "I found no accessible records that answer this. I won't infer evidence that isn't in the record graph.", rs: [], idn: [], srcs: [] };
  return { a, rs, idn, srcs: rs.length ? [...new Set(rs.map((r) => r.src))] : [...new Set(idn.map((i) => i.n))] };
}

/* ═════════ FILE: src/App.jsx ═════════ */
export default function App() {
  const [view, setView] = useState("profile"); // /emmanuel  ↔  /emmanuel/xrd
  const [sec, setSec] = useState("Overview");
  const [mode, setMode] = useState("owner");
  const [toast, setToast] = useState("");
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(""), 1800); return () => clearTimeout(t); } }, [toast]);
  const open = (s = "Overview") => { setSec(s); setView("xrd"); window.scrollTo(0, 0); };
  return (
    <div className="xv"><style>{CSS}</style>
      {view === "profile" ? <ProfilePage mode={mode} setMode={setMode} open={open} say={setToast} /> : <XrdApp mode={mode} setMode={setMode} init={sec} close={() => setView("profile")} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
const Av = ({ n, s = 40, g = "#a3e635,#10b981" }) => <div className="av" style={{ width: s, height: s, fontSize: s * 0.4, background: `linear-gradient(135deg,${g})` }}>{n[0]}</div>;
const G = ["#a3e635,#10b981", "#fb923c,#f43f5e", "#60a5fa,#a78bfa", "#2dd4bf,#3b82f6", "#f0abfc,#fb7185", "#fde047,#fb923c"];

/* ═════════ FILE: src/components/profile/PeopleStack.jsx ═════════ */
/* One squircle avatar. i / n place it in the stack: later = larger and brighter, the last one is full size and full brightness. */
function PAv({ p, s = 38, i = 0, n = 1, top = false, solo = false }) {
  const style = { "--s": s + "px", "--i": i, "--g1": p.g[0], "--g2": p.g[1], zIndex: i + 1 };
  if (!solo && !top) style["--b"] = (0.6 + 0.4 * (i / Math.max(n - 1, 1))).toFixed(2);
  return <span className={`pka ${top ? "lead" : ""} ${solo ? "solo" : ""}`} style={style} title={p.n}>{p.n[0]}{top && p.v ? <span className="pkv"><BadgeCheck size={19} strokeWidth={2.2} /></span> : null}</span>;
}
function PeopleStack({ k, onOpen, max = 4 }) {
  const d = PEOPLE[k];
  const pick = [...d.list].sort((a, b) => b.rel - a.rel).slice(0, max); // most relevant first
  const show = [...pick].reverse();                                      // …so the most relevant lands last, on top
  const n = show.length, names = pick.slice(0, 3).map((p) => p.n.split(" ")[0]).join(", ");
  return (
    <button className="pkc" onClick={() => onOpen(k)} aria-label={`${d.label}: ${d.total}, including ${names}. Open the list`}>
      <span className="pks">{show.map((p, i) => <PAv key={p.id} p={p} i={i} n={n} s={Math.round(26 + 9 * (i / Math.max(n - 1, 1)))} top={i === n - 1} />)}</span>
      <span className="pkm">
        <span className="pkt"><span className="pkn">{d.total}</span><small>{d.label}</small></span>
        <em className="pkw">{names}{d.total > 3 ? ` +${d.total - 3}` : ""}</em>
      </span>
      <span className="pkgo" aria-hidden="true"><ChevronRight size={15} strokeWidth={2.6} /></span>
    </button>
  );
}
function PeopleSheet({ k, own, onClose, say }) {
  const [tab, setTab] = useState(k), [fl, setFl] = useState({});
  const d = PEOPLE[tab], list = [...d.list].sort((a, b) => b.rel - a.rel), hidden = d.total - list.length;
  return (
    <div className="mod fsm" onClick={onClose}><div onClick={(e) => e.stopPropagation()}>
      <div className="row"><h3 className="fl" style={{ margin: 0, fontSize: 18 }}>{own ? "Your network" : "Emmanuel's network"}</h3><button className="ib" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
      <div className="seg" style={{ margin: "14px 0" }}>{["following", "followers"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{PEOPLE[t].label} · {PEOPLE[t].total}</button>)}</div>
      <div className="xs mu mono" style={{ letterSpacing: ".08em", marginBottom: 4 }}>RANKED BY RELEVANCE · SHOWING {list.length} OF {d.total}</div>
      {list.map((p) => { const key = tab + p.id, on = fl[key] ?? (own && tab === "following"); return (
        <div className="prow" key={p.id}><PAv p={p} s={46} solo top={false} />
          <div className="fl"><div className="b row" style={{ gap: 5 }}><span className="tr">{p.n}</span>{p.v ? <BadgeCheck size={14} className="ac" style={{ flex: "none" }} /> : null}</div><div className="xs mu tr">{p.why}</div></div>
          {!own && p.mut > 0 && <span className="chip">{p.mut} mutual</span>}
          <button className={`btn s ${on ? "" : "w"}`} onClick={() => { setFl({ ...fl, [key]: !on }); say(on ? "Unfollowed " + p.n : (tab === "followers" ? "Following back " : "Followed ") + p.n); }}>{on ? "Following" : tab === "followers" ? "Follow back" : "Follow"}</button>
        </div>); })}
      {hidden > 0 && <div className="sm mu" style={{ marginTop: 12 }}>+{hidden} more people are not shown in this preview.</div>}
    </div></div>
  );
}

/* ═════════ FILE: src/components/profile/ProfilePage.jsx ═════════ */
function ProfileMenu({ own, onClose, say }) {
  const items = own ? [[Link2, "Copy profile link"], [Pencil, "Edit profile"], [Lock, "Privacy and visibility"], [Share2, "Share my XRD"]] : [[Link2, "Copy profile link"], [Share2, "Share profile"], [BellOff, "Mute Emmanuel"], [Flag, "Report profile", 1], [UserX, "Block Emmanuel", 1]];
  return (<><div className="sh-bd" onClick={onClose} /><div className="sheet pmenu" role="dialog" aria-label="Profile options"><div className="grab" />
    {items.map(([I, l, bad]) => <button key={l} className="pmi" style={bad ? { color: "#f87171" } : undefined} onClick={() => { say(l.startsWith("Copy") ? "Profile link copied" : l); onClose(); }}><I size={18} />{l}</button>)}</div></>);
}
function ProfilePage({ mode, setMode, open, say }) {
  const [tab, setTab] = useState("Posts");
  const [fol, setFol] = useState(false), [nt, setNt] = useState(false), [menu, setMenu] = useState(false);
  const [pk, setPk] = useState(null); // "following" | "followers" | null
  const own = mode === "owner";
  const base = own ? R0 : R0.filter((r) => r.v === "PUBLIC");
  const stats = [[base.length, "Records"], [base.filter((r) => r.ok).length, "Verified"], [new Set(base.map((r) => r.src)).size, "Sources"], [new Set(base.filter((r) => r.k === "Academia").map((r) => r.iss)).size, "Institutions"]];
  const faces = [...PEOPLE.following.list].sort((a, b) => b.rel - a.rel).slice(0, 3);
  const nav = [[Home, "Home"], [Search, "Explore"], [PlusSquare, "Create"], [Users, "Community"], [Wallet, "Wallet"], [User, "Account"], [LayoutGrid, "Menu"]];
  return (
    <div className="pg">
      <nav className="rail">{nav.map(([I, n]) => <button key={n} title={n} className={`it ${n === "Account" ? "on" : ""}`} onClick={() => say(n + " is in the main app")}><I size={20} /></button>)}</nav>

      {/* LEFT SIDEBAR — Facebook-style personal details, friends, photos */}
      <aside className="side ls">
        <div className="pn"><h3>Personal details</h3>
          {[[Home, "Lives in Abuja, Nigeria", 1], [MapPin, "From Kafanchan", 1], [Briefcase, "Founder at Sproutlight-Group", 1], [Cake, "Born 29 September", 0], [Heart, "Single", 0]].filter(([, , pub]) => own || pub).map(([I, t, pub]) => <div key={t} className="row" style={{ padding: "9px 0" }}><I size={18} className="ac" /><span className="fl">{t}</span>{own && !pub ? <span className="chip" title="Only you can see this"><Lock size={10} />Only you</span> : null}</div>)}
        </div>
        <div className="pn"><div className="hrow"><h3 className="fl">Connections</h3><span className="ac sm">See all</span></div><div className="mu sm" style={{ margin: "-6px 0 10px" }}>{own ? "921 connections" : "921 connections · 10 mutual"}</div>
          <div className="g3">{["Godwin Jacob", "Lukas Isaac", "Donrik Vibez", "Sylvester Junior", "Cassandra Nwogu", "Devine Nka"].map((n, i) => <div key={n}><div className="av" style={{ width: "100%", aspectRatio: "1", borderRadius: 12, fontSize: 26, background: `linear-gradient(135deg,${G[i]})` }}>{n[0]}</div><div className="xs b tr" style={{ marginTop: 4 }}>{n}</div></div>)}</div>
        </div>
        <div className="pn"><h3>Linked networks</h3>{["X", "Facebook", "Instagram", "LinkedIn"].map((n, i) => (own || i < 2) && <div key={n} className="row" style={{ padding: "6px 0" }}><span className="fl">{n}</span><span className={`chip ${i < 2 ? "g" : ""}`}>{i < 2 ? "Linked" : "Not linked"}</span></div>)}</div>
        <button className="btn s" onClick={() => setMode(own ? "public" : "owner")}>Prototype: viewing as <b className="ac">{own ? "owner" : "visitor"}</b> — switch</button>
      </aside>

      {/* CENTER — X-style profile */}
      <main className="pn pfm" style={{ padding: 0, overflow: "hidden" }}>
        <div className="pmode"><span className="xs mono mu">PROTOTYPE VIEW</span><div className="seg">{[["owner", "Owner"], ["public", "Visitor"]].map(([m, l]) => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{l}</button>)}</div></div>
        <div className="ban">{own && <button className="ban-ed" onClick={() => say("Edit cover")}><Camera size={14} />Edit cover</button>}<div className="hex">X</div><div style={{ position: "absolute", left: 22, right: 130, bottom: 66 }}><div style={{ fontSize: 30, fontWeight: 800, color: "var(--ac)", letterSpacing: "-.02em" }}>Sprouts King</div><div className="sm" style={{ color: "#cfe8b8" }}>Founder & CEO of Sproutlight-Group · Building Xeevia & Infinite Sprouts</div></div></div>
        <div style={{ padding: "0 20px 16px" }}>
          <div className="row phd">
            <div className="av pav">E</div>
            <div className="fl" />
            <div className="row pact">
              <button className="ib" aria-label="More options" title="More options" onClick={() => setMenu(true)}><MoreHorizontal size={17} /></button>
              {own ? <button className="ib" aria-label="Share profile" title="Share profile" onClick={() => say("Profile link copied")}><Share2 size={17} /></button> : <>
                <button className="ib" aria-label="Message" title="Message" onClick={() => say("Message")}><Mail size={17} /></button>
                <button className={`ib ${nt ? "on" : ""}`} aria-pressed={nt} aria-label={nt ? "Turn off notifications" : "Turn on notifications"} title={nt ? "Notifications on" : "Notify me of posts"} onClick={() => { setNt(!nt); say(nt ? "Notifications off" : "Notifications on for Emmanuel"); }}>{nt ? <BellRing size={17} /> : <Bell size={17} />}</button></>}
              {own ? <button className="btn pbt" aria-label="Edit profile" title="Edit profile" onClick={() => say("Edit profile")}><Pencil size={15} /><span className="lbl">Edit profile</span></button> : <button className="btn w pbt" aria-label={fol ? "Following" : "Follow"} title={fol ? "Following" : "Follow"} onClick={() => setFol(!fol)}>{fol ? <Check size={15} /> : <UserPlus size={15} />}<span className="lbl">{fol ? "Following" : "Follow"}</span></button>}
              <span className="xrw"><button className="btn p pbt xrbtn" aria-label="Open XRD" title="Open XRD" onClick={() => open("Overview")}><span className="xrh"><ShieldCheck size={18} /></span><span className="lbl">XRD</span></button></span>
            </div>
          </div>
          <div className="pid">
            <div className="row" style={{ gap: 8 }}><h1 className="pname">{ME.name}</h1><BadgeCheck size={20} className="ac" /></div>
            <div className="phandle">@{ME.handle}</div>
            <div className="ptags">{ME.tag.split(" • ").map((t) => <span key={t} className="chip g">{t}</span>)}</div>
            <p className="pbio">{ME.bio}</p>
            <div className="pmeta"><span className="pm"><MapPin size={14} />Abuja, Nigeria</span><span className="pm"><Clock size={14} />Joined February 2026</span></div>
            {own ? <button className="pstr" onClick={() => open("Identity")}><span className="row" style={{ gap: 8 }}><ShieldCheck size={15} className="ac" /><b>Profile strength</b></span><span className="pstr-b"><i style={{ width: "82%" }} /></span><b className="ac">82%</b><span className="mu xs">Add a work email →</span></button>
              : <div className="pmut"><span className="pmut-f">{[...faces].reverse().map((f) => <span key={f.id} className="pmut-a" style={{ background: `linear-gradient(135deg,${f.g[0]},${f.g[1]})` }}>{f.n[0]}</span>)}</span><span>Followed by <b>Amina</b>, <b>Kemi</b> and 8 others you follow</span></div>}
            {/* PEOPLE — most relevant faces, stacked. Replaces the plain Following / Followers count cards. */}
            <div className="pk">{["following", "followers"].map((k) => <PeopleStack key={k} k={k} onOpen={setPk} />)}</div>
          </div>

          {/* XRD ENTRY — directly below bio */}
          <div className="xrdc" style={{ marginTop: 16 }}>
            <div className="row xh"><div className="av" style={{ width: 46, height: 46, borderRadius: 14, background: "var(--ac)", fontSize: 14 }}>XRD</div>
              <div className="fl"><div className="b" style={{ fontSize: 16 }}>View verified records</div><div className="sm mu">{own ? "Your evidence, traced to its source." : "Emmanuel's public evidence, traced to its source."}</div></div>
              <button className="btn p" onClick={() => open("Overview")}>Open XRD <ChevronRight size={15} /></button></div>
            <div className="g4 xg" style={{ marginTop: 14 }}>{stats.map(([n, l]) => <div className="stat" key={l}><b>{n}</b><span className="xs mu">{l}</span></div>)}</div>
          </div>

          {/* Quick actions — same tile language as the Xeevia account page */}
          <div className="tiles" style={{ marginTop: 14 }}>
            {(own ? [[Pencil, "Edit Profile", "Update your info", "#a3e635"], [Bookmark, "Saved", "Your bookmarks", "#fb923c"], [UserPlus, "Followers", "7 people", "#60a5fa"], [Users, "Following", "12 people", "#a78bfa"], [ShieldCheck, "Verification", "Open proof dashboard", "#c084fc", "Verification"], [Hash, "Communities", "1 joined", "#2dd4bf", "Records"], [Sprout, "Ambassador", "Scout · 8% commission", "#f59e0b"], [Sparkles, "XRC Oracle", "Ask your evidence", "#a3e635", "XRC Oracle"]]
              : [[Mail, "Message", "Say hello", "#a3e635"], [Share2, "Share profile", "Send this profile", "#fb923c"], [UserPlus, "Followers", "7 people", "#60a5fa"], [Users, "Following", "12 people", "#a78bfa"], [ShieldCheck, "Verification", "See what is verified", "#c084fc", "Verification"], [Hash, "Communities", "1 joined", "#2dd4bf", "Records"], [Users, "Mutual", "10 in common", "#f59e0b"], [Sparkles, "Ask Oracle", "Ask about Emmanuel", "#a3e635", "XRC Oracle"]]).map(([I, t, s, c, go]) => (
              <button key={t} className="tile" style={{ "--c": c }} onClick={() => (t === "Followers" ? setPk("followers") : t === "Following" ? setPk("following") : go ? open(go) : say(t))}><span className="ti"><I size={18} /></span><span><b>{t}</b><br /><span className="xs mu">{s}</span></span></button>))}
          </div>
        </div>
        <div className="tabs">{["Posts", "Replies", "Reposts", "Media"].map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
        {tab === "Posts" ? ["Shipping the identity consolidation module this week. One profile, every network, with receipts.", "People keep asking what XRD is. It is the part of your profile that proves the rest."].map((p, i) => (
          <div className="post" key={i}><div className="row"><Av n="E" s={38} /><div><b>{ME.name}</b> <span className="mu">@{ME.handle} · {i + 1}d</span></div></div><p style={{ margin: "8px 0 10px 48px", fontSize: 15 }}>{p}</p>
            <div className="row mu" style={{ marginLeft: 48, gap: 28 }}><MessageCircle size={16} /><Repeat2 size={16} /><Heart size={16} /><Share size={16} />{own ? <span className="row xs" style={{ gap: 5, marginLeft: "auto" }}><Eye size={14} />{i ? "864" : "1.2k"} views</span> : null}</div></div>)) : <div style={{ padding: 48, textAlign: "center" }} className="mu">Nothing in {tab} yet.</div>}
      </main>

      {/* RIGHT SIDEBAR — X-style */}
      <aside className="side rs">
        <div className="row pn" style={{ padding: "10px 16px", borderRadius: 99 }}><Search size={16} className="mu" /><span className="mu">Search</span></div>
        <div className="pn"><h3>Top streamers</h3>{[["Mikeson Smith", "10 streams"], ["Infinite Sprout", "6 streams"], ["Sprouts King", "4 streams"]].map(([n, s], i) => <div key={n} className="row" style={{ padding: "7px 0" }}><Av n={n} s={34} g={G[i + 1]} /><div className="fl"><div className="b sm">{n}</div><div className="xs mu">{s}</div></div><ChevronRight size={14} className="mu" /></div>)}</div>
        <div className="pn"><h3>{own ? "You might like" : "Similar creators"}</h3>{["Interesting things", "Mintern", "Evreni Merak"].map((n, i) => <div key={n} className="row" style={{ padding: "7px 0" }}><Av n={n} s={34} g={G[i + 3]} /><span className="fl b sm">{n}</span><button className="btn w s" onClick={() => say("Followed " + n)}>Follow</button></div>)}</div>
        <div className="pn"><h3>Trending</h3>{[["General", "84 posts"], ["Entertainment", "22 posts"], ["Lifestyle", "9 posts"]].map(([n, c]) => <div key={n} style={{ padding: "6px 0" }}><div className="b sm">#{n}</div><div className="xs mu">{c} · Hot</div></div>)}</div>
      </aside>
      {menu && <ProfileMenu own={own} onClose={() => setMenu(false)} say={say} />}
      {pk && <PeopleSheet key={pk} k={pk} own={own} onClose={() => setPk(null)} say={say} />}
    </div>
  );
}

/* ═════════ FILE: src/components/xrd/XrdApp.jsx ═════════ */
function XrdApp({ mode, setMode, init, close }) {
  const [cur, setCur] = useState({ s: init, i: null });
  const [hist, setHist] = useState([]);
  const [recs, setRecs] = useState(R0);
  const [rms, setRms] = useState(M0);
  const [ids, setIds] = useState(IDN);
  const [orLog, setOrLog] = useState([]);
  const [trace, setTrace] = useState(null);
  const [comp, setComp] = useState(null);
  const [req, setReq] = useState({});
  const [more, setMore] = useState(false);
  const [share, setShare] = useState(null);
  const sec = cur.s, sel = cur.i, own = mode === "owner";
  const vis = own ? recs : recs.filter((r) => r.v === "PUBLIC");
  const hid = recs.length - vis.length;
  const vr = rms.filter((m) => vis.some((r) => r.id === m.rec));
  const ev = EV.filter((e) => vis.some((r) => r.id === e.rec));
  const go = (s, id = null) => { if (s === sec && id === sel) return; setHist((h) => [...h, cur]); setCur({ s, i: id }); setMore(false); window.scrollTo(0, 0); };
  const back = () => { if (!hist.length) return close(); setCur(hist[hist.length - 1]); setHist(hist.slice(0, -1)); window.scrollTo(0, 0); };
  const c = { own, vis, hid, vr, ev, recs, setRecs, rms, setRms, ids, setIds, orLog, setOrLog, mode, setMode, sel, go, back, setTrace, setComp, setShare, req, setReq };
  const items = NAV.filter(([n]) => own || !OWNER_ONLY.includes(n));
  const S = { Overview, Identity, Records, Evidence, Graph, Chains, Remarks, Verification, Sources, Projects: Kind("Projects", "Projects", FolderGit2), Credentials: Kind("Credentials", "Credentials", GraduationCap), Achievements: Kind("Achievements", "Achievements", Award), Activity, Permissions, Audit, "XRC Oracle": Oracle, Settings }[sec] || Overview;
  const MAIN = ["Overview", "Records", "Graph", "XRC Oracle"];
  return (
    <div className="xs-shell">
      <aside className="nav">
        <button onClick={close} style={{ marginBottom: 14 }}><ArrowLeft size={15} />Back to profile</button>
        <div className="row" style={{ padding: "0 8px 16px" }}><div className="av" style={{ width: 38, height: 38, borderRadius: 11, background: "var(--ac)", fontSize: 12 }}>XRD</div><div><div className="b">Xeevia Record</div><div className="xs mu">{ME.name}</div></div></div>
        {NAVG.map(([g, ns]) => { const row = items.filter(([n]) => ns.includes(n)); return row.length ? <div key={g}><div className="nav-g mono">{g}</div>{row.map(([n, I]) => <button key={n} className={sec === n ? "on" : ""} onClick={() => go(n)}><I size={16} />{n}</button>)}</div> : null; })}
      </aside>
      <div>
        <header className="top">
          <button className="ib" onClick={back} aria-label="Back"><ArrowLeft size={16} /></button>
          <div className="fl tr mu sm">xeevia.app/{ME.handle}/<b style={{ color: "var(--tx)" }}>xrd</b>{sec !== "Overview" && <span> / {sec.toLowerCase()}</span>}</div>
          <div className="seg">{[["owner", "Owner"], ["public", "Public view"]].map(([m, l]) => <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); if (m === "public" && OWNER_ONLY.includes(sec)) go("Overview"); }}>{l}</button>)}</div>
        </header>
        <div className="main"><S {...c} /></div>
      </div>
      <nav className="mnav">{[["Overview", Layers], ["Records", ScrollText], ["Graph", Network], ["XRC Oracle", Sparkles]].map(([n, I]) => <button key={n} className={sec === n ? "on" : ""} onClick={() => go(n)}><I size={19} />{n === "XRC Oracle" ? "Oracle" : n}</button>)}
        <button className={more || !MAIN.includes(sec) ? "on" : ""} onClick={() => setMore(true)}><MoreHorizontal size={19} />More</button></nav>
      {more && <><div className="sh-bd" onClick={() => setMore(false)} /><div className="sheet" role="dialog" aria-label="More sections"><div className="grab" /><div className="hrow"><h3 className="fl" style={{ fontSize: 17 }}>More</h3><button className="ib" onClick={() => setMore(false)}><X size={16} /></button></div>
        <div className="sg">{items.filter(([n]) => !MAIN.includes(n)).map(([n, I]) => <button key={n} className={`si ${sec === n ? "on" : ""}`} onClick={() => go(n)}><I size={22} />{n === "XRC Oracle" ? "Oracle" : n}</button>)}<button className="si" onClick={close}><ArrowLeft size={22} />Profile</button></div></div></>}
      {share && <ShareSheet r={share} onClose={() => setShare(null)} />}
      {trace && <Trace m={trace} onClose={() => setTrace(null)} />}
      {comp && <Composer r={comp} own={own} onClose={() => setComp(null)} onPublish={(m) => { setRms([m, ...rms]); setComp(null); go("Remarks"); }} />}
    </div>
  );
}
/* Dd — one picker for the whole app.
   PC: a popover under the button. Phone: a bottom sheet with a grabber, a title, big touch rows and (for filters) a Reset.
   o = [[key, label, sub?, dotColour?], …]. The FIRST option is the "no filter" value. Pass filter to light the button when a filter is active. */
function Dd({ v, o, set, label, filter = false }) {
  const [open, setOpen] = useState(false);
  const cur = o.find((x) => x[0] === v) || o[0], dirty = filter && v !== o[0][0];
  useEffect(() => { if (!open) return; const k = (e) => e.key === "Escape" && setOpen(false); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open]);
  const pick = (k) => { set(k); setOpen(false); };
  return (<div className={`dd ${open ? "open" : ""}`}><button className={`ddb ${open ? "on" : ""} ${dirty ? "act" : ""}`} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}><span className="fl"><span className="xs mu">{label}</span><span className="b tr" style={{ display: "block" }}>{cur[1]}</span></span>{dirty && <i className="ddot" />}<ChevronDown size={16} className="dch" /></button>
    {open && <><div className="ddx" onClick={() => setOpen(false)} /><div className="ddm" role="listbox" aria-label={label}>
      <div className="ddh"><div className="grab" /><div className="row"><div className="fl"><div className="xs mu mono" style={{ letterSpacing: ".1em" }}>{label.toUpperCase()}</div><div className="b" style={{ fontSize: 17 }}>Choose {label.toLowerCase()}</div></div>{dirty && <button className="btn s" onClick={() => pick(o[0][0])}>Reset</button>}<button className="ib" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button></div></div>
      <div className="ddl">{o.map(([k, l, sub, col]) => <button key={k} role="option" aria-selected={k === v} className={`ddi ${k === v ? "on" : ""}`} onClick={() => pick(k)}>{col && <i className="ddc" style={{ background: col, color: col }} />}<span className="fl"><span className="tr b" style={{ display: "block" }}>{l}</span>{sub && <span className="xs mu">{sub}</span>}</span>{k === v && <Check size={16} className="ac" />}</button>)}</div>
    </div></>}</div>);
}
const tc = (k) => k[0] + k.slice(1).toLowerCase(); // "SELF-ASSERTED" → "Self-asserted"
const pl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const hx = (t) => "0x" + [...t].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0");
const HEADI = { Records: ScrollText, Evidence: FileText, "Evidence graph": Network, Chains: GitBranch, Remarks: MessageSquareQuote, Verification: ShieldCheck, Sources: Link2, Identity: Fingerprint, Activity: ActivityIcon, Permissions: Users, Audit: Shield, "XRC Oracle": Sparkles, "XRD settings": SettingsIcon, Projects: FolderGit2, Credentials: GraduationCap, Achievements: Award };
const Head = ({ t, s, right }) => { const I = HEADI[t] || Layers; return <div className="hd0"><div className="row" style={{ alignItems: "flex-start", gap: 14 }}><div className="hexf sm"><div><I size={18} /></div></div><div className="fl"><h1>{t}</h1><div className="mu">{s}</div></div>{right}</div></div>; };
const Sys = ({ l = "SYSTEM RECORD" }) => <span className="chip" style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,.4)" }}><Lock size={10} />{l}</span>;
const NOTE = "Some records may remain visible or auditable when required for security, platform integrity, institutional verification, or legal/compliance purposes.";
const VC = (v) => (v === "PUBLIC" ? "g" : v === "PRIVATE" ? "r" : "o");
const WARNST = ["REVOKED", "EXPIRED", "MISMATCH", "DISPUTED", "SUPERSEDED", "SOURCE UNAVAILABLE"];
const Banner = ({ r, onClick }) => { const x = ST[r.st], c = HEX[x.c]; return <div className={`bn ${x.c === "r" || x.c === "o" ? "bg-hatch" : "bg-grid"}`} style={{ "--t": c }}><div className="bn-i"><x.I size={20} /></div><div className="fl"><div className="xs mono" style={{ letterSpacing: ".1em", color: c }}>RECORD STATUS</div><div className="b">{x.l}</div><div className="sm mu">{x.m}</div></div>{onClick && <button className="btn s" onClick={onClick}>Open verification<ChevronRight size={12} /></button>}</div>; };

/* ═════════ FILE: src/components/xrd/sections/Overview.jsx ═════════ */
const Ring = ({ pct }) => (
  <svg viewBox="0 0 130 130" width="100%" height="100%" role="img" aria-label={pct + "% verified"}>
    <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
    <circle cx="65" cy="65" r="56" fill="none" stroke="#a3e635" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct * 3.52} 352`} transform="rotate(-90 65 65)" style={{ filter: "drop-shadow(0 0 8px #a3e635)" }} />
    <text x="65" y="62" textAnchor="middle" fill="#e9f1e4" fontSize="28" fontWeight="800">{pct}%</text><text x="65" y="82" textAnchor="middle" fill="#7e8b78" fontSize="11">verified</text>
  </svg>
);
/* Photos per platform. Colours stand in for the real image; set img to a URL later and render it as the avatar background. */
const PIMG = { i11: ["#2dd4bf", "#0f766e"], i1: ["#9aa4b2", "#2d333b"], i2: ["#60a5fa", "#1d4ed8"], i3: ["#e5e7eb", "#4b5563"], i4: ["#60a5fa", "#1e3a8a"], i5: ["#f0abfc", "#fb7185"], i6: ["#c4b5fd", "#6d28d9"] };
const PORDER = ["i11", "i1", "i2", "i3", "i4", "i5", "i6"];
function ProfileImages({ ids, own, pct, onClose, go }) {
  const list = PORDER.map((id) => ids.find((i) => i.id === id)).filter((i) => i && (own || ["Verified", "Connected"].includes(i.s)));
  const ok = list.filter((i) => i.s === "Verified").length + 1, total = list.length + 1;
  return (
    <div className="mod fsm pim" onClick={onClose}><div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Profile images across platforms">
      <div className="row"><div className="fl"><h3 style={{ margin: 0, fontSize: 18 }}>Profile images</h3><div className="xs mu">Every photo linked to {own ? "your" : "this"} identity, by platform.</div></div><button className="ib" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
      <div className="pim-main">
        <div className="ova sm"><span className="ova-ring" /><span className="ova-in">{ME.name[0]}</span></div>
        <div className="fl" style={{ minWidth: 150 }}><span className="chip g"><BadgeCheck size={11} />Main image</span><div className="b" style={{ fontSize: 17, marginTop: 6 }}>Xeevia</div><div className="sm mu">This is the photo people see first. Other platforms are shown as they provide them.</div></div>
        <div className="ovr"><Ring pct={pct} /></div>
      </div>
      <div className="xs mu mono" style={{ letterSpacing: ".1em", margin: "0 0 10px" }}>ACROSS CONNECTED PLATFORMS · {list.length}</div>
      <div className="pim-g">{list.map((i) => { const g = PIMG[i.id], off = i.s === "Disconnected", c = HEX[IC[i.s]];
        return (
          <button key={i.id} className={`pit ${off ? "off" : ""}`} style={{ "--c": c }} onClick={() => { onClose(); go("Identity"); }} aria-label={`${i.n}, ${i.s}`}>
            <span className="pit-i"><span className="pit-a" style={{ "--g1": g[0], "--g2": g[1] }}>{ME.name[0]}</span><span className="pit-b"><i.ic size={13} /></span></span>
            <b>{i.n}</b><small className="mono">{i.a}</small><span className={`chip ${IC[i.s]}`}>{i.s}</span>
          </button>); })}</div>
      <div className="pim-bar" aria-hidden="true"><i style={{ background: "#a3e635" }} />{list.map((i) => <i key={i.id} style={{ background: HEX[IC[i.s]], opacity: i.s === "Disconnected" ? 0.35 : 1 }} />)}</div>
      <div className="sm"><b>{ok} of {total}</b> <span className="mu">platforms verified</span></div>
      <div className="sys sm" style={{ margin: "14px 0" }}>Photos come straight from each platform. A connected account proves control of it; a verified one has a second proof.</div>
      {own && <button className="btn p" onClick={() => { onClose(); go("Sources"); }}><Link2 size={14} />Connect another platform</button>}
    </div></div>
  );
}
function Overview({ own, vis, hid, vr, ev, go, ids }) {
  const [imgs, setImgs] = useState(false);
  const ver = vis.filter((r) => r.ok).length, pct = Math.round((ver / Math.max(vis.length, 1)) * 100), pcnt = PORDER.filter((id) => ids.some((i) => i.id === id && (own || ["Verified", "Connected"].includes(i.s)))).length + 1;
  const Q = [["WHO?", "Identity & connected accounts", "Identity", Fingerprint], ["WHAT?", "Records and what they claim", "Records", ScrollText], ["WHEN?", "History and activity", "Activity", Clock], ["WHERE FROM?", "Source of every record", "Graph", Link2], ["WHO CAN ATTEST?", "Authority & permissions", "Remarks", Users], ["WHAT EVIDENCE EXISTS?", `${ev.length} evidence items`, "Evidence", FileText], ["IS IT VERIFIED?", `${ver} of ${vis.length} verified`, "Verification", ShieldCheck], ["CAN IT BE TRACED?", "Follow any chain", "Chains", GitBranch]];
  return (<>
    <div className="pn row bg-grid glow ovh">
      <div className="ovp">
        <div className="ova"><span className="ova-ring" /><span className="ova-in">{ME.name[0]}</span>
          <button className="ova-btn" onClick={() => setImgs(true)} aria-label={`View ${pcnt} profile images across connected platforms`}><Images size={19} strokeWidth={2.2} /><span className="ova-n">{pcnt}</span><span className="ova-tip">{pcnt} profile images</span></button></div>
        <div className="ovr"><Ring pct={pct} /></div>
      </div>
      <div className="fl ovt"><div className="chip g"><BadgeCheck size={11} />{own ? "Owner view" : "Public view"}</div><h1 className="ovn">{ME.name}</h1><div className="mu">My profile tells people who I am. My XRD shows what I can demonstrate.</div>
        <div className="ovb"><button className="btn p" onClick={() => go("Records")}>Browse records</button><button className="btn" onClick={() => go("XRC Oracle")}><Sparkles size={14} />Ask <span className="dsk">XRC&nbsp;</span>Oracle</button></div></div>
    </div>
    <div className="g4" style={{ margin: "14px 0" }}>{[[vis.length, "Records shown"], [ver, "Verified"], [vr.length, "Remarks"], [ev.length, "Evidence items"]].map(([n, l]) => <div className="stat" key={l}><b>{n}</b><span className="xs mu">{l}</span></div>)}</div>
    {!own && hid > 0 && <div className="sys row" style={{ marginBottom: 14 }}><Lock size={16} /><span className="fl sm">{hid} more record{hid > 1 ? "s exist" : " exists"} but the owner has restricted {hid > 1 ? "them" : "it"}. Open a record to request access.</span></div>}
    <div className="pn" style={{ marginBottom: 14 }}><h3>What this record can answer</h3><div className="qg">{Q.map(([q, d, s, I]) => <button key={q} className="qc" onClick={() => go(s)}><span className="qc-t"><span className="ico"><I size={16} /></span><span className="qc-go"><ChevronRight size={14} strokeWidth={2.4} /></span></span><span className="qc-b"><span className="qc-q">{q}</span><span className="qc-d">{d}</span></span></button>)}</div></div>
    <div className="pn" style={{ marginBottom: 14 }}><div className="hrow"><h3 className="fl">Needs attention</h3><button className="btn s" onClick={() => go("Verification")}>All states</button></div><div className="col">{vis.filter((r) => ["MISMATCH", "REVOKED", "EXPIRED", "DISPUTED", "SOURCE UNAVAILABLE"].includes(r.st)).slice(0, 5).map((r) => <RecRow key={r.id} r={r} own={false} onClick={() => go("Verification", r.id)} />)}</div></div>
    <div className="pn" style={{ marginBottom: 14 }}><div className="hrow"><h3 className="fl">Selected records</h3><button className="btn s" onClick={() => go("Records")}>See all</button></div><div className="col">{vis.slice(0, 4).map((r) => <RecRow key={r.id} r={r} own={own} onClick={() => go("Records", r.id)} />)}</div></div>
    {imgs && <ProfileImages ids={ids} own={own} pct={pct} onClose={() => setImgs(false)} go={go} />}
    <div className="pn"><div className="hrow"><h3 className="fl">Latest remarks</h3><button className="btn s" onClick={() => go("Remarks")}>See all</button></div>{vr.slice(0, 2).map((m) => <div key={m.id} className="row" style={{ padding: "8px 0" }}><span className={`chip ${TYPES[m.type][0]}`}>{m.type}</span><span className="fl sm tr">{m.by} · {m.auth}</span><button className="btn s" onClick={() => go("Remarks")}>Open</button></div>)}</div>
  </>);
}
const RecRow = ({ r, own, onClick }) => <button className="rec rr" style={{ "--t": HEX[ST[r.st].c] }} onClick={onClick}><div className="ico"><r.ic size={18} /></div><div className="fl"><div className="b tr">{r.t}</div><div className="xs mu tr">{r.k} · {r.s}</div></div><span className="rr-c"><St s={r.st} />{own && <span className={`chip ${VC(r.v)}`}>{r.v}</span>}</span></button>;

/* ═════════ FILE: src/components/xrd/sections/Records.jsx ═════════ */
const SECI = { Claim: FileText, "Subject, issuer and source": Fingerprint, Provenance: GitBranch, Evidence: FileText, Relationships: Network, Verification: ShieldCheck, Remarks: MessageSquareQuote, History: Clock, Permissions: Lock, Chain: Link2, "Verification checks": ShieldCheck, Discrepancy: AlertTriangle, "Issuer status": Ban, "Run details": ScrollText, "Evidence used": FileText, "Source information": Link2, "Verification history": Clock, "Source identity": Fingerprint, Capabilities: Layers, Manage: SettingsIcon, "Connection history": Clock };
const Sec = ({ t, n, open = false, tone = "", children }) => {
  const [o, setO] = useState(open), [ov, setOv] = useState(open), I = SECI[t] || Layers;
  useEffect(() => { if (!o) { setOv(false); return; } const x = setTimeout(() => setOv(true), 320); return () => clearTimeout(x); }, [o]);
  return (<section className={`sec ${o ? "open" : ""} ${ov ? "ov" : ""} ${tone ? "st-" + tone : ""}`}><button className="sec-h" onClick={() => setO(!o)} aria-expanded={o}><span className="sec-i"><I size={15} /></span><span className="b fl">{t}</span>{n != null && <span className="chip mono">{n}</span>}<span className="sec-x"><ChevronDown size={14} /></span></button><div className="sec-b"><div><div className="sec-p">{children}</div></div></div></section>);
};
const KT = (v) => (typeof v !== "string" ? null : /^(Revoked|Failed|Expired|Mismatch)/i.test(v) ? "r" : /^(Verified|Active|Valid|Signature valid|Passed|Intact|Connected)/i.test(v) ? "g" : /^(Pending|Contested|Disputed|Sync failed)/i.test(v) ? "o" : null);
const KV = ({ v }) => <div className="kvl">{v.map(([k, x]) => { const t = KT(x); return <div key={k} className="kvr"><span className="kvk mono">{k}</span><span className="kvd" /><span className="kvv">{t ? <span className={`chip ${t}`}><i className="kdot" />{x}</span> : x}</span></div>; })}</div>;
function Records({ own, vis, hid, ev, vr, recs, setRecs, sel, go, back, setComp, setShare, req, setReq }) {
  const [f, setF] = useState("All"), [sf, setSf] = useState("All");
  const kinds = ["All", ...new Set(vis.map((r) => r.k))];
  const r = vis.find((x) => x.id === sel);
  if (r) {
    const re = ev.filter((e) => e.rec === r.id), rm = vr.filter((m) => m.rec === r.id), x = ST[r.st], idn = IDN.find((i) => i.n === r.src) || IDN[0], src = SRCS.find((s) => s.n === r.src);
    const rel = [["subject", ME.name], ["issued_by", r.iss], ["sourced_from", r.src], ["bound_via", idn.n + " · " + idn.a], ...rm.map((m) => ["attested_by", m.by + " (" + m.type.toLowerCase() + ")"])];
    return (<div className="fsv" style={{ position: "static", padding: 0, background: "none" }}>
      <button className="btn s" onClick={back} style={{ marginBottom: 14 }}><ArrowLeft size={13} />Back</button>
      <div className="pn bg-grid" style={{ padding: 20, marginBottom: 10 }}>
        <div className="row"><div className="hexf" style={{ "--t": HEX[x.c] }}><div><r.ic size={22} /></div></div><div className="fl"><div className="row" style={{ flexWrap: "wrap", gap: 6 }}><span className="chip">{r.k}</span><span className="chip mono">{r.id}</span></div><h1 style={{ margin: "6px 0 0", fontSize: 24, letterSpacing: "-.02em" }}>{r.t}</h1><div className="mu sm">{r.s}</div></div></div>
        <div style={{ marginTop: 16 }}><Banner r={r} /></div>
        <button className="vbtn" onClick={() => go("Verification", r.id)}><span className="vbtn-i"><ShieldCheck size={22} /></span><span className="fl"><b>Verify with XRC</b><small>RE-CHECK AGAINST {r.src.toUpperCase()}</small></span><ChevronRight size={18} /></button>
        <div className="dock" style={{ marginTop: 10 }}>{[[FileText, "Evidence", () => go("Evidence", r.id), re.length], [GitBranch, "Chain", () => go("Chains", r.id)], [MessageSquareQuote, "Remarks", () => go("Remarks"), rm.length], [Share2, "Share", () => setShare(r)], [Sparkles, "Ask Oracle", () => go("XRC Oracle")]].map(([I, l, fn, cnt]) => <button key={l} className="act" onClick={fn}><I size={17} />{l}{cnt != null && <span className="chip mono nb">{cnt}</span>}</button>)}</div>
      </div>
      <Sec t="Claim" open><p style={{ margin: 0, fontSize: 15 }}>{r.claim}</p><div className="xs mu" style={{ marginTop: 8 }}>This is what the record establishes. It is not proof of anything beyond what the source confirmed.</div></Sec>
      <Sec t="Subject, issuer and source" open><KV v={[["Subject", ME.name + " · XRC identity"], ["Issuer", r.iss], ["Source", r.src + (src ? " · " + src.state : "")], ["Record type", r.k], ["Record ID", r.id], ["Created", r.d]]} /></Sec>
      <Sec t="Provenance"><div className="chain" style={{ marginTop: 6 }}>{[["Source", r.src], ["Source response", runOf(r).resp], ["Evidence", `${re.length} item${re.length !== 1 ? "s" : ""}`], ["Identity binding", idn.n + " · " + idn.lv], ["XRC record", r.id]].map(([k, v]) => <div key={k}><div className="xs mu">{k.toUpperCase()}</div><div>{v}</div></div>)}</div></Sec>
      <Sec t="Evidence" n={re.length}>{re.map((e) => <button key={e.id} className="mini" onClick={() => go("Evidence", e.id)}><FileText size={13} className="ac" /><span className="fl tr">{e.t}</span><span className="chip">{e.src}</span><ChevronRight size={14} className="mu" /></button>)}{!re.length && <span className="mu">No evidence visible to you.</span>}</Sec>
      <Sec t="Relationships" n={rel.length}>{rel.map(([a, b], i) => <div key={i} className="row" style={{ padding: "6px 0" }}><span className="chip mono">{a}</span><span className="fl">{b}</span></div>)}</Sec>
      <Sec t="Verification" open><div className="row" style={{ flexWrap: "wrap" }}><St s={r.st} full /><span className="fl" /><button className="btn s" onClick={() => go("Verification", r.id)}>Open verification</button></div><div className="sm mu" style={{ marginTop: 8 }}>Last verified: {r.ver || "never"} · {x.m}</div></Sec>
      <Sec t="Remarks" n={rm.length}>{rm.map((m) => <div key={m.id} className="row" style={{ padding: "6px 0" }}><span className={`chip ${TYPES[m.type][0]}`}>{m.type}</span><span className="fl tr sm">{m.by} · {m.auth}</span></div>)}{!rm.length && <span className="mu">No remarks on this record.</span>}<div style={{ marginTop: 10 }}><button className="btn s" onClick={() => go("Remarks")}>Open remarks</button> <button className="btn s" onClick={() => setComp(r)}><Plus size={12} />Add remark</button></div></Sec>
      <Sec t="History" n={r.hist.length}><div className="chain" style={{ marginTop: 6 }}>{r.hist.map(([d, e], i) => <div key={i}><div className="xs mu">{d}</div><div>{e}</div></div>)}</div></Sec>
      <Sec t="Permissions"><KV v={[["Who can see it", r.v], ["Who can open the evidence", [...new Set(re.map((e) => e.acc))].join(", ") || "—"], ["Who can attest to it", ATT[r.k]], ["Owner", "Controls presentation and sharing"], ["System", "Keeps audit and verification history"]]} />
        {own && <div style={{ marginTop: 12 }}><Dd label="Visibility" v={r.v} o={VIS.map((v) => [v, v])} set={(v) => setRecs(recs.map((x) => (x.id === r.id ? { ...x, v } : x)))} /></div>}</Sec>
      <Sec t="Chain"><p className="mu" style={{ marginTop: 0 }}>Trace this record from its source to its current status.</p><button className="btn p s" onClick={() => go("Chains", r.id)}><GitBranch size={13} />Open chain</button></Sec>
      <div className="stkpad" /><div className="stk"><button className="btn p" onClick={() => go("Verification", r.id)}>Verify with XRC</button><button className="btn" onClick={() => setShare(r)}>Share</button></div>
    </div>);
  }
  const list = vis.filter((x) => (f === "All" || x.k === f) && (sf === "All" || x.st === sf));
  return (<>
    <Head t="Records" s={own ? "Everything in your evidence graph. Visibility is shown on each record." : "Records the owner has made public."} />
    <div className="ddr"><Dd filter label="Type" v={f} o={kinds.map((k) => [k, k === "All" ? "All records" : k, pl(vis.filter((r) => k === "All" || r.k === k).length, "record")])} set={setF} />
      <Dd filter label="Status" v={sf} o={[["All", "Any status", pl(vis.length, "record")], ...Object.keys(ST).filter((k) => k === sf || vis.some((r) => r.st === k)).map((k) => [k, tc(k), pl(vis.filter((r) => r.st === k).length, "record"), HEX[ST[k].c]])]} set={setSf} /></div>
    {(f !== "All" || sf !== "All") && <div className="fsum"><span>Showing <b>{list.length}</b> of {vis.length} records</span><button className="btn s" onClick={() => { setF("All"); setSf("All"); }}><X size={12} />Clear filters</button></div>}
    <div className="col">{list.map((x) => <RecRow key={x.id} r={x} own={own} onClick={() => go("Records", x.id)} />)}{!list.length && <div className="pn mu">No records match these filters.</div>}</div>
    {!own && hid > 0 && <div className="sys row" style={{ marginTop: 14 }}><Lock size={16} /><span className="fl sm">{hid} restricted record{hid > 1 ? "s" : ""} not shown.</span><button className="btn s" disabled={req.all} onClick={() => setReq({ ...req, all: 1 })}>{req.all ? "Access requested" : "Request access"}</button></div>}
  </>);
}
function ShareSheet({ r, onClose }) {
  const [cp, setCp] = useState(false);
  return (<div className="mod fsm" onClick={onClose}><div onClick={(e) => e.stopPropagation()}><div className="row"><h3 className="fl" style={{ margin: 0, fontSize: 18 }}>Share record</h3><button className="ib" onClick={onClose}><X size={16} /></button></div>
    <div className="b" style={{ margin: "16px 0 4px" }}>{r.t}</div><div className="sm mu">{r.k} · {r.id}</div>
    <div className="row mono sm" style={{ margin: "14px 0", padding: 12, border: "1px solid var(--bd)", borderRadius: 12 }}><span className="fl tr">xeevia.app/{ME.handle}/xrd/{r.id}</span><button className="btn s" onClick={() => setCp(true)}><Copy size={12} />{cp ? "Copied" : "Copy"}</button></div>
    {r.v !== "PUBLIC" ? <div className="sys sm row"><Lock size={16} /><span className="fl">This record is {r.v.toLowerCase()}. People with the link will see a locked entry, not its content.</span></div> : <div className="sys sm">People with the link can view this record, run verification and open public evidence. They cannot see your private records.</div>}</div></div>);
}
function Kind(k, title, I) { return function KindView(c) { const l = c.vis.filter((r) => r.k === k); return (<><Head t={title} s={`${l.length} ${title.toLowerCase()} on this record.`} /><div className="col">{l.map((r) => <RecRow key={r.id} r={r} own={c.own} onClick={() => c.go("Records", r.id)} />)}{!l.length && <div className="pn mu">Nothing to show here yet.</div>}</div></>); }; }

/* ═════════ FILE: src/components/xrd/sections/Evidence.jsx ═════════ */
function Blk({ b }) {
  if (b.k === "stats") return <div className="g3">{b.v.map(([n, l]) => <div className="stat" key={l}><b>{n}</b><span className="xs mu">{l}</span></div>)}</div>;
  if (b.k === "bar") return <div><div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 }}>{b.v.map(([n, p, c]) => <div key={n} style={{ width: p + "%", background: c }} />)}</div><div className="row xs mu" style={{ flexWrap: "wrap", marginTop: 8, gap: 14 }}>{b.v.map(([n, p, c]) => <span key={n}><span style={{ color: c }}>●</span> {n} {p}%</span>)}</div></div>;
  if (b.k === "table") return <div style={{ overflowX: "auto" }}><table className="tb"><thead><tr>{b.h.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{b.r.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 && /^[0-9a-f]{7}$/.test(c) ? "mono ac" : ""}>{c}</td>)}</tr>)}</tbody></table></div>;
  if (b.k === "doc") return <div><div className="b" style={{ fontSize: 18, marginBottom: 8 }}>{b.t}</div>{b.p.map((p) => <p key={p} className="mu" style={{ margin: "0 0 10px" }}>{p}</p>)}</div>;
  if (b.k === "kv") return <KV v={b.v} />;
  if (b.k === "hex") return <div><div className="xs mono mu" style={{ letterSpacing: ".1em", marginBottom: 6 }}>SIGNATURE · HEX</div><div className="mono xs" style={{ wordBreak: "break-all", color: "#a3e635", background: "#000", border: "1px solid var(--bd)", borderLeft: "3px solid #a3e635", borderRadius: 10, padding: 12, lineHeight: 1.7 }}>{b.v}</div></div>;
  if (b.k === "cert") return <div className="paper"><div style={{ fontSize: 12, letterSpacing: ".2em" }}>{b.u.toUpperCase()}</div><div style={{ fontSize: 22, margin: "10px 0" }}>Certificate of Award</div><div style={{ fontSize: 12 }}>This is to certify that</div><div style={{ fontSize: 20, fontStyle: "italic", margin: "8px 0" }}>{b.n}</div><div style={{ fontSize: 13 }}>has been awarded the degree of<br /><b>{b.a}</b></div><div style={{ fontSize: 11, marginTop: 14 }}>{b.y} · Registry no. {b.no}</div></div>;
  return <div className="bg-scan" style={{ padding: 4 }}><div className="redb" style={{ width: "50%", marginBottom: 12 }} />{[95, 88, 92, 70, 90, 60].map((w, i) => <div key={i} className="redb" style={{ width: w + "%", marginBottom: 9 }} />)}<div className="chip r" style={{ marginTop: 6 }}>CONFIDENTIAL · content redacted in preview</div></div>;
}
function Evidence({ own, ev, recs, rms, req, setReq, sel, go, back }) {
  const all = own ? EV : ev;
  const e = sel && sel[0] === "e" ? EV.find((x) => x.id === sel) : null;
  const m = sel && sel[0] === "m" ? rms.find((x) => x.id === sel) : null;
  const rid = m ? m.rec : sel && sel[0] === "r" ? sel : null;
  const rr = recs.find((r) => r.id === (e ? e.rec : rid));
  let list = rid ? all.filter((x) => x.rec === rid) : all;
  if (m) list = list.slice(0, Math.max(m.ev, 1));
  const title = e ? e.t : m ? "Evidence for this remark" : rid ? "Evidence" : null;
  const sub = e ? `${e.src} · supports ${rr.t}` : m ? `${m.by} · ${M_T(m)}` : rid ? rr.t : "";
  const head = title ? <div className="fsh"><button className="ib" onClick={back} aria-label="Back"><ArrowLeft size={16} /></button><div className="fl"><div className="b tr" style={{ fontSize: 17 }}>{title}</div><div className="xs mu tr">{sub}</div></div></div> : <Head t="Evidence" s="Every item that supports a record, with where it came from." />;
  const Row = ({ x }) => { const lock = x.acc !== "PUBLIC" && !own; return (
    <button className="rec rr" style={{ "--t": HEX[VC(x.acc)] }} onClick={() => go("Evidence", x.id)}><div className="ico"><FileText size={18} /></div><div className="fl"><div className="b tr">{lock ? "Restricted evidence" : x.t}</div><div className="xs mu tr">{lock ? "Visible to approved viewers only" : `${x.f} · from ${x.src}`}</div></div><span className="rr-c"><span className={`chip ${VC(x.acc)}`}>{lock ? <Lock size={10} /> : null}{x.acc}</span></span></button>); };
  if (e) {
    const lock = e.acc !== "PUBLIC" && !own, nrm = rms.filter((x) => x.rec === e.rec).length;
    return (<div className={sel ? "fsv" : ""}>{head}
      {lock ? <div className="pn bg-scan" style={{ textAlign: "center", padding: 36 }}><Lock size={30} className="mu" /><h3 style={{ marginTop: 12 }}>This evidence is restricted</h3><p className="mu sm">The owner has limited who can open it. Ask for access and they will be notified.</p><button className="btn p" disabled={req[e.id]} onClick={() => setReq({ ...req, [e.id]: 1 })}>{req[e.id] ? "Access requested" : "Request access"}</button></div> : <>
        <div className="row" style={{ flexWrap: "wrap", marginBottom: 14 }}><span className="chip bl">{e.src}</span><span className={`chip ${VC(e.acc)}`}>{e.acc}</span><span className="chip g"><Check size={10} />Source confirmed</span></div>
        {WARNST.includes(rr.st) && <Banner r={rr} onClick={() => go("Verification", rr.id)} />}
        <div className="vw"><div className="vwt bg-dots"><span className="vdots"><i /><i /><i /></span><span className="fl tr mono">{e.f}</span><span>1 / 1</span><Download size={15} /></div><div className="vwb bg-circuit">{e.b.map((b, i) => <Blk key={i} b={b} />)}</div><div className="vwf mono"><span><span className="live" />CAPTURED {e.d.toUpperCase()}</span><span>CONFIRMED BY {e.by.toUpperCase()}</span></div></div>
        <div className="pn" style={{ marginTop: 14 }}><h3>Provenance</h3>
          <KV v={[["Source", e.src], ["Captured", e.d], ["Confirmed by", e.by], ["SHA-256", <span className="mono xs">{hx(e.id + e.f) + hx(e.t).slice(2) + "…"}</span>], ["Supports", rr.t], ["Remarks on record", String(nrm)]]} />
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}><button className="btn p" onClick={() => go("Chains", rr.id)}><GitBranch size={14} />View chain</button><button className="btn" onClick={() => go("Records", rr.id)}>Open record</button></div></div></>}
    </div>);
  }
  return (<div className={sel ? "fsv" : ""}>{head}<div className="col">{list.map((x) => <Row key={x.id} x={x} />)}{!list.length && <div className="pn mu">No evidence visible.</div>}</div>
    {m && <div className="sys sm" style={{ marginTop: 14 }}>{m.ev} supporting record{m.ev !== 1 ? "s" : ""} submitted by {m.by} under {m.auth}.</div>}</div>);
}

/* ═════════ FILE: src/components/xrd/sections/Graph.jsx ═════════ */
/* Polar layout: ring 0 = you, ring 1 = identities and institutions, ring 2 = records, ring 3 = evidence and remarks. Angles in degrees, 0 = right, clockwise. */
const GC = { x: 420, y: 290 }; // keep in sync with .gsweep transform-origin in the CSS
const GR = [null, [138, 95], [254, 175], [355, 245]];
const gp = (ring, a) => (ring ? [GC.x + Math.cos((a * Math.PI) / 180) * GR[ring][0], GC.y + Math.sin((a * Math.PI) / 180) * GR[ring][1]] : [GC.x, GC.y]);
const gq = (a, b, k = 0.12) => [(a[0] + b[0]) / 2 - (b[1] - a[1]) * k, (a[1] + b[1]) / 2 + (b[0] - a[0]) * k];
const GN = [["E", "Emmanuel", "Person", 0, 0, Fingerprint], ["gh", "GitHub", "Identity", 1, -50, GitBranch], ["li", "LinkedIn", "Identity", 1, -110, Briefcase], ["self", "Self", "Identity", 1, 110, ShieldCheck], ["fu", "Federal Univ.", "Institution", 1, 200, GraduationCap], ["sg", "Sproutlight", "Organization", 1, 150, Briefcase], ["xl", "Xeevia Labs", "Organization", 1, 40, Layers], ["r3", "B.Sc. CS", "Credential", 2, 200, GraduationCap], ["r2", "CEO role", "Employment", 2, 150, Briefcase], ["r1", "Xeevia", "Project", 2, 5, FolderGit2], ["r11", "OSS work", "Contribution", 2, -50, GitBranch], ["r9", "Sprouts", "Community", 2, 80, Users], ["r8", "Top Creator", "Achievement", 2, -72, Award], ["ev1", "Repo evidence", "Evidence", 3, -8, FileText], ["m1", "Remark", "Remark", 3, 30, MessageSquareQuote]];
const LAYER = { Person: "Identity", Identity: "Identity", Credential: "Records", Employment: "Records", Project: "Records", Contribution: "Records", Evidence: "Evidence", Institution: "Relationships", Organization: "Relationships", Community: "Relationships", Remark: "Relationships", Achievement: "Reputation" };
const LAYERS = [["Identity", "Who it belongs to"], ["Records", "What is established"], ["Evidence", "What supports it"], ["Relationships", "How it connects"], ["Reputation", "What history emerges"]];
const LCOL = { Identity: "#60a5fa", Records: "#a3e635", Evidence: "#d4d8d2", Relationships: "#fbbf24", Reputation: "#f0abfc" };
const GID = { gh: "i1", li: "i2", self: SELF_ID, fu: "i6" };
const GBASE = { Person: "#a3e635", Evidence: "#d4d8d2", Remark: "#fbbf24", Organization: "#c4b5fd" };
const GALERT = ["DISPUTED", "MISMATCH", "REVOKED"];
const GE = [["E", "fu", "studied_at", "The registry record binds Emmanuel to Federal University enrolment."], ["fu", "r3", "issued_by", "Federal University issued the B.Sc. record."], ["E", "sg", "worked_at", "A LinkedIn position and the company registration link Emmanuel to Sproutlight-Group."], ["sg", "r2", "verified_by", "Sproutlight-Group HR confirmed the CEO role."], ["E", "r1", "founded", "The team record and repository history show Emmanuel as founder."], ["xl", "r1", "issued_by", "Xeevia Labs is the issuing organisation of the Xeevia project record."], ["r1", "ev1", "supported_by", "The repository, documentation and team record support this project claim."], ["r1", "m1", "attested_by", "A project administrator filed a correction. It is contested, not resolved."], ["E", "gh", "connected_to", "GitHub account bound through OAuth and a proof gist."], ["gh", "r11", "created_by", "Commits and pull requests on GitHub produced this contribution record."], ["E", "li", "connected_to", "LinkedIn account bound through OAuth."], ["E", "self", "", ""], ["E", "r9", "member_of", "Xeevia confirms Emmanuel as founder and admin of Infinite Sprouts."], ["E", "r8", "participated_in", "Discovery ranking logged by the platform."]];
const TC = { Person: "#a3e635", Identity: "#60a5fa", Institution: "#c4b5fd", Organization: "#fbbf24", Evidence: "#8a918a", Remark: "#fbbf24", Community: "#2dd4bf" };
const hexp = (x, y, r) => [0, 1, 2, 3, 4, 5].map((k) => { const a = ((60 * k - 90) * Math.PI) / 180; return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
function GShape({ t, x, y, c, on }) {
  const p = { fill: "#030503", stroke: c, strokeWidth: on ? 3 : 2, className: "gsh" };
  if (t === "Person") return <><polygon points={hexp(x, y, 38)} fill="none" stroke={c} strokeOpacity=".4" /><polygon points={hexp(x, y, 30)} fill={c} stroke={c} strokeWidth="2" className="gsh" /></>;
  if (t === "Identity") return <><circle cx={x} cy={y} r="26" fill="none" stroke={c} strokeOpacity=".35" strokeDasharray="2 4" /><circle cx={x} cy={y} r="19" {...p} /></>;
  if (t === "Institution") return <polygon points={`${x},${y - 24} ${x + 24},${y} ${x},${y + 24} ${x - 24},${y}`} {...p} />;
  if (t === "Organization") return <rect x={x - 19} y={y - 19} width="38" height="38" rx="10" {...p} />;
  if (t === "Evidence") return <><path d={`M${x - 14} ${y - 18}h19l9 9v27h-28z`} {...p} /><path d={`M${x + 5} ${y - 18}v9h9`} fill="none" stroke={c} strokeOpacity=".6" /></>;
  if (t === "Remark") return <path d={`M${x - 17} ${y - 13}h34a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4h-20l-8 7v-7h-6a4 4 0 0 1-4-4v-16a4 4 0 0 1 4-4z`} {...p} />;
  return <polygon points={hexp(x, y, 23)} {...p} />;
}
function Graph({ own, vis, ids, go }) {
  const [h, setH] = useState(null), [hv, setHv] = useState(null), [lay, setLay] = useState("All");
  const [pan, setPan] = useState([0, 0]), [cw, setCw] = useState(840), [drag, setDrag] = useState(false);
  const box = useRef(null), ds = useRef(null), moved = useRef(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const m = () => setCw(el.clientWidth || 840); m();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", m); return () => window.removeEventListener("resize", m); }
    const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, []);
  /* The view is centred by default. On narrow screens the scale stays readable and the rest is reached by dragging. */
  const vw = cw >= 700 ? 840 : cw * 1.2, vh = (vw * 580) / 840, vx = GC.x - vw / 2 - pan[0], vy = GC.y - vh / 2 - pan[1];
  const clampP = (v) => Math.max(-700, Math.min(700, v));
  const pd = (e) => { if (e.button !== undefined && e.button !== 0) return; ds.current = { x: e.clientX, y: e.clientY, p: pan, id: e.pointerId }; moved.current = false; };
  const pm = (e) => {
    const s0 = ds.current; if (!s0) return;
    const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
    if (!moved.current) { if (Math.hypot(dx, dy) < 5) return; moved.current = true; setDrag(true); setHv(null); try { e.currentTarget.setPointerCapture(s0.id); } catch (_) {} }
    const k = vw / (e.currentTarget.clientWidth || 1);
    setPan([clampP(s0.p[0] + dx * k), clampP(s0.p[1] + dy * k)]);
  };
  const pu = () => { ds.current = null; setDrag(false); setTimeout(() => { moved.current = false; }, 0); };
  const sf = ids.find((i) => i.id === SELF_ID), selfOn = !!sf && sf.s !== "Not connected" && (own || sf.s === "Verified");
  const okN = (id) => (id === "self" ? selfOn : !/^r\d/.test(id) || vis.some((r) => r.id === id));
  const ge = GE.map((e) => (e[1] === "self" && sf ? [e[0], e[1], sf.s === "Verified" ? "verified_with" : "verification_pending", SELF_EDGE[sf.s] || ""] : e));
  const ns = GN.filter((n) => okN(n[0])), P = Object.fromEntries(ns.map((n) => [n[0], n])), es = ge.filter((e) => P[e[0]] && P[e[1]]);
  const XY = Object.fromEntries(ns.map((n) => [n[0], gp(n[3], n[4])]));
  const I = Object.fromEntries(ns.map((n) => { const rec = vis.find((r) => r.id === n[0]), idn = GID[n[0]] ? ids.find((i) => i.id === GID[n[0]]) : null; return [n[0], { rec, idn, Ic: rec ? rec.ic : n[5], c: rec ? HEX[ST[rec.st].c] : idn ? HEX[IC[idn.s]] : GBASE[n[2]] || "#8a918a", st: rec ? rec.st.toLowerCase() : idn ? idn.s.toLowerCase() : "", alert: !!rec && GALERT.includes(rec.st) }]; }));
  const adj = (id) => es.map((e, i) => [e, i]).filter(([e]) => e[0] === id || e[1] === id);
  const pick = (x) => (x && (x.k === "n" ? (P[x.id] ? x : null) : es[x.i] ? x : null)) || null;
  const sel = pick(h), fo = pick(hv) || sel;
  let litN = null, litE = null;
  if (fo && fo.k === "n") { const a = adj(fo.id); litN = new Set([fo.id, ...a.flatMap(([e]) => [e[0], e[1]])]); litE = new Set(a.map(([, i]) => i)); }
  else if (fo) { const e = es[fo.i]; litN = new Set([e[0], e[1]]); litE = new Set([fo.i]); }
  const inLay = (id) => lay === "All" || id === "E" || LAYER[P[id][2]] === lay;
  const nOn = (id) => (!litN || litN.has(id)) && inLay(id);
  const eOn = (e, i) => (!litE || litE.has(i)) && inLay(e[0]) && inLay(e[1]);
  const ec = (e) => I[(P[e[0]][3] > P[e[1]][3] ? e[0] : e[1])].c;
  const nd = sel && sel.k === "n" ? P[sel.id] : null, ed = sel && sel.k === "e" ? es[sel.i] : null;
  const tgl = (x) => setH((c) => (c && c.k === x.k && (x.k === "n" ? c.id === x.id : c.i === x.i) ? null : x));
  const key = (fn) => (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fn(); } };
  const wedge = (a0, a1) => { const p = (a) => [GC.x + 300 * Math.cos((a * Math.PI) / 180), GC.y + 300 * Math.sin((a * Math.PI) / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${GC.x} ${GC.y}L${x0.toFixed(1)} ${y0.toFixed(1)}A300 300 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z`; };
  return (<><Head t="Evidence graph" s="Identity, records, evidence, relationships and reputation — one XRC graph. Select a node or a line to see why it connects." />
    <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 10 }}>{[["All", "All layers", "#ececec", ns.length], ...LAYERS.map(([k]) => [k, k, LCOL[k], ns.filter((n) => LAYER[n[2]] === k).length])].map(([k, l, c, cnt]) => <button key={k} className="chip" aria-pressed={lay === k} style={{ cursor: "pointer", color: lay === k ? c : undefined, borderColor: lay === k ? c : undefined, background: lay === k ? "rgba(255,255,255,.06)" : undefined }} onClick={() => setLay(k)}><span style={{ color: c }}>●</span>{l} · {cnt}</button>)}</div>
    <div className="gx bg-grid bg-circuit">
      <div className="ghud mono" style={{ top: 14, left: 24, color: "#a3e635" }}><span className="live" />XRC GRAPH · LIVE</div>
      <div className="ghud mono mu" style={{ top: 14, right: 24 }}>{ns.length} NODES · {es.length} EDGES</div>
      <div style={{ position: "relative" }}><div ref={box} className={`gpan ${drag ? "drag" : ""}`} onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={pu} onClickCapture={(ev) => { if (moved.current) { ev.stopPropagation(); ev.preventDefault(); } }}><svg className="gsvg" viewBox={`${vx} ${vy} ${vw} ${vh}`} role="img" aria-label="Evidence graph" onClick={(ev) => { if (ev.target === ev.currentTarget) setH(null); }}>
        <defs>
          <radialGradient id="gcore" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#a3e635" stopOpacity=".2" /><stop offset=".55" stopColor="#10b981" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
          <radialGradient id="gvig" cx="50%" cy="50%" r="72%"><stop offset=".62" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".8" /></radialGradient>
          <filter id="gglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <ellipse cx={GC.x} cy={GC.y} rx="390" ry="275" fill="url(#gcore)" />
        {Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * 2 * Math.PI, big = i % 8 === 0, rx = GR[3][0] + 12, ry = GR[3][1] + 12, k = big ? 10 : 5; return <line key={i} x1={GC.x + Math.cos(a) * rx} y1={GC.y + Math.sin(a) * ry} x2={GC.x + Math.cos(a) * (rx + k)} y2={GC.y + Math.sin(a) * (ry + k)} stroke="#2a2d2a" strokeWidth={big ? 1.4 : 1} />; })}
        {[1, 2, 3].map((r) => <ellipse key={r} cx={GC.x} cy={GC.y} rx={GR[r][0]} ry={GR[r][1]} fill="none" stroke="#2a2d2a" strokeDasharray={r === 2 ? "2 6" : "1 5"} className={r === 2 ? "gring" : undefined} />)}
        {[["IDENTITY", 1, -80], ["RECORDS", 2, -90], ["EVIDENCE", 3, -90]].map(([t, r, a]) => { const [x, y] = gp(r, a); return <text key={t} x={x} y={y - 6} textAnchor="middle" fontSize="8" letterSpacing="2.4" fill="#5a615a" stroke="#000" strokeWidth="3" paintOrder="stroke" className="mono">{t}</text>; })}
        <rect width="840" height="580" fill="url(#gvig)" pointerEvents="none" />
        <g className="gsweep" pointerEvents="none">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <path key={i} d={wedge(i * 5, i * 5 + 5.2)} fill="#a3e635" fillOpacity={(i + 1) * 0.0125} />)}</g>
        {es.map((e, i) => { const a = XY[e[0]], b = XY[e[1]], c = gq(a, b), col = ec(e), on = eOn(e, i), isSel = sel && sel.k === "e" && sel.i === i, d = `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`, mx = 0.25 * a[0] + 0.5 * c[0] + 0.25 * b[0], my = 0.25 * a[1] + 0.5 * c[1] + 0.25 * b[1], w = e[2].length * 5.2 + 14, warn = col === "#fbbf24" || col === "#f87171";
          return <g key={i} className={`ge ${on ? "" : "gdim"}`} onClick={() => tgl({ k: "e", i })} onMouseEnter={() => setHv({ k: "e", i })} onMouseLeave={() => setHv(null)}>
            <path d={d} fill="none" stroke={col} strokeOpacity={isSel || (litE && on) ? 0.95 : 0.45} strokeWidth={isSel ? 2.4 : 1.4} strokeDasharray={warn ? "6 4" : undefined} />
            {on && <path d={d} fill="none" stroke={col} strokeWidth="2.6" className="gflow" />}
            <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
            <rect x={mx - w / 2} y={my - 7} width={w} height="14" rx="7" fill="#000" stroke={isSel ? "#a3e635" : "#2a2d2a"} />
            <text x={mx} y={my + 3} textAnchor="middle" fontSize="8.5" className="mono" fill={isSel ? "#a3e635" : on && litE ? "#d4d8d2" : "#6b726a"}>{e[2]}</text></g>; })}
        {ns.map((n) => { const [x, y] = XY[n[0]], q = I[n[0]], on = nOn(n[0]), isSel = sel && sel.k === "n" && sel.id === n[0], lo = n[2] === "Person" ? 52 : n[2] === "Evidence" ? 32 : n[2] === "Organization" ? 34 : n[2] === "Remark" ? 30 : 33, Ic = q.Ic;
          return <g key={n[0]} className={`gn ${on ? "" : "gdim"}`} tabIndex={0} role="button" aria-label={n[1]} onClick={() => tgl({ k: "n", id: n[0] })} onKeyDown={key(() => tgl({ k: "n", id: n[0] }))} onMouseEnter={() => setHv({ k: "n", id: n[0] })} onMouseLeave={() => setHv(null)} onFocus={() => setHv({ k: "n", id: n[0] })} onBlur={() => setHv(null)}>
            <circle cx={x} cy={y} r="32" fill="transparent" />
            {q.alert && <circle cx={x} cy={y} r="23" fill="none" stroke={q.c} strokeWidth="2" className="gpulse" />}
            {isSel && <circle cx={x} cy={y} r={n[2] === "Person" ? 46 : 32} fill="none" stroke={q.c} strokeDasharray="3 5" className="gring" />}
            <GShape t={n[2]} x={x} y={y} c={q.c} on={isSel} />
            {n[0] === "E" ? <text x={x} y={y + 10} textAnchor="middle" fontSize="28" fontWeight="800" fill="#041004">E</text> : <Ic x={x - 8} y={y - 8} size={16} color="#ececec" />}
            <text x={x} y={y + lo} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#e4e8e1" stroke="#000" strokeWidth="3" paintOrder="stroke">{n[1]}</text>
            {q.st && <text x={x} y={y + lo + 11} textAnchor="middle" fontSize="8" className="mono" fill={q.c} stroke="#000" strokeWidth="3" paintOrder="stroke">{q.st.slice(0, 22)}</text>}</g>; })}
      </svg></div>
      {(pan[0] !== 0 || pan[1] !== 0) && <div className="gtools"><button className="btn s" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => setPan([0, 0])}><Network size={12} />Recenter</button></div>}</div>
      <div className="row xs mu mono" style={{ padding: "8px 22px 14px", flexWrap: "wrap", gap: 14, borderTop: "1px solid #151815" }}><span>DRAG TO MOVE</span><span>SHAPE = WHAT IT IS</span><span>COLOUR = STATUS</span>{[["Verified", "#a3e635"], ["Connected", "#60a5fa"], ["Contested / expired", "#fbbf24"], ["Failed / revoked", "#f87171"], ["No source", "#8a918a"]].map(([l, c]) => <span key={l}><span style={{ color: c }}>●</span> {l}</span>)}</div>
    </div>
    <div className="pn bg-dots" style={{ marginTop: 14 }}>
      {ed ? <><div className="row" style={{ flexWrap: "wrap" }}><span className="chip g mono">{ed[2]}</span><span className="b">{P[ed[0]][1]} → {P[ed[1]][1]}</span></div><p className="mu" style={{ margin: "10px 0 0" }}>{ed[3]}</p>
        <div className="row" style={{ flexWrap: "wrap", marginTop: 12 }}><button className="btn s" onClick={() => setH({ k: "n", id: ed[0] })}>{P[ed[0]][1]}</button><button className="btn s" onClick={() => setH({ k: "n", id: ed[1] })}>{P[ed[1]][1]}</button></div></>
        : nd ? (() => { const q = I[nd[0]], rec = q.rec, rel = adj(nd[0]); return <>
          <div className="row" style={{ alignItems: "flex-start" }}><div className="ico" style={{ color: q.c, borderColor: q.c }}><q.Ic size={18} /></div><div className="fl"><div className="row" style={{ flexWrap: "wrap", gap: 6 }}><span className="chip" style={{ color: TC[nd[2]] || "#ececec" }}>{nd[2]}</span><span className="chip" style={{ color: LCOL[LAYER[nd[2]]] }}>{LAYER[nd[2]]} layer</span>{rec && <St s={rec.st} />}{q.idn && <span className={`chip ${IC[q.idn.s]}`}>{q.idn.s}</span>}</div><div className="b" style={{ fontSize: 17, marginTop: 4 }}>{nd[1]}</div></div></div>
          <div className="xs mu" style={{ letterSpacing: ".08em", margin: "14px 0 2px" }}>CONNECTIONS · {rel.length}</div>
          {rel.map(([e, i]) => <button key={i} className="mini" onClick={() => setH({ k: "e", i })}><span className="chip mono">{e[2]}</span><span className="fl tr">{P[e[0] === nd[0] ? e[1] : e[0]][1]}</span><ChevronRight size={14} className="mu" /></button>)}
          <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>{rec && <><button className="btn p s" onClick={() => go("Records", rec.id)}>Open record</button><button className="btn s" onClick={() => go("Chains", rec.id)}>View chain</button><button className="btn s" onClick={() => go("Verification", rec.id)}>Verify</button></>}{nd[0] === "ev1" && <button className="btn p s" onClick={() => go("Evidence", "r1")}>View evidence</button>}{nd[0] === "m1" && <button className="btn p s" onClick={() => go("Remarks")}>View remark</button>}{(nd[2] === "Identity" || nd[2] === "Person" || nd[2] === "Institution") && <button className="btn p s" onClick={() => go("Identity")}>View binding</button>}</div></>; })()
          : <span className="mu">Select a node for details, or a line to see why the relationship exists. Use the layer filters to focus on one part of the graph.</span>}</div></>);
}

/* ═════════ FILE: src/components/xrd/sections/Chains.jsx ═════════ */
const Nd = ({ I, tag, title, meta, tone = "", bg = "bg-circuit", onClick, id, children }) => (
  <div className={`nd ${bg} ${tone ? "t-" + tone : ""}`} role={onClick ? "button" : undefined} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
    <div className="ndi"><I size={19} /></div>
    <div className="fl"><div className="row"><span className="xs ndt">{tag}</span><span className="fl" />{id && <span className="xs mono mu">{id}</span>}</div><div className="b" style={{ fontSize: 15 }}>{title}</div>{meta && <div className="sm mu">{meta}</div>}{children}</div>
  </div>
);
const Wire = ({ c = "" }) => <div className={`wire ${c}`} />;
function Chains({ vis, vr, ev, sel, go }) {
  const r = vis.find((x) => x.id === sel) || vis[0], re = ev.filter((e) => e.rec === r.id), rm = vr.filter((m) => m.rec === r.id), dis = rm.find((m) => m.resp);
  return (<><Head t="Chains" s="Follow a record back to its source, and see every claim made about it." />
    <Dd label="Record" v={r.id} o={vis.map((x) => [x.id, x.t, x.k])} set={(id) => go("Chains", id)} />
    <div className="g4 bg-grid" style={{ marginBottom: 18, padding: 10, border: "1px solid var(--bd)", borderRadius: 16 }}>{[[dis ? 7 : 4, "Nodes"], [1, "Source"], [re.length, "Evidence"], ["Intact", "Integrity"]].map(([n, l]) => <div className="stat" key={l}><b>{n}</b><span className="xs mu">{l}</span></div>)}</div>
    <div className="xs mu" style={{ letterSpacing: ".08em", margin: "0 0 10px" }}>PROVENANCE CHAIN</div>
    <Nd I={Link2} tag="SOURCE" tone="bl" title={r.src} meta="Where the information came from" id={hx(r.src)} onClick={() => go("Sources", SRCS.find((x) => x.n === r.src)?.id)} />
    <Wire />
    <Nd I={Radio} tag="SOURCE RESPONSE" tone="bl" bg="bg-dots" title={runOf(r).resp} meta={`Issuer: ${r.iss}`} id={hx(r.id + "resp")} />
    <Wire />
    <Nd I={FileText} tag={`EVIDENCE · ${re.length}`} tone="w" bg="bg-dots" title={re.length ? "Supporting items" : "No evidence visible"} id={hx(r.id + "ev")}>{re.map((e) => <button key={e.id} className="mini" onClick={() => go("Evidence", e.id)}><FileText size={13} className="ac" /><span className="fl tr">{e.t}</span><ChevronRight size={14} className="mu" /></button>)}</Nd>
    <Wire />
    <Nd I={Fingerprint} tag="IDENTITY BINDING" tone="bl" bg="bg-dots" title={(IDN.find((i) => i.n === r.src) || IDN[0]).n + " · " + (IDN.find((i) => i.n === r.src) || IDN[0]).a} meta={(IDN.find((i) => i.n === r.src) || IDN[0]).lv} id={hx(r.id + "bind")} onClick={() => go("Identity")} />
    <Wire />
    <Nd I={r.ic} tag="RECORD" title={r.t} meta={`${r.k} · ${r.s}`} id={hx(r.id)} onClick={() => go("Records", r.id)} bg="bg-grid" />
    <Wire />
    <Nd I={ST[r.st].I} tag="VERIFICATION" tone={r.st === "VERIFIED" ? "" : r.st === "REVOKED" || r.st === "MISMATCH" ? "o" : "w"} title={ST[r.st].l} meta={`Last verified: ${r.ver || "never"}`} id={hx(r.t + "v")} onClick={() => go("Verification", r.id)} />
    {dis ? <>
      <div className="xs mu" style={{ letterSpacing: ".08em", margin: "26px 0 10px" }}>DISPUTED CLAIM</div>
      <Nd I={r.ic} tag="CLAIM" title={`${r.t} — ${r.s}`} id={hx(r.id + "c")} bg="bg-grid" />
      <Wire c="o" />
      <Nd I={MessageSquareQuote} tag={`REMARK · ${dis.type}`} tone="o" bg="bg-hatch" title={dis.by} meta={dis.auth} id={hx(dis.id)}><p style={{ margin: "8px 0 0" }}>{dis.text}</p></Nd>
      <Wire c="o" />
      <Nd I={User} tag="OWNER RESPONSE" tone="w" bg="bg-dots" title="Founder's reply" id={hx(dis.id + "r")}><p style={{ margin: "8px 0 0" }}>{dis.resp}</p></Nd>
      <Wire />
      <Nd I={FileText} tag="EVIDENCE" tone="w" bg="bg-circuit" title="Records offered" id={hx(dis.id + "e")}>{re.map((e) => <button key={e.id} className="mini" onClick={() => go("Evidence", e.id)}><FileText size={13} className="ac" /><span className="fl tr">{e.t}</span><ChevronRight size={14} className="mu" /></button>)}</Nd>
      <div className="sys bg-scan row" style={{ marginTop: 16 }}><Shield size={18} className="mu" /><div className="sm"><b>No verdict.</b> Xeevia shows the evidence and provenance. It does not decide who is correct.</div></div>
    </> : <div className="pn bg-dots mu" style={{ marginTop: 20 }}>No disputes on this record.</div>}</>);
}

/* ═════════ FILE: src/components/xrd/sections/Remarks.jsx ═════════ */
function Remarks({ own, vr, rms, setRms, setTrace, setComp, vis, req, setReq, go }) {
  const [f, setF] = useState("All");
  const respond = (id, t) => setRms(rms.map((m) => (m.id === id ? { ...m, resp: t } : m)));
  const list = vr.filter((m) => f === "All" || m.status === f);
  return (<><Head t="Remarks" s="Structured, record-linked statements from people with a verified relationship to the record. Not comments." right={!own && <button className="btn p" onClick={() => setComp(vis[0])}><Plus size={14} />Add remark</button>} />
    <div className="pn bg-dots sm" style={{ marginBottom: 16 }}><div className="mu">Every remark answers one question: what exactly are you remarking about?</div>
      {!own && <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}><Users size={15} className="mu" /><span className="fl mu">Connected to a project but without remark authority?</span><button className="btn s" disabled={req.rm} onClick={() => setReq({ ...req, rm: 1 })}>{req.rm ? "Sent to project administrator" : "Request remark access"}</button></div>}</div>
    <Dd filter label="Status" v={f} o={["All", "Published", "Contested", "Resolved"].map((x) => [x, x === "All" ? "All remarks" : x, pl(vr.filter((m) => x === "All" || m.status === x).length, "remark")])} set={setF} />
    {list.map((m) => <RemarkCard key={m.id} m={m} own={own} respond={respond} setTrace={setTrace} onEv={(id) => go("Evidence", id)} />)}
    {!list.length && <div className="pn mu">No remarks match.</div>}</>);
}
/* ═════════ FILE: src/components/xrd/RemarkParts.jsx ═════════ */
function RemarkCard({ m, own, respond, setTrace, onEv }) {
  const [t, setT] = useState("");
  return (<article className="rm"><div className="hd"><MessageSquareQuote size={13} />OFFICIAL RECORD ANNOTATION<span className={`chip ${TYPES[m.type][0]}`}>{m.type}</span><span className={`chip ${STAT[m.status]}`} style={{ marginLeft: "auto" }}>{m.status}</span></div>
    <div style={{ padding: 16 }}>
      <div className="row"><Av n={m.by} s={38} g={G[m.id.length % 6]} /><div><div className="b row" style={{ gap: 5 }}>{m.by}<BadgeCheck size={14} className="ac" /></div><div className="xs ac">{m.auth}</div></div></div>
      <blockquote>{m.text}</blockquote>
      <div className="g2 xs mu"><div>Regarding<div style={{ color: "var(--tx)" }}>{M_T(m)}</div></div><div>Authority<div style={{ color: "var(--tx)" }}>{m.rel}</div></div><div>Evidence<div style={{ color: "var(--tx)" }}>{m.ev} supporting record{m.ev !== 1 ? "s" : ""}</div></div><div>Date<div style={{ color: "var(--tx)" }}>{m.date}</div></div></div>
      <div className="row" style={{ marginTop: 14 }}><button className="btn p s" onClick={() => setTrace(m)}><GitBranch size={13} />Trace remark</button><button className="btn s" onClick={() => onEv(m.id)}>View evidence</button></div></div>
    {m.resp && <div className="own"><div className="xs mu" style={{ letterSpacing: ".05em" }}>OWNER RESPONSE · not an authoritative remark</div><p style={{ margin: "4px 0 0" }}>{m.resp}</p></div>}
    {own && !m.resp && respond && <div className="row" style={{ padding: "0 14px 14px" }}><input className="in" value={t} onChange={(e) => setT(e.target.value)} placeholder="Respond as owner…" /><button className="btn s" disabled={!t} onClick={() => respond(m.id, t)}>Respond</button></div>}
  </article>);
}
const M_T = (m) => R0.find((r) => r.id === m.rec)?.t || "Record";
function Trace({ m, onClose }) {
  return (<div className="mod fsm" onClick={onClose}><div onClick={(e) => e.stopPropagation()}><div className="row"><h3 className="fl" style={{ margin: 0, fontSize: 18 }}>Trace remark</h3><button className="ib" onClick={onClose}><X size={16} /></button></div>
    <div className="chain" style={{ margin: "18px 0 18px 8px" }}>{m.chain.map((c) => <div key={c} className="sm">{c}</div>)}</div>
    {[["WHO MADE IT", m.by], ["WHY THEY ARE AUTHORIZED", `${m.auth} — ${m.rel}`], ["WHAT THEY REMARKED ON", M_T(m)], ["WHEN", m.date], ["WHAT EVIDENCE SUPPORTS IT", `${m.ev} supporting record${m.ev !== 1 ? "s" : ""}`], ["CURRENT STATUS", m.status]].map(([k, v]) => <div key={k} className="kv"><div className="xs mu" style={{ letterSpacing: ".06em" }}>{k}</div><div>{v}</div></div>)}</div></div>);
}
function Composer({ r, own, onClose, onPublish }) {
  const [ty, setTy] = useState("CONTEXT"), [tx, setTx] = useState(""), [ok, setOk] = useState(false), [ev, setEv] = useState(true);
  return (<div className="mod fsm" onClick={onClose}><div onClick={(e) => e.stopPropagation()}><div className="row"><h3 className="fl" style={{ margin: 0, fontSize: 18 }}>Add remark</h3><button className="ib" onClick={onClose}><X size={16} /></button></div>
    {own ? <p className="ac" style={{ color: "#fbbf24" }}>Owners can't publish authoritative remarks about their own records. Use Owner response on an existing remark. Switch to Public view to try the visitor flow.</p> : (<>
      <div className="xs mu" style={{ margin: "14px 0 4px" }}>REGARDING</div><div className="b">{r.t} <span className="chip">{r.k}</span></div>
      <div className="sys" style={{ margin: "12px 0" }}><div className="xs mu">REMARK AUTHORITY</div><div className="b">{(AUTHR[r.k] || AUTHR.Projects)[0]}</div><div className="xs mu">{r.t} · <span className="ac">View relationship</span></div></div>
      <div className="xs mu">REMARK TYPE</div><div className="row" style={{ flexWrap: "wrap", margin: "6px 0 12px" }}>{Object.keys(TYPES).map((t) => <button key={t} className={`chip ${ty === t ? TYPES[t][0] : ""}`} style={{ background: ty === t ? "rgba(255,255,255,.07)" : "none", cursor: "pointer" }} onClick={() => setTy(t)}>{t}</button>)}</div>
      <div className="xs mu" style={{ marginBottom: 6 }}>{TYPES[ty][1]}</div><textarea className="in" rows={4} value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Write the remark about this record." />
      <label className="row sm mu" style={{ margin: "10px 0" }}><input type="checkbox" checked={ev} onChange={() => setEv(!ev)} />Attach supporting evidence (2 records from my sources)</label>
      <label className="row sm" style={{ margin: "10px 0" }}><input type="checkbox" checked={ok} onChange={() => setOk(!ok)} />You are publishing this remark under your verified relationship with this record.</label>
      <button className="btn p" style={{ width: "100%", justifyContent: "center" }} disabled={!ok || tx.length < 5} onClick={() => onPublish({ id: "m" + Date.now(), rec: r.id, type: ty, by: "You (visitor)", auth: (AUTHR[r.k] || AUTHR.Projects)[0], rel: `${(AUTHR[r.k] || AUTHR.Projects)[1]} · ${r.t}`, text: tx, ev: ev ? 2 : 0, date: "Today", status: "Published", resp: null, chain: ["Remark", "Author · You", "Verified identity", "Relationship · " + (AUTHR[r.k] || AUTHR.Projects)[1], `${r.k} · ${r.t}`, "Underlying record", ev ? "Evidence · 2 records" : "No evidence attached"] })}><Send size={14} />Publish remark</button></>)}</div></div>);
}

/* ═════════ FILE: src/components/xrd/sections/Verification.jsx ═════════ */
const CK = { ok: [Check, "Passed", "#a3e635"], fail: [X, "Failed", "#f87171"], warn: [AlertTriangle, "Attention", "#fbbf24"], skip: [Clock, "Not checked", "#8a918a"] };
function Verification({ vis, recs, sel, go, back, ev }) {
  const [sf, setSf] = useState("All");
  const r = recs.find((x) => x.id === sel);
  if (r && vis.some((x) => x.id === r.id)) return <VerifRun r={r} ev={ev} go={go} back={back} />;
  const list = vis.filter((x) => sf === "All" || x.st === sf);
  return (<><Head t="Verification" s="See exactly what was checked, against which source, and why a record has its status." />
    <div className="pn" style={{ marginBottom: 16 }}><h3>What each status means</h3>{Object.entries(ST).map(([k, x]) => <div key={k} className="stl" style={{ "--t": HEX[x.c] }}><span style={{ width: 150, flex: "none" }}><St s={k} /></span><span className="fl sm mu">{x.m}</span><span className="chip mono">{vis.filter((v) => v.st === k).length}</span></div>)}</div>
    <Dd filter label="Show" v={sf} o={[["All", "All records", pl(vis.length, "record")], ...Object.keys(ST).filter((k) => k === sf || vis.some((r) => r.st === k)).map((k) => [k, tc(k), pl(vis.filter((r) => r.st === k).length, "record"), HEX[ST[k].c]])]} set={setSf} />
    <div className="col">{list.map((x) => <button key={x.id} className="rec rr" style={{ "--t": HEX[ST[x.st].c] }} onClick={() => go("Verification", x.id)}><div className="ico"><x.ic size={18} /></div><div className="fl"><div className="b tr">{x.t}</div><div className="xs mu tr">Last verified: {x.ver || "never"} · {x.src}</div></div><span className="rr-c"><St s={x.st} /></span></button>)}{!list.length && <div className="pn mu">No records in this status.</div>}</div></>);
}
function VerifRun({ r, ev, go, back }) {
  const [busy, setBusy] = useState(true), [n, setN] = useState(0), [step, setStep] = useState(0);
  useEffect(() => { setBusy(true); setStep(0); const iv = setInterval(() => setStep((k) => Math.min(k + 1, CHK.length - 1)), 150); const t = setTimeout(() => setBusy(false), 950); return () => { clearTimeout(t); clearInterval(iv); }; }, [r.id, n]);
  const v = runOf(r), x = ST[r.st], re = ev.filter((e) => e.rec === r.id), src = SRCS.find((s) => s.n === r.src), idn = IDN.find((i) => i.n === r.src) || IDN[0];
  const hist = n ? [["Just now", x.l + " (re-run)"], ...v.hist] : v.hist;
  const head = <div className="fsh"><button className="ib" onClick={back} aria-label="Back"><ArrowLeft size={16} /></button><div className="fl"><div className="b tr" style={{ fontSize: 17 }}>Verification run</div><div className="xs mu tr">{r.t} · {r.id}</div></div></div>;
  if (busy) return (<div className="fsv" style={{ position: "static", padding: 0 }}>{head}<div className="pn bg-scan"><div className="row"><span className="spin" /><div><div className="b">Contacting {r.src}…</div><div className="sm mu">Checking the record against its registered source.</div></div></div><div className="bar" style={{ marginTop: 14 }} /></div><div className="pn" style={{ marginTop: 10 }}><div className="pipe">{CHK.map((c, i) => <div key={c} className="pst" style={{ "--c": i === step ? "#a3e635" : "#4a4f4a" }}><div className="pst-i">{i === step ? <span className="spin" /> : <Clock size={13} />}</div><div className="fl"><div className={i > step ? "mu" : ""}>{c}</div></div><span className="chip mono" style={{ color: i === step ? "#a3e635" : "#6b726a" }}>{i < step ? "SENT" : i === step ? "CHECKING" : "QUEUED"}</span></div>)}</div></div></div>);
  const passed = v.checks.filter((c) => c[1] === "ok").length;
  return (<div className="fsv" style={{ position: "static", padding: 0 }}>{head}
    <div className={`vd ${x.c === "r" || x.c === "o" ? "bg-hatch" : "bg-grid"}`} style={{ "--t": HEX[x.c], marginBottom: 10 }}>
      <div className="vd-ring"><x.I size={28} /></div>
      <div className="fl"><div className="xs mono" style={{ letterSpacing: ".12em", color: HEX[x.c] }}>VERDICT</div><div className="b" style={{ fontSize: 20, letterSpacing: "-.01em" }}>{x.l}</div><p className="mu" style={{ margin: "6px 0 0" }}>{x.m} {r.ver ? `Checked against ${r.src} on ${v.ts}.` : "No verification run has completed."}</p>
        <div className="pbar">{v.checks.map(([l, st]) => <i key={l} title={l} style={{ background: CK[st][2], opacity: st === "skip" ? 0.35 : 1 }} />)}</div><div className="xs mono mu" style={{ marginTop: 6, letterSpacing: ".08em" }}>{passed}/{v.checks.length} CHECKS PASSED</div></div></div>
    <Sec t="Verification checks" n={`${passed}/${v.checks.length} passed`} open><div className="pipe">{v.checks.map(([l, st, d]) => { const [I, w, c] = CK[st]; return <div key={l} className="pst" style={{ "--c": c }}><div className="pst-i"><I size={14} /></div><div className="fl"><div>{l}</div><div className="xs mu">{d}</div></div><span className="chip mono" style={{ color: c }}>{w.toUpperCase()}</span></div>; })}</div></Sec>
    {v.disc && <Sec t="Discrepancy" tone="o" open><div style={{ overflowX: "auto" }}><table className="tb"><thead><tr><th>Field</th><th>XRD record claims</th><th>Source returned</th></tr></thead><tbody>{v.disc.map((d) => <tr key={d[0]}><td>{d[0]}</td><td>{d[1]}</td><td style={{ color: "#f87171" }}>{d[2]}</td></tr>)}</tbody></table></div><div className="sys sm" style={{ marginTop: 10 }}>XRD shows the difference. It does not decide which side is right. The registrar has filed a remark on this record.</div></Sec>}
    {r.st === "REVOKED" && <Sec t="Issuer status" tone="r" open><KV v={[["Issuer", r.iss], ["Status", "Revoked"], ["Revoked on", r.ver], ["Reason", "Issuer re-assessment"]]} /></Sec>}
    <Sec t="Run details" open><KV v={[["Record", r.t], ["Subject", ME.name], ["Issuer", r.iss], ["Source", r.src], ["Timestamp", v.ts], ["Method", v.method], ["Run ID", v.id]]} /></Sec>
    <Sec t="Provenance"><div className="chain" style={{ marginTop: 6 }}>{[["Source", r.src + (src ? " · " + src.type : ""), () => go("Sources", src?.id)], ["Source response", v.resp], ["Evidence", `${re.length} item${re.length !== 1 ? "s" : ""}`, () => go("Evidence", r.id)], ["Identity binding", idn.n + " · " + idn.lv, () => go("Identity")], ["XRC record", r.id, () => go("Records", r.id)], ["Verification result", x.l]].map(([k, t, fn]) => <div key={k}><div className="xs mu">{k.toUpperCase()}</div>{fn ? <button className="mini" style={{ marginTop: 4 }} onClick={fn}><span className="fl">{t}</span><ChevronRight size={14} className="mu" /></button> : <div>{t}</div>}</div>)}</div></Sec>
    <Sec t="Evidence used" n={re.length}>{re.map((e) => <button key={e.id} className="mini" onClick={() => go("Evidence", e.id)}><FileText size={13} className="ac" /><span className="fl tr">{e.t}</span><ChevronRight size={14} className="mu" /></button>)}{!re.length && <span className="mu">No evidence attached to this run.</span>}</Sec>
    <Sec t="Source information"><KV v={[["Source", r.src], ["Type", src ? src.type : "Xeevia platform"], ["Connection", src ? src.state : "Internal"], ["Last sync", src ? src.sync : "—"], ["Last successful verification", src ? src.lv : "—"]]} /></Sec>
    <Sec t="Verification history" n={hist.length}><div className="chain" style={{ marginTop: 6 }}>{hist.map(([d, e], i) => <div key={i}><div className="xs mu">{d}</div><div>{e}</div></div>)}</div></Sec>
    <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}><button className="btn p" onClick={() => setN(n + 1)}><RefreshCw size={14} />{r.st === "SOURCE UNAVAILABLE" ? "Retry" : r.st === "PENDING" ? "Check again" : "Run again"}</button><button className="btn" onClick={() => go("Chains", r.id)}>View chain</button><button className="btn" onClick={() => go("Records", r.id)}>Open record</button></div>
  </div>);
}

/* ═════════ FILE: src/components/xrd/sections/Identity.jsx ═════════ */
const IC = { Verified: "g", Connected: "bl", Pending: "o", Unverified: "", Disconnected: "r", "Not connected": "" };
const IG = ["All identities", "Core Identity", "Human Identity", "Connected Accounts", "Institutional Identities", "Professional Identities", "Social Identities", "Developer Identities", "Wallets", "Domains", "Identity binding history"];
const LV = { "Institutionally attested": 3, "Verified identity": 2, "Connected identity": 1 };
const arc = (cx, cy, r, a0, a1) => { const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
const Assure = ({ k, c }) => <span className="row" style={{ gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 14, height: 4, borderRadius: 2, background: i < k ? c : "#23271f" }} />)}</span>;
/* usePan — click-and-hold drag for any SVG canvas, mouse or finger. Quick taps still click; a real drag swallows the click that ends it.
   Returns the viewBox string to render, the handlers for the wrapper, and a reset. */
function usePan(vbW, vbH, cx, cy, onStart) {
  const [pan, setPan] = useState([0, 0]), [drag, setDrag] = useState(false);
  const box = useRef(null), ds = useRef(null), moved = useRef(false);
  const lim = Math.max(vbW, vbH), cl = (v) => Math.max(-lim, Math.min(lim, v));
  const end = () => { ds.current = null; setDrag(false); setTimeout(() => { moved.current = false; }, 0); };
  const h = {
    onPointerDown: (e) => { if (e.button !== undefined && e.button !== 0) return; ds.current = { x: e.clientX, y: e.clientY, p: pan, id: e.pointerId }; moved.current = false; },
    onPointerMove: (e) => {
      const s0 = ds.current; if (!s0) return;
      const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
      if (!moved.current) { if (Math.hypot(dx, dy) < 5) return; moved.current = true; setDrag(true); if (onStart) onStart(); try { e.currentTarget.setPointerCapture(s0.id); } catch (_) {} }
      const k = vbW / (e.currentTarget.clientWidth || 1);
      setPan([cl(s0.p[0] + dx * k), cl(s0.p[1] + dy * k)]);
    },
    onPointerUp: end, onPointerCancel: end,
    onClickCapture: (e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); } },
  };
  return { box, h, drag, off: pan[0] !== 0 || pan[1] !== 0, vb: `${cx - vbW / 2 - pan[0]} ${cy - vbH / 2 - pan[1]} ${vbW} ${vbH}`, reset: () => setPan([0, 0]) };
}
/* IdMap keeps its design on every screen. Wide screens use the original wide ring; narrow screens use a taller, tighter ring so every identity is on screen at a readable size. No sideways scrollbar: drag instead. */
function IdMap({ list, onPick }) {
  const [hv, setHv] = useState(null), [narrow, setNarrow] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const m = () => setNarrow((el.clientWidth || 700) < 600); m();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", m); return () => window.removeEventListener("resize", m); }
    const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, []);
  const W = narrow ? 460 : 700, H = narrow ? 400 : 330, CX = W / 2, CY = H / 2, RX = narrow ? 170 : 268, RY = narrow ? 140 : 102, n = Math.max(list.length, 1);
  const pn = usePan(W, H, CX, CY, () => setHv(null));
  const pos = (k) => { const a = (k / n) * Math.PI * 2 - Math.PI / 2; return [CX + Math.cos(a) * RX, CY + Math.sin(a) * RY]; };
  return (<div ref={wrap} className="gx bg-grid bg-circuit" style={{ marginBottom: 14 }}>
    <div className="ghud mono" style={{ top: 14, left: 24, color: "#a3e635" }}><span className="live" />IDENTITY BINDINGS</div>
    <div className="ghud mono mu" style={{ top: 14, right: 24 }}>{list.length} BOUND TO XRC</div>
    <div style={{ position: "relative" }}><div ref={pn.box} className={`gpan ${pn.drag ? "drag" : ""}`} {...pn.h}><svg className="gsvg" viewBox={pn.vb} role="img" aria-label="Identity binding map">
      <defs>
        <radialGradient id="imcore" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#a3e635" stopOpacity=".22" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <filter id="gglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <ellipse cx={CX} cy={CY} rx={RX + 62} ry={RY + 48} fill="url(#imcore)" />
      {[0.5, 0.78, 1].map((k) => <ellipse key={k} cx={CX} cy={CY} rx={RX * k} ry={RY * k} fill="none" stroke="#2a2d2a" strokeDasharray={k === 0.78 ? "2 6" : "1 5"} className={k === 0.78 ? "gring" : undefined} />)}
      {list.map((i, k) => { const [x, y] = pos(k), c = gq([CX, CY], [x, y], 0.1), col = HEX[IC[i.s]], live = i.s === "Verified" || i.s === "Connected", on = !hv || hv === i.id, d = `M${CX} ${CY}Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
        return <g key={"s" + i.id} className={on ? "" : "gdim"} pointerEvents="none"><path d={d} fill="none" stroke={col} strokeOpacity={live ? 0.55 : 0.35} strokeWidth="1.4" strokeDasharray={i.s === "Verified" || i.s === "Connected" ? undefined : "4 4"} />{live && <path d={d} fill="none" stroke={col} strokeWidth="2.4" className="gflow" />}</g>; })}
      {list.map((i, k) => { const [x, y] = pos(k), col = HEX[IC[i.s]], lvl = LV[i.lv] || 0, on = !hv || hv === i.id;
        return <g key={i.id} className={`gn ${on ? "" : "gdim"}`} tabIndex={0} role="button" aria-label={i.n + " " + i.s} onClick={() => onPick(i.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(i.id); } }} onMouseEnter={() => setHv(i.id)} onMouseLeave={() => setHv(null)} onFocus={() => setHv(i.id)} onBlur={() => setHv(null)}>
          <circle cx={x} cy={y} r="32" fill="transparent" />
          {[0, 1, 2].map((a) => <path key={a} d={arc(x, y, 26, -90 + a * 120 + 10, -90 + a * 120 + 110)} fill="none" stroke={a < lvl ? col : "#23271f"} strokeWidth="3" strokeLinecap="round" />)}
          <circle cx={x} cy={y} r="19" fill="#030503" stroke={col} strokeWidth="2" className="gsh" />
          <i.ic x={x - 8} y={y - 8} size={16} color="#ececec" />
          <text x={x} y={y + 42} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#e4e8e1" stroke="#000" strokeWidth="3" paintOrder="stroke">{i.n.slice(0, 18)}</text>
          <text x={x} y={y + 53} textAnchor="middle" fontSize="8" className="mono" fill={col} stroke="#000" strokeWidth="3" paintOrder="stroke">{i.s.toLowerCase()}</text></g>; })}
      <circle cx={CX} cy={CY} r="36" fill="none" stroke="#a3e635" strokeOpacity=".5" className="gpulse" />
      <ellipse cx={CX} cy={CY} rx="40" ry="40" fill="none" stroke="#a3e635" strokeOpacity=".35" strokeDasharray="3 7" className="gring" />
      <circle cx={CX} cy={CY} r="30" fill="#a3e635" /><text x={CX} y={CY + 5} textAnchor="middle" fill="#041004" fontSize="14" fontWeight="800">XRC</text>
    </svg></div>
    {pn.off && <div className="gtools"><button className="btn s" onPointerDown={(e) => e.stopPropagation()} onClick={pn.reset}><Network size={12} />Recenter</button></div>}</div>
    <div className="row xs mu mono" style={{ padding: "8px 22px 14px", flexWrap: "wrap", gap: 14, borderTop: "1px solid #151815" }}><span>DRAG TO MOVE</span><span>ARCS = ASSURANCE LEVEL</span><span>SOLID LINE = CONTROL PROVEN</span><span>DASHED = NOT CONFIRMED</span></div>
  </div>);
}
function Identity({ own, ids, setIds, go }) {
  const L = ids, setL = setIds;
  const [g, setG] = useState("All identities"), [o, setO] = useState(null), [cf, setCf] = useState(false);
  const base = own ? L : L.filter((i) => ["Verified", "Connected"].includes(i.s));
  const CA = ["Social Identities", "Developer Identities", "Professional Identities"];
  const list = base.filter((i) => g === "All identities" || (g === "Connected Accounts" ? CA.includes(i.g) && i.s !== "Disconnected" : i.g === g));
  const oth = base.filter((i) => i.id !== "i0");
  const cur = L.find((i) => i.id === o), self = base.find((i) => i.id === SELF_ID);
  const flip = (id) => setL((l) => l.map((i) => (i.id === id ? { ...i, s: i.s === "Disconnected" ? "Connected" : "Disconnected", h: [["Just now", i.s === "Disconnected" ? "Reconnected by owner" : "Disconnected by owner"], ...i.h] } : i)));
  /* INTEGRATION POINT — Self SDK. Starting a verification must open a Self session; a request stays "Pending" until Self returns a signed proof to Xeevia's callback, and only that callback may set "Verified". */
  const selfTo = (s, e) => { setCf(false); setL((l) => l.map((i) => (i.id === SELF_ID ? { ...i, s, lv: s === "Verified" ? "Verified identity" : "Not verified", sync: s === "Not connected" ? "Never" : "Just now", h: [["Just now", e], ...i.h] } : i))); };
  return (<><Head t="Identity" s="An identity is not an account. XRC records how each account, institution and wallet is bound to one person." />
    {self && (() => { const ok = self.s === "Verified", pend = self.s === "Pending"; return (
      <div className={`pn ${ok ? "bg-grid glow" : pend ? "bg-hatch" : "bg-dots"}`} style={{ marginBottom: 14, borderColor: ok ? "rgba(163,230,53,.45)" : undefined, borderStyle: ok || pend ? undefined : "dashed" }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="ico" style={{ width: 46, height: 46, color: ok ? "var(--ac)" : pend ? "#fbbf24" : "var(--mu)" }}><self.ic size={22} /></div>
          <div className="fl"><div className="xs mu" style={{ letterSpacing: ".08em" }}>HUMAN IDENTITY</div>
            <div className="b" style={{ fontSize: 18 }}>{ok ? "Verified with Self" : pend ? "Self verification pending" : "Not verified with Self"}</div>
            <div className="sm mu" style={{ marginTop: 2 }}>{SELF_COPY[self.s]}</div></div>
          <span className={`chip ${IC[self.s]}`}>{self.s}</span></div>
        {(ok || pend) && <div style={{ marginTop: 12 }}><KV v={[["Provider", "Self"], ["Method", self.how], [ok ? "Verified on" : "Requested", self.sync], ["Confirms", ok ? "A real person holds this XRC identity" : "Nothing yet"], ["Does not confirm", "Your records, education, employment or other accounts"]]} /></div>}
        <div className="sys sm" style={{ marginTop: 12 }}>Self helps verify an identity. Xeevia connects that identity to the wider body of records and evidence. Self is one layer, not the owner of your other identities.</div>
        <div className="row" style={{ flexWrap: "wrap", marginTop: 12 }}>
          {own && self.s === "Not connected" && <button className="btn p" onClick={() => selfTo("Pending", "Verification requested; waiting for a proof from Self")}><ShieldCheck size={14} />Verify with Self</button>}
          {own && pend && <button className="btn" onClick={() => selfTo("Not connected", "Verification request cancelled by owner")}>Cancel request</button>}
          {own && ok && <button className="btn" onClick={() => (cf ? selfTo("Not connected", "Self unlinked by owner") : setCf(true))}>{cf ? "Confirm unlink" : "Unlink Self"}</button>}
          <button className="btn" onClick={() => setO(SELF_ID)}>View binding</button>
          <button className="btn" onClick={() => go("Graph")}><Network size={14} />View in graph</button>
        </div></div>); })()}
    <IdMap list={oth} onPick={setO} />
    <div className="g2 xs mu" style={{ marginBottom: 16 }}>{[["Connected identity", "Proves control of an account only.", 1, "#60a5fa"], ["Verified identity", "Control confirmed by a second proof.", 2, "#a3e635"], ["Institutionally attested", "Confirmed by the institution itself.", 3, "#a3e635"], ["User assertion", "Stated by the owner; not confirmed.", 0, "#8a918a"]].map(([a, b, k, c]) => <div key={a} className="pn" style={{ padding: 10 }}><div className="row" style={{ marginBottom: 4 }}><div className="b fl" style={{ color: "var(--tx)" }}>{a}</div><Assure k={k} c={c} /></div>{b}</div>)}</div>
    <Dd label="Group" v={g} o={IG.map((x) => [x, x])} set={setG} />
    {g === "Identity binding history" ? <div className="pn"><div className="chain" style={{ marginTop: 6 }}>{base.flatMap((i) => i.h.map((h) => [h[0], i.n, h[1]])).map(([d, n, e], k) => <div key={k}><div className="xs mu">{d} · {n}</div><div>{e}</div></div>)}</div></div>
      : <div className="col">{list.map((i) => <button key={i.id} className="rec rr" style={{ "--t": HEX[IC[i.s]] }} onClick={() => setO(i.id)}><div className="ico"><i.ic size={18} /></div><div className="fl"><div className="b tr">{i.n}</div><div className="xs mu tr">{i.a} · {i.lv}</div></div><span className="rr-c"><span className={`chip ${IC[i.s]}`}>{i.s}</span></span></button>)}{!list.length && <div className="pn mu">No identities in this group.</div>}</div>}
    {cur && <div className="mod fsm" onClick={() => setO(null)}><div onClick={(e) => e.stopPropagation()}><div className="row"><h3 className="fl" style={{ margin: 0, fontSize: 18 }}>{cur.n}</h3><button className="ib" onClick={() => setO(null)}><X size={16} /></button></div>
      <div style={{ margin: "14px 0" }}><KV v={[["Source", cur.n], ["Account", cur.a], ["Binding status", cur.s], ["Verification level", cur.lv], ["Last synchronized", cur.sync], ["Bound by", cur.how]]} /></div>
      <div className="xs mu" style={{ marginBottom: 6 }}>BINDING HISTORY</div><div className="chain">{cur.h.map(([d, e], i) => <div key={i}><div className="xs mu">{d}</div><div>{e}</div></div>)}</div>
      <div className="sys sm" style={{ margin: "14px 0" }}>{cur.id === SELF_ID ? "Self confirms that a real person holds this identity. It does not prove any other attribute of the person." : "Connecting an account shows control of that account. It does not prove every attribute of the person."}</div>
      {own && cur.id !== "i0" && cur.id !== SELF_ID && <button className="btn" onClick={() => flip(cur.id)}>{cur.s === "Disconnected" ? "Reconnect" : "Disconnect"}</button>}</div></div>}</>);
}

/* ═════════ FILE: src/components/xrd/sections/Sources.jsx ═════════ */
const SC = { Connected: "g", "Sync failed": "o", Disconnected: "", "Authorization revoked": "r" };
function Sources({ sel, go, back }) {
  const [L, setL] = useState(SRCS), [busy, setBusy] = useState(null), [man, setMan] = useState(false), [cf, setCf] = useState(false);
  const up = (id, f) => setL((l) => l.map((s) => (s.id === id ? { ...s, ...f(s) } : s)));
  const sync = (id) => { setBusy(id); setTimeout(() => { setBusy(null); up(id, (s) => ({ sync: "Just now", state: "Connected", hist: [["Just now", "Synchronized"], ...s.hist] })); }, 1100); };
  const s = L.find((x) => x.id === sel);
  const Ladder = () => <div className="lad">{["Source", "Source response", "Evidence", "Record", "XRC verification"].map((x, i) => <span key={x} className="row" style={{ gap: 0, flex: i < 4 ? 1 : "none" }}><span className="lad-n mono"><b>{i + 1}</b>{x}</span>{i < 4 && <i className="lad-l" />}</span>)}</div>;
  if (s) return (<div className="fsv" style={{ position: "static", padding: 0 }}>
    <div className="fsh"><button className="ib" onClick={back} aria-label="Back"><ArrowLeft size={16} /></button><div className="fl"><div className="b tr" style={{ fontSize: 17 }}>{s.n}</div><div className="xs mu">{s.type}</div></div><span className={`chip ${SC[s.state]}`}>{s.state}</span></div>
    <Ladder />
    {s.state === "Sync failed" && <div className="sys row" style={{ marginBottom: 12, alignItems: "flex-start" }}><AlertTriangle size={16} style={{ color: "#fbbf24", flex: "none" }} /><div className="sm"><b>Source unavailable.</b> Last successful verification: {s.lv}.<br />Records stay as they were until the source responds.</div></div>}
    <Sec t="Source identity" open><KV v={[["Account", s.acct], ["Authorization", s.auth], ["Scopes", s.scopes.join(", ") || "—"], ["Last synchronization", s.sync], ["Last successful verification", s.lv], ["Records discovered", s.disc], ["Records generated", s.gen]]} /></Sec>
    <Sec t="Capabilities" n={s.caps.length} open><div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{s.caps.map((c) => <span key={c} className="chip g">{c}</span>)}</div></Sec>
    {man && <Sec t="Manage" open>{s.caps.map((c) => <label key={c} className="row" style={{ padding: "8px 0" }}><span className="fl">Import {c.toLowerCase()}</span><input type="checkbox" defaultChecked /></label>)}</Sec>}
    <Sec t="Connection history" n={s.hist.length}><div className="chain" style={{ marginTop: 6 }}>{s.hist.map(([d, e], i) => <div key={i}><div className="xs mu">{d}</div><div>{e}</div></div>)}</div></Sec>
    <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}>
      <button className="btn p" disabled={busy === s.id || s.state === "Disconnected" || s.state === "Authorization revoked"} onClick={() => sync(s.id)}><RefreshCw size={14} />{busy === s.id ? "Syncing…" : s.state === "Sync failed" ? "Retry sync" : "Sync"}</button>
      <button className="btn" onClick={() => go("Records")}>View records</button><button className="btn" onClick={() => setMan(!man)}>Manage</button>
      {s.state === "Disconnected" || s.state === "Authorization revoked" ? <button className="btn" onClick={() => up(s.id, (x) => ({ state: "Connected", auth: "OAuth · read-only", hist: [["Just now", "Reconnected"], ...x.hist] }))}>Reconnect</button> : <button className="btn" onClick={() => { if (!cf) return setCf(true); setCf(false); up(s.id, (x) => ({ state: "Disconnected", hist: [["Just now", "Disconnected by owner"], ...x.hist] })); }}>{cf ? "Confirm disconnect" : "Disconnect"}</button>}
      {s.state !== "Authorization revoked" && s.state !== "Disconnected" && <button className="btn" onClick={() => up(s.id, (x) => ({ state: "Authorization revoked", auth: "Revoked", hist: [["Just now", "Authorization revoked by owner"], ...x.hist] }))}>Revoke authorization</button>}</div></div>);
  const live = L.filter((x) => x.state !== "Disconnected" && x.state !== "Authorization revoked");
  return (<><Head t="Sources" s="Where your evidence comes from. A source is not evidence, and evidence is not a record." />
    <Ladder />
    {!live.length && <div className="pn" style={{ textAlign: "center", padding: 30 }}><Link2 size={26} className="mu" /><h3 style={{ marginTop: 10 }}>No connected sources yet</h3><button className="btn p" onClick={() => up("s1", () => ({ state: "Connected" }))}>Connect a source</button></div>}
    <div className="col">{L.map((x, i) => <button key={x.id} className="rec rr" style={{ "--t": HEX[SC[x.state]] }} onClick={() => go("Sources", x.id)}><Av n={x.n} s={38} g={G[i % 6]} /><div className="fl"><div className="b tr">{x.n}</div><div className="xs mu tr">{x.acct} · {x.disc} records · synced {x.sync}</div></div><span className="rr-c"><span className={`chip ${SC[x.state]}`}>{x.state}</span></span></button>)}</div></>);
}

/* ═════════ FILE: src/components/xrd/sections/Activity.jsx ═════════ */
function Activity() {
  const A = [["Today", "Reviewed remark from John Doe", MessageSquareQuote], ["Sep 18", "Responded to a contested remark", Send], ["Sep 02", "Received a confirmation from a collaborator", BadgeCheck], ["Aug 11", "Degree confirmed by the institution", GraduationCap], ["Jun 03", "Connected GitHub", GitBranch]];
  return (<><Head t="Activity" s="Recent changes to this record." /><div className="pn"><div>{A.map(([d, t, I]) => <div key={t} className="feed-i"><div className="feed-n"><I size={17} /></div><div className="fl"><div className="xs mu mono" style={{ letterSpacing: ".08em" }}>{d.toUpperCase()}</div><div>{t}</div></div></div>)}</div></div></>);
}

/* ═════════ FILE: src/components/xrd/sections/Permissions.jsx ═════════ */
function Permissions({ recs, setRecs, go }) {
  const [d, setD] = useState("Visibility");
  const [q, setQ] = useState([["John Doe", "Project Administrator", "Xeevia"], ["Kemi A.", "GitHub collaborator", "Xeevia"]]);
  const nx = (v) => VIS[(VIS.indexOf(v) + 1) % VIS.length];
  const HOLD = { Academia: "Registrar · Federal University", Employment: "HR · Sproutlight-Group", Projects: "John Doe (administrator) · Amina Bello (collaborator)", Credentials: "Cloud Certifier", Communities: "Community administrators", Achievements: "Xeevia", Creator: "Xeevia", Identity: "Xeevia identity service" };
  return (<><Head t="Permissions" s="Three separate questions: who can see a record, who can open its evidence, and who can act on or attest to it." />
    <Dd label="Dimension" v={d} o={[["Visibility", "Visibility", "Who can see it"], ["Evidence access", "Evidence access", "Who can open the evidence"], ["Authority", "Authority", "Who can act on or attest to it"]]} set={setD} />
    {d === "Visibility" && <div className="col">{recs.map((r) => <div key={r.id} className="rec rr" style={{ cursor: "default" }}><div className="ico"><r.ic size={18} /></div><div className="fl"><div className="b tr">{r.t}</div><div className="xs mu">{r.k}</div></div><span className="rr-c"><button className={`chip ${VC(r.v)}`} style={{ cursor: "pointer" }} onClick={() => setRecs(recs.map((x) => (x.id === r.id ? { ...x, v: nx(x.v) } : x)))}>{r.v === "PUBLIC" ? <Eye size={11} /> : <Lock size={11} />}{r.v}</button></span></div>)}</div>}
    {d === "Evidence access" && <div className="col">{EV.map((e) => <button key={e.id} className="rec rr" onClick={() => go("Evidence", e.id)}><div className="ico"><FileText size={18} /></div><div className="fl"><div className="b tr">{e.t}</div><div className="xs mu tr">{R0.find((r) => r.id === e.rec).t} · {e.src}</div></div><span className="rr-c"><span className={`chip ${VC(e.acc)}`}>{e.acc}</span></span></button>)}</div>}
    {d === "Authority" && <div className="pn" style={{ padding: 0 }}><div style={{ overflowX: "auto", padding: 12 }}><table className="tb"><thead><tr><th>Record type</th><th>Who can attest</th><th>Current holders</th></tr></thead><tbody>{Object.keys(ATT).map((k) => <tr key={k}><td>{k}</td><td>{ATT[k]}</td><td>{HOLD[k]}</td></tr>)}</tbody></table></div></div>}
    <div className="pn" style={{ margin: "14px 0" }}><h3>Who can do what</h3><div style={{ overflowX: "auto" }}><table className="tb" style={{ minWidth: 520 }}><thead><tr><th>Role</th><th>Visibility</th><th>Evidence</th><th>Authority</th></tr></thead><tbody>
      {[["Public visitor", "Public records", "Public evidence", "None without a verified relationship"], ["Verifier", "Public and verifier-only", "Evidence needed to verify", "Inspect verification; cannot attest"], ["Employer", "Employment records", "Own employment evidence", "Attest or update authorised employment data"], ["Owner", "Everything of their own", "All own evidence", "Control presentation and sharing; respond to remarks"], ["System", "Required records", "Required records", "Maintains audit and security history"]].map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "b" : ""}>{c}</td>)}</tr>)}</tbody></table></div></div>
    <div className="sys sm" style={{ marginBottom: 14 }}>{NOTE}</div>
    <div className="pn" style={{ marginBottom: 14 }}><h3>Locked by the system <Sys label="CANNOT BE HIDDEN" /></h3>{["Security audit events", "Verification history", "Institutional revocations", "Credential status changes"].map((x) => <div key={x} className="row" style={{ padding: "6px 0" }}><Shield size={14} className="mu" /><span className="fl sm">{x}</span><Sys label="SYSTEM RECORD" /></div>)}</div>
    <div className="pn"><h3>Remark access requests</h3>{q.map(([n, rel, p]) => <div key={n} className="row" style={{ padding: "8px 0", flexWrap: "wrap" }}><Av n={n} s={34} /><div className="fl"><div className="b sm">{n}</div><div className="xs mu">{rel} · {p}</div></div><button className="btn s" onClick={() => setQ(q.filter((x) => x[0] !== n))}>Decline</button><button className="btn s p" onClick={() => setQ(q.filter((x) => x[0] !== n))}>Send to project admin</button></div>)}{!q.length && <div className="mu">No pending requests.</div>}</div></>);
}

/* ═════════ FILE: src/components/xrd/sections/Audit.jsx ═════════ */
function Audit({ own, go }) {
  const [o, setO] = useState(null);
  const list = AUD.filter((a) => own || a.tag !== "SYSTEM RECORD");
  return (<><Head t="Audit" s="Append-only history. Open an event to see who did it, under what authority, and what changed." />
    <div className="col">{list.map((a) => <button key={a.id} className="rec rr" onClick={() => setO(a)}><div className="ico" style={{ color: "var(--mu)" }}><Lock size={16} /></div><div className="fl"><div>{a.e}</div><div className="xs mu">{a.t}</div></div><span className="rr-c"><Sys label={a.tag} /></span></button>)}</div>
    {o && <div className="mod fsm" onClick={() => setO(null)}><div onClick={(e) => e.stopPropagation()}><div className="row"><h3 className="fl" style={{ margin: 0, fontSize: 18 }}>Audit event</h3><button className="ib" onClick={() => setO(null)}><X size={16} /></button></div>
      <p style={{ margin: "14px 0 6px" }}>{o.e}</p><Sys label={o.tag} />
      <div style={{ margin: "14px 0" }}><KV v={[["Timestamp", o.t], ["Actor", o.actor], ["Actor identity", o.aid], ["Authorization", o.auth], ["Affected record", o.rec ? R0.find((r) => r.id === o.rec).t : "None"], ["Previous state", o.prev], ["New state", o.next], ["Source", o.src]]} /></div>
      <div className="row" style={{ flexWrap: "wrap" }}>{o.rec && <button className="btn s" onClick={() => { setO(null); go("Records", o.rec); }}>Open record</button>}{o.ev && <button className="btn s" onClick={() => { setO(null); go("Evidence", o.ev); }}>Related evidence</button>}{o.rec && <button className="btn s" onClick={() => { setO(null); go("Verification", o.rec); }}>Related verification</button>}</div>
      <div className="sys sm" style={{ marginTop: 14 }}>This entry cannot be edited or removed by the profile owner.</div></div></div>}</>);
}

/* ═════════ FILE: src/components/xrd/sections/Oracle.jsx ═════════ */
function useTyped(t, instant) {
  const rm = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [k, setK] = useState(rm || instant ? t.length : 0);
  useEffect(() => {
    if (rm || instant) { setK(t.length); return; }
    let x = 0; setK(0);
    const iv = setInterval(() => { x = Math.min(x + 3, t.length); setK(x); if (x >= t.length) clearInterval(iv); }, 16);
    return () => clearInterval(iv);
  }, [t, rm]);
  return k;
}
function Orb({ busy, srcs }) {
  const S = srcs.slice(0, 8);
  return (<svg className={`orb ${busy ? "busy" : ""}`} viewBox="0 0 400 400" role="img" aria-label="XRC Oracle core">
    <defs>
      <radialGradient id="ocore" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ecfccb" /><stop offset=".3" stopColor="#a3e635" /><stop offset=".7" stopColor="#10b981" stopOpacity=".35" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></radialGradient>
      <radialGradient id="ohalo" cx="50%" cy="50%" r="50%"><stop offset=".5" stopColor="#a3e635" stopOpacity="0" /><stop offset=".85" stopColor="#a3e635" stopOpacity=".12" /><stop offset="1" stopColor="#a3e635" stopOpacity="0" /></radialGradient>
      <filter id="oglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <circle cx="200" cy="200" r="198" fill="url(#ohalo)" />
    <circle cx="200" cy="200" r="184" fill="none" stroke="#2a2d2a" strokeDasharray="1 5" />
    <g className="o-spin r">{Array.from({ length: 120 }, (_, i) => { const a = (i / 120) * 2 * Math.PI, big = i % 10 === 0; return <line key={i} x1={200 + Math.cos(a) * 168} y1={200 + Math.sin(a) * 168} x2={200 + Math.cos(a) * (big ? 180 : 174)} y2={200 + Math.sin(a) * (big ? 180 : 174)} stroke="#a3e635" strokeOpacity={big ? 0.7 : 0.3} />; })}</g>
    <g className="o-spin"><circle cx="200" cy="200" r="146" fill="none" stroke="#a3e635" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="90 40" /></g>
    <circle cx="200" cy="200" r="124" fill="none" stroke="#2a2d2a" />
    <g className="o-spin r"><circle cx="200" cy="200" r="102" fill="none" stroke="#a3e635" strokeOpacity=".3" strokeDasharray="10 8" /></g>
    <g className="o-spin">{S.map((s, k) => { const a = (k / S.length) * 2 * Math.PI, x = 200 + Math.cos(a) * 124, y = 200 + Math.sin(a) * 124; return <g key={s}><line x1="200" y1="200" x2={x} y2={y} className="obeam" /><circle cx={x} cy={y} r="9" fill="none" stroke="#a3e635" strokeOpacity=".35" /><circle cx={x} cy={y} r="4.5" fill="#a3e635" filter="url(#oglow)" /></g>; })}</g>
    {[[200, 8, 200, 20], [200, 380, 200, 392], [8, 200, 20, 200], [380, 200, 392, 200]].map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#a3e635" strokeOpacity=".6" strokeWidth="2" />)}
    <circle className="o-core" cx="200" cy="200" r="72" fill="url(#ocore)" />
    <polygon points={[0, 1, 2, 3, 4, 5].map((k) => { const a = ((60 * k - 90) * Math.PI) / 180; return `${(200 + 40 * Math.cos(a)).toFixed(1)},${(200 + 40 * Math.sin(a)).toFixed(1)}`; }).join(" ")} fill="#030503" stroke="#a3e635" strokeWidth="2" filter="url(#oglow)" />
    <Sparkles x={185} y={185} size={30} color="#a3e635" />
  </svg>);
}
function Constel({ items, compact }) {
  const CX = 230, CY = 112, RX = 190, RY = 78, n = items.length;
  return (<div style={{ overflowX: compact ? "visible" : "auto" }}><svg viewBox="0 0 460 224" style={{ width: "100%", minWidth: compact ? 0 : 380, display: "block" }} role="img" aria-label="Records used in this answer">
    <defs><radialGradient id="cstg" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#a3e635" stopOpacity=".18" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx={CX} cy={CY} rx={RX + 30} ry={RY + 40} fill="url(#cstg)" />
    <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#2a2d2a" strokeDasharray="2 6" />
    {items.map((it, k) => { const a = (k / n) * Math.PI * 2 - Math.PI / 2, x = CX + Math.cos(a) * RX, y = CY + Math.sin(a) * RY, c = gq([CX, CY], [x, y], 0.1), d = `M${CX} ${CY}Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      return <g key={it.id} className="gn" role="button" tabIndex={0} aria-label={it.label} onClick={it.go} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); it.go(); } }}>
        <path d={d} fill="none" stroke={it.c} strokeOpacity=".5" /><path d={d} fill="none" stroke={it.c} strokeWidth="2" className="gflow" />
        <circle cx={x} cy={y} r="15" fill="#030503" stroke={it.c} strokeWidth="2" className="gsh" /><it.Ic x={x - 7} y={y - 7} size={14} color="#ececec" />
        {!compact && <text x={x} y={y < CY ? y - 21 : y + 28} textAnchor="middle" fontSize="9" fill="#c9cfc6" stroke="#000" strokeWidth="3" paintOrder="stroke">{it.label.slice(0, 18)}</text>}</g>; })}
    <circle cx={CX} cy={CY} r="24" fill="none" stroke="#a3e635" className="gpulse" /><circle cx={CX} cy={CY} r="24" fill="#a3e635" /><Sparkles x={CX - 9} y={CY - 9} size={18} color="#041004" />
  </svg></div>);
}
function Ans({ n, q, a, own, ev, go, chat, instant, onDone, onGrow }) {
  const full = a.a, k = useTyped(full, instant), done = k >= full.length;
  useEffect(() => { if (onGrow) onGrow(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (done && onDone) onDone(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const recs = a.rs.length > 0;
  const items = recs ? a.rs.map((r) => ({ id: r.id, label: r.t, c: HEX[ST[r.st].c], Ic: r.ic, go: () => go("Records", r.id) })) : a.idn.map((i) => ({ id: i.id, label: i.n, c: HEX[IC[i.s]], Ic: i.ic, go: () => go("Identity") }));
  const es = ev.filter((e) => a.rs.some((r) => r.id === e.rec) && (own || e.acc === "PUBLIC")), f = a.rs[0];
  const comp = recs ? Object.entries(a.rs.reduce((m, r) => ({ ...m, [r.st]: (m[r.st] || 0) + 1 }), {})).map(([s, c]) => [s, c, HEX[ST[s].c]]) : Object.entries(a.idn.reduce((m, i) => ({ ...m, [i.s]: (m[i.s] || 0) + 1 }), {})).map(([s, c]) => [s, c, HEX[IC[s]]]);
  return (<article className={`ans${chat ? " chat" : ""}`}>
    {!chat && <div className="ahd bg-scan"><span className="chip g mono">Q{String(n).padStart(2, "0")}</span><span className="fl tr b">{q}</span><span className="xs mu mono">{items.length} {recs ? "RECORDS" : "IDENTITIES"} · {es.length} EVIDENCE · {a.srcs.length} SOURCES</span></div>}
    <div style={{ padding: chat ? "14px 14px 16px 16px" : "16px 18px 18px 22px" }}>
      <div className={`aans ${done ? "" : "caret"}`}>{full.slice(0, k)}</div>
      {done && <div className="stag">
        {items.length > 0 && <><div className="xs mu" style={{ letterSpacing: ".08em", margin: "16px 0 4px" }}>TRACE · SELECT A NODE TO OPEN IT</div><Constel items={items} compact={chat} />
          <div className="cbar" style={{ marginTop: 6 }}>{comp.map(([s, c, col]) => <div key={s} title={`${s} · ${c}`} style={{ flex: c, background: col }} />)}</div>
          <div className="row xs mu mono" style={{ flexWrap: "wrap", gap: 12, marginTop: 8 }}>{comp.map(([s, c, col]) => <span key={s}><span style={{ color: col }}>●</span> {c} {s.toLowerCase()}</span>)}</div></>}
        {recs && <><div className="xs mu" style={{ margin: "16px 0 6px", letterSpacing: ".06em" }}>RECORDS USED · {a.rs.length}</div>{a.rs.slice(0, 5).map((r) => <button key={r.id} className="mini" onClick={() => go("Records", r.id)}><r.ic size={13} className="ac" /><span className="fl tr">{r.t}</span><St s={r.st} /></button>)}
          <div className="xs mu" style={{ margin: "14px 0 6px", letterSpacing: ".06em" }}>EVIDENCE USED · {es.length}</div>{es.slice(0, 4).map((e) => <button key={e.id} className="mini" onClick={() => go("Evidence", e.id)}><FileText size={13} className="ac" /><span className="fl tr">{e.t}</span><ChevronRight size={14} className="mu" /></button>)}{!es.length && <span className="sm mu">No evidence you can open.</span>}</>}
        {a.srcs.length > 0 && <><div className="xs mu" style={{ margin: "14px 0 6px", letterSpacing: ".06em" }}>SOURCES</div><div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{a.srcs.map((s) => <span key={s} className="chip bl">{s}</span>)}</div></>}
        <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}>{f ? <><button className="btn p s" onClick={() => go("Records", f.id)}>Open record</button><button className="btn s" onClick={() => go("Evidence", f.id)}>View evidence</button><button className="btn s" onClick={() => go("Chains", f.id)}>View chain</button><button className="btn s" onClick={() => go("Verification", f.id)}>Verify</button></> : a.idn.length > 0 && <button className="btn p s" onClick={() => go("Identity")}>Open Identity</button>}</div>
      </div>}
    </div></article>);
}
function useMob() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= 900);
  useEffect(() => { const f = () => setM(window.innerWidth <= 900); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return m;
}
function Oracle({ own, vis, ev, ids, go, back, orLog, setOrLog, mode, setMode, hid = 0 }) {
  const [own_log, setOwnLog] = useState([]), raw = orLog || own_log, setLog = setOrLog || setOwnLog, log = raw.filter((e) => e.own === own);
  const [q, setQ] = useState(""), [pend, setPend] = useState(null), [step, setStep] = useState(0), mob = useMob(), bodyRef = useRef(null);
  const idv = own ? ids : ids.filter((i) => ["Verified", "Connected"].includes(i.s));
  const srcs = [...new Set(vis.map((r) => r.src))], asks = own ? ASKS : ASKS_PUB;
  const steps = [`READING ${vis.length} RECORDS`, `OPENING ${ev.length} EVIDENCE ITEMS`, `RESOLVING ${srcs.length} SOURCES`, "TRACING PROVENANCE", "COMPOSING FROM WHAT EXISTS"];
  useEffect(() => {
    if (pend === null) return;
    setStep(0);
    const iv = setInterval(() => setStep((s) => Math.min(s + 1, 4)), 240);
    const t = setTimeout(() => { setLog((l) => [{ id: Date.now(), t: pend, a: oracle(pend, vis, idv), seen: false, own }, ...l]); setPend(null); }, 1200);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [pend]); // eslint-disable-line react-hooks/exhaustive-deps
  const ask = (t) => { const s = t.trim(); if (!s || pend !== null) return; setQ(""); setPend(s); };
  const busy = pend !== null, mark = (id) => setLog((l) => l.map((e) => (e.id === id ? { ...e, seen: true } : e)));
  const toEnd = () => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; };
  useEffect(() => { if (!mob) return; const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, [mob]);
  useEffect(() => { if (mob) toEnd(); }, [mob, log.length, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mob) {
    const chron = [...log].reverse(), left = asks.filter((x) => !log.some((e) => e.t === x.q));
    const tick = [own ? "PRIVATE ORACLE" : "PUBLIC ORACLE", vis.length + " RECORDS", ev.length + " EVIDENCE", srcs.length + " SOURCES", "NO INFERRED EVIDENCE"];
    const row = (k) => <span className="orx-tki" aria-hidden={k > 0 ? "true" : undefined}>{[0, 1].flatMap((r) => tick.map((t, i) => <span key={r + "-" + i}>{t}<i>·</i></span>))}</span>;
    return (
      <div className="orx" role="dialog" aria-label="XRC Oracle">
        <header className="orx-h">
          <button className="ib" onClick={back} aria-label="Back"><ArrowLeft size={18} /></button>
          <span className={`orx-o ${busy ? "busy" : ""}`}><Sparkles size={17} /></span>
          <div className="fl"><div className="b">XRC Oracle</div>
            <div className="orx-tk" role="status" aria-label={tick.join(", ")}><span className="live" /><span className="orx-tkv">{row(0)}{row(1)}</span></div></div>
          {log.length > 0 && <button className="ib" onClick={() => setLog((l) => l.filter((e) => e.own !== own))} aria-label="Clear conversation"><RefreshCw size={16} /></button>}
        </header>
        <div className="orx-mid">
          {/* the welcome design lives in the background: it stays put while the conversation scrolls over it */}
          <div className={`orx-bg ${log.length || busy ? "dim" : ""}`} aria-hidden="true">
            <i className="o-aur" /><i className="o-stars" />
            <div className="orx-bgc"><Orb busy={busy} srcs={srcs} />
              <h2>Ask your evidence</h2>
              <p>{own ? "Answers come only from records you can access, with the records, evidence and sources shown. Nothing is inferred." : "Answers come only from Emmanuel's public records, with the records, evidence and sources shown. Private records are never used."}</p>
              <div className="orx-st mono"><span>{vis.length} RECORDS</span><span>{ev.length} EVIDENCE</span><span>{srcs.length} SOURCES</span></div></div>
          </div>
          <div className="orx-pm" role="group" aria-label="Prototype view"><span className="xs mono mu">VIEW</span><div className="seg">{[["owner", "Owner"], ["public", "Public"]].map(([m, l]) => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode && setMode(m)}>{l}</button>)}</div></div>
          <div className="orx-b" ref={bodyRef}><div className="orx-in">
            {!own && <div className="sys row sm" style={{ alignItems: "flex-start" }}><Lock size={15} style={{ flex: "none", marginTop: 2 }} /><span className="fl">Public Oracle. Only the {vis.length} public records are used. {hid} private record{hid === 1 ? "" : "s"} exist{hid === 1 ? "s" : ""} and {hid === 1 ? "is" : "are"} never read.</span></div>}
            {chron.map((e, i) => (<div key={e.id} className="col" style={{ gap: 14 }}>
              <div className="orx-u">{e.t}</div>
              <div className="orx-m"><span className="orx-o"><Sparkles size={16} /></span><Ans chat n={i + 1} q={e.t} a={e.a} own={own} ev={ev} go={go} instant={e.seen} onDone={() => mark(e.id)} onGrow={toEnd} /></div>
            </div>))}
            {busy && <><div className="orx-u">{pend}</div><div className="orx-m"><span className="orx-o busy"><Sparkles size={16} /></span><div className="orx-th mono"><span className="spin" />{steps[step]}<span className="dots"><i /><i /><i /></span></div></div></>}
          </div></div>
        </div>
        <footer className="orx-f">
          {left.length > 0 && <div className="orx-qs" role="list" aria-label="Suggested questions">{left.map(({ q: qq, I, l }) => <button key={qq} role="listitem" className="orx-sc" disabled={busy} onClick={() => ask(qq)}><span className="t"><span className="ic"><I size={14} /></span>{l.toUpperCase()}</span><p>{qq}</p><ChevronRight size={14} className="go" /></button>)}</div>}
          <div className="cmd"><div className="cmd-in"><Sparkles size={18} className="ac" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} placeholder={own ? "Ask your evidence anything…" : "Ask about Emmanuel's public records…"} aria-label="Ask XRC Oracle" enterKeyHint="send" /><button className="btn p" onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Send"><Send size={14} /></button></div></div>
        </footer>
      </div>
    );
  }
  return (<><Head t="XRC Oracle" s="A query layer over your record graph. It answers only from records you can access and shows what it used." />
    {!own && <div className="sys row" style={{ marginBottom: 14 }}><Lock size={16} /><span className="fl sm">Public Oracle. It answers using only the {vis.length} public records. {hid} private record{hid === 1 ? "" : "s"} {hid === 1 ? "exists" : "exist"} and {hid === 1 ? "is" : "are"} never used.</span></div>}
    <div className="orc">
      <i className="obg o-aur" /><i className="obg o-stars" /><i className="obg o-floor" /><i className="obg o-scan" />
      <div className="ohud mono" style={{ top: 14, left: 20 }}><span className="live" />XRC ORACLE</div>
      <div className="ohud mono" style={{ top: 14, right: 20 }}>{own ? "PRIVATE ORACLE" : "PUBLIC ORACLE"}</div>
      <Orb busy={busy} srcs={srcs} />
      <div className="ostat mono" aria-live="polite">{busy ? steps[step] : "STANDING BY · ASK ABOUT ANY RECORD"}</div>
      <div className="cmd"><div className="cmd-in"><Sparkles size={18} className="ac" /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} placeholder={own ? "Ask your evidence anything…" : "Ask about Emmanuel's public records…"} aria-label="Ask XRC Oracle" /><button className="btn p" onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Send"><Send size={14} /></button></div></div>
      <div className="sug">{(own ? ASK : ASK_PUB).map((x, i) => <button key={x} disabled={busy} onClick={() => ask(x)}><b>{String(i + 1).padStart(2, "0")}</b><span>{x}</span></button>)}</div>
      <div className="row xs mu mono" style={{ justifyContent: "center", flexWrap: "wrap", gap: 14, marginTop: 14 }}><span>{vis.length} RECORDS</span><span>{ev.length} EVIDENCE</span><span>{srcs.length} SOURCES</span><span>NO INFERRED EVIDENCE</span></div>
    </div>
    {!log.length && !busy && <div className="pn bg-dots mu">Oracle never infers evidence that isn't in the record graph. Every answer shows the records, evidence and sources it used.</div>}
    {log.map((e, i) => <Ans key={e.id} n={log.length - i} q={e.t} a={e.a} own={own} ev={ev} go={go} instant={e.seen} onDone={() => mark(e.id)} />)}
  </>);
}

/* ═════════ FILE: src/components/xrd/sections/Settings.jsx ═════════ */
function Settings() {
  const [tab, setTab] = useState("Visibility"); const [on, setOn] = useState({});
  return (<><Head t="XRD settings" s="Presentation controls. Record integrity is not configurable." />
    <Dd label="Section" v={tab} o={Object.keys(SETS).map((t) => [t, t, `${SETS[t].length} settings`])} set={setTab} />
    <div className="pn">{SETS[tab].map((l) => { const k = tab + l; const v = on[k] ?? true; return <div key={k} className="setr"><span className="fl">{l}</span><span className={`mono xs ${v ? "ac" : "mu"}`}>{v ? "ON" : "OFF"}</span><button className={`tg ${v ? "on" : ""}`} role="switch" aria-checked={v} onClick={() => setOn({ ...on, [k]: !v })} aria-label={l} /></div>; })}
      <div className="sys sm" style={{ marginTop: 14 }}>{NOTE} You cannot suppress institutional or system records here.</div></div></>);
}