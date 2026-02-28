// paywave/constants.js
// ─────────────────────────────────────────────────────────────
// Static config & CSS shared across the PayWave app.
// All mock/demo transaction data has been removed.
// Live data is fetched from Supabase in each tab component.
// ─────────────────────────────────────────────────────────────

export const COLOR = {
  bg:           "#07080a",
  surface:      "rgba(255,255,255,0.03)",
  surfaceHover: "rgba(255,255,255,0.055)",
  border:       "rgba(255,255,255,0.072)",
  lime:         "#a3e635",
  limeDim:      "#84cc16",
  limeGlow:     "rgba(163,230,53,0.13)",
  limeBorder:   "rgba(163,230,53,0.22)",
  gold:         "#d4a847",
  goldDim:      "rgba(212,168,71,0.15)",
  goldBorder:   "rgba(212,168,71,0.25)",
  text:         "#eef0ee",
  textSoft:     "#7a8a80",
  textMuted:    "#3d4a40",
};

// ── App data ─────────────────────────────────────────────────
export const NETWORKS = [
  { id:"mtn",    name:"MTN",    cls:"net-mtn"    },
  { id:"glo",    name:"GLO",    cls:"net-glo"    },
  { id:"airtel", name:"Airtel", cls:"net-airtel" },
  { id:"9mob",   name:"9M",     cls:"net-9mobile"},
];

export const DATA_PLANS = [
  { id:1, size:"1GB",  dur:"1 Day",   price:250,  back:1.75 },
  { id:2, size:"2GB",  dur:"2 Days",  price:500,  back:5    },
  { id:3, size:"5GB",  dur:"7 Days",  price:1500, back:15   },
  { id:4, size:"10GB", dur:"30 Days", price:3000, back:30   },
];

export const TV_PROVS = [
  { id:"dstv",      name:"DSTV",      cls:"prov-dstv"      },
  { id:"gotv",      name:"GOTV",      cls:"prov-gotv"      },
  { id:"startimes", name:"Startimes", cls:"prov-startimes" },
];

export const TV_PLANS = [
  { id:1, name:"Basic",    price:2000  },
  { id:2, name:"Premium",  price:5000  },
  { id:3, name:"Ultimate", price:10000 },
];

export const ELEC_PROVS = [
  { id:"ikeja", name:"Ikeja Electric", cls:"prov-ikeja" },
  { id:"eko",   name:"Eko Electric",   cls:"prov-eko"   },
  { id:"abuja", name:"Abuja Electric", cls:"prov-abuja" },
];

export const BET_PROVS = [
  { id:"bet9ja",    name:"Bet9ja",    cls:"prov-bet9ja"    },
  { id:"sportybet", name:"Sportybet", cls:"prov-sportybet" },
  { id:"nairabet",  name:"Nairabet",  cls:"prov-nairabet"  },
];

export const GIFT_CARDS = [
  { id:1, name:"Amazon",      min:1000 },
  { id:2, name:"Google Play", min:500  },
  { id:3, name:"iTunes",      min:2000 },
];

export const BILL_TYPES = [
  { id:1, name:"Water Bill",    icon:"Zap"       },
  { id:2, name:"Internet Bill", icon:"Wifi"      },
  { id:3, name:"School Fees",   icon:"Building2" },
];

export const LOAN_PLANS = [
  { id:1, name:"Quick Loan",    rate:"5%",  max:5000,  desc:"Instant approval"  },
  { id:2, name:"Personal Loan", rate:"10%", max:50000, desc:"Flexible terms"    },
];

export const BANKS = [
  { id:"palmpay",    name:"PalmPay"    },
  { id:"opay",       name:"OPay"       },
  { id:"moniepoint", name:"Moniepoint" },
  { id:"access",     name:"Access Bank"},
  { id:"gtb",        name:"GTBank"     },
];

// NOTE: TRANSACTIONS array removed — all transaction data is fetched live
// from the ep_transactions and wallet_history tables via Supabase.