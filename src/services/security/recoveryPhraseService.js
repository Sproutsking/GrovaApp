// src/services/security/recoveryPhraseService.js
import { supabase } from '../config/supabase';

const WORDLIST = [
  "abandon","ability","able","about","above","absent","absorb","abstract","absurd","abuse",
  "access","accident","account","accuse","achieve","acid","acoustic","acquire","across","act",
  "action","actor","address","adjust","admit","adult","advance","advice","aerobic","afford",
  "afraid","again","age","agent","agree","aim","airport","alarm","album","alcohol",
  "alert","alien","align","alive","alley","allow","almost","alone","alpha","already",
  "alter","always","amateur","amazing","amount","amused","analyst","anchor","ancient","anger",
  "angle","angry","animal","ankle","announce","annual","answer","anxiety","april","arch",
  "arctic","area","arena","argue","armor","army","around","arrange","arrest","arrive",
  "arrow","art","artefact","artist","aspect","asset","assist","assume","asthma","athlete",
  "atom","attack","attend","attract","auction","august","author","autumn","avocado","avoid",
  "awake","aware","awesome","awkward","axis","balance","bamboo","banana","banner","bargain",
  "barrel","basic","basket","battle","beach","beauty","become","before","begin","behave",
  "believe","belt","bench","benefit","betray","bicycle","bind","biology","birth","bitter",
  "blade","blame","blanket","blast","bless","blood","blossom","blur","board","bone",
  "boost","border","borrow","bounce","brain","brand","brave","breeze","brick","bridge",
  "bright","bring","bronze","bubble","budget","buffalo","build","bulk","bundle","burden",
  "burst","butter","buzz","cabbage","cabin","cable","cactus","cage","calm","camera",
  "cancel","candy","cannon","canvas","canyon","capital","captain","carbon","carpet","castle",
  "catalog","catch","cattle","caution","cave","ceiling","celery","cement","century","cereal",
  "chair","chaos","chapter","charge","chase","cheap","cheese","chef","cherry","chief",
  "chimney","chronic","chunk","cinema","circle","citizen","civil","clarify","claw","clay",
  "clerk","clever","client","cliff","climb","clinic","clock","close","cloth","cloud",
  "clown","cluster","coach","coast","coconut","collect","column","combine","comfort","comic",
  "concert","confirm","congress","consider","convince","copper","coral","correct","cotton",
  "country","couple","course","cousin","crack","cradle","craft","crane","crash","crater",
  "cream","credit","creek","cricket","crime","critic","crouch","crucial","cruise","crumble",
  "crystal","culture","cupboard","curious","current","curtain","curve","cushion","custom",
  "damage","dance","danger","daring","daughter","deal","decade","decline","degree","deliver",
  "deposit","derive","desert","design","detect","develop","diagram","diamond","digital",
  "dilemma","dinosaur","disagree","discover","disease","dismiss","distance","doctor","dolphin",
  "donate","dragon","drama","drastic","dream","drift","drill","drop","dynamic","eager",
  "eagle","echo","edge","educate","effort","electric","elegant","element","elephant","elite",
  "embark","emerge","emotion","employ","empower","enable","endless","energy","engine","enjoy",
  "enrich","entire","episode","equip","erase","escape","essence","estate","eternal","evolve",
  "exchange","excite","exercise","exhaust","exhibit","exotic","expand","explain","express",
  "fabric","faculty","faith","fame","family","famous","fantasy","fashion","fatigue","fault",
  "federal","festival","fever","fiction","figure","filter","finger","firm","fitness","flame",
  "flash","flavor","flight","float","flower","fluid","focus","forest","fortune","fossil",
  "fragile","frequent","frog","frost","frozen","fuel","furnace","galaxy","gallery","garlic",
  "genius","gentle","ghost","gift","ginger","giraffe","glass","glide","globe","glory",
  "goat","gorilla","gospel","govern","grain","grant","grape","grasp","gravity","green",
  "grief","grit","guitar","hammer","hamster","harvest","hawk","hazard","health","heavy",
  "hidden","hobby","honey","horror","horse","hospital","hover","humble","humor","hunt",
  "hybrid","illegal","immune","impact","improve","impulse","incident","indicate","industry",
  "inhale","innocent","inspire","install","invest","island","isolate","jaguar","jazz","jelly",
  "jewel","journey","jungle","kernel","kingdom","kitchen","kiwi","language","laptop","laundry",
  "lava","lawyer","lecture","legend","lemon","leopard","liberty","license","lizard","lobster",
  "lottery","lounge","loyal","lucky","luggage","lunar","luxury","magic","magnet","mansion",
  "maple","marble","marine","marriage","master","matrix","maze","meadow","medal","melody",
  "memory","mercy","metal","midnight","mirror","mobile","monitor","monster","mosquito","motion",
  "mountain","multiply","museum","mushroom","mystery","napkin","nature","noble","nominee",
  "notable","novel","obtain","ocean","onion","orbit","ordinary","orphan","ostrich","outdoor",
  "oyster","ozone","palace","panda","panic","panther","parade","parent","parrot","patch",
  "patrol","peanut","peasant","pelican","penalty","pencil","pepper","pigeon","pioneer","pitch",
  "planet","plastic","pledge","plunge","polar","poverty","predict","prepare","pride","prison",
  "process","produce","profit","promote","property","prosper","protect","provide","pudding",
  "pumpkin","puzzle","pyramid","quantum","rabbit","raccoon","radar","radio","rally","ranch",
  "raven","rebel","recall","recipe","recycle","reflect","reform","refuse","region","reject",
  "release","relief","remind","render","renew","repair","rescue","resist","resource","result",
  "retire","reunion","reveal","reward","ribbon","ritual","rival","river","roast","robot",
  "rocket","romance","rotate","rubber","runway","saddle","salmon","salute","sample","satisfy",
  "satoshi","sauce","scatter","scheme","scout","screen","script","season","secret","seek",
  "seminar","senior","series","settle","shadow","shallow","sheriff","shield","shift","shine",
  "shiver","shock","shrimp","shuffle","siege","silent","silver","sketch","slam","sleep",
  "slice","slim","slogan","smart","smoke","smooth","snack","soldier","solution","source",
  "spatial","spawn","sphere","spice","spider","spirit","split","sponsor","spring","squeeze",
  "squirrel","stable","stamp","steak","steel","strategy","struggle","sudden","sugar","supreme",
  "surge","sustain","swallow","swift","symbol","tackle","talent","tattoo","timber","tobacco",
  "token","tomato","topple","tornado","tortoise","tourist","trade","traffic","transfer",
  "trap","travel","trend","tribe","trigger","trumpet","trust","tunnel","turkey","turtle",
  "umbrella","uncover","unfair","unique","universe","unlock","unusual","upgrade","urban",
  "vacant","valley","vapor","vault","vehicle","velvet","vendor","venture","verify","veteran",
  "vibrant","victory","vintage","violin","virtual","vivid","vocal","volcano","voyage",
  "wallet","warfare","warrior","wealth","weasel","weather","wedding","weekend","weird",
  "whale","wheat","wheel","whisper","wilderness","wisdom","witness","wonder","worship",
  "wrestle","yellow","zebra","zone"
];

export function generateRecoveryPhrase(wordCount = 12) {
  const words = [];
  const array = new Uint32Array(wordCount);
  crypto.getRandomValues(array);
  for (let i = 0; i < wordCount; i++) {
    words.push(WORDLIST[array[i] % WORDLIST.length]);
  }
  return words.join(' ');
}

async function hashPhrase(phrase) {
  const enc = new TextEncoder();
  const data = enc.encode(phrase.toLowerCase().trim());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function createOrGetRecoveryPhrase(userId) {
  if (!userId) throw new Error('userId required');
  const { data: existing } = await supabase
    .from('user_recovery_phrases')
    .select('phrase_hint, created_at, revealed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { exists: true, ...existing };

  const phrase = generateRecoveryPhrase(12);
  const hash = await hashPhrase(phrase);
  const encoded = btoa(unescape(encodeURIComponent(phrase)));
  const words = phrase.split(' ');
  const hint = `${words[0]} ••• ${words[words.length - 1]}`;

  const { error } = await supabase.from('user_recovery_phrases').insert({
    user_id: userId,
    phrase_encoded: encoded,
    phrase_hash: hash,
    phrase_hint: hint,
    word_count: 12,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { exists: false, phrase, hint };
}

export async function getRecoveryPhrase(userId) {
  const { data, error } = await supabase
    .from('user_recovery_phrases')
    .select('phrase_encoded, phrase_hint, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return createOrGetRecoveryPhrase(userId);
  try {
    const phrase = decodeURIComponent(escape(atob(data.phrase_encoded)));
    await supabase.from('security_events').insert({
      user_id: userId, event_type: 'withdrawal_pin_set', severity: 'warning',
      metadata: { action: 'recovery_phrase_revealed', timestamp: new Date().toISOString() }
    }).catch(() => {});
    await supabase.from('user_recovery_phrases')
      .update({ revealed_at: new Date().toISOString() })
      .eq('user_id', userId).catch(() => {});
    return { phrase, hint: data.phrase_hint, created_at: data.created_at };
  } catch { throw new Error('Failed to decode recovery phrase'); }
}

export async function verifyRecoveryPhrase(userId, inputPhrase) {
  const hash = await hashPhrase(inputPhrase);
  const { data } = await supabase.from('user_recovery_phrases')
    .select('phrase_hash').eq('user_id', userId).maybeSingle();
  return data?.phrase_hash === hash;
}

export default { generateRecoveryPhrase, createOrGetRecoveryPhrase, getRecoveryPhrase, verifyRecoveryPhrase };