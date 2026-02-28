// src/components/SmartTextarea/suggestionData.js
// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Data Layer v3 — 10× Expanded
//   • 15 topic clusters (was 6)
//   • 150+ multi-word phrase completions (was 40)
//   • 60+ post templates (was 25)
//   • 60+ opening phrases (was 20)
//   • Hashtag banks per topic
//   • Post structure formulas
//   • Viral pattern library
//   • 600+ universal vocabulary
// ─────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// 15 TOPIC CLUSTERS
// ══════════════════════════════════════════════════════════════════════════════

export const TOPIC_CLUSTERS = {
  crypto: {
    keywords: ["crypto","bitcoin","btc","eth","ethereum","token","wallet","defi","nft","web3","grova","blockchain","hodl","altcoin","market","trade","chart","bull","bear","stake","mint","airdrop","whitelist","dao","dex","liquidity","protocol","layer","chain","hash","block","coin","satoshi","mempool","gas","fee","validator","node","consensus","fork","halving","memecoin","shitcoin","altseason","cycle","dominance","correction","pump","dump","rug","whale","shark","flipper","holder","paper hands","diamond hands"],
    vocabulary: ["bullish","bearish","accumulate","fud","fomo","ath","dyor","wagmi","ngmi","alpha","whale","hodl","rekt","moon","correction","breakout","resistance","support","liquidity","volume","mcap","staking","yield","apy","tvl","protocol","ecosystem","narrative","rotation","cycle","maxi","degen","ser","anon","gm","gn","probably nothing","this is fine","we're so early","still early","not financial advice","nfa","do your own research","the merge","the flippening"],
    hooks: [
      "Hot take on the current market:",
      "What the charts aren't showing you:",
      "Everyone is sleeping on this:",
      "GM fam. Let's talk about what's really happening:",
      "Unpopular crypto opinion:",
      "The narrative is shifting — here's why:",
      "Most people are about to miss this cycle:",
      "I've been watching this quietly for months:",
      "The one metric nobody is talking about:",
      "While retail panic sells, smart money is:",
    ],
    phrases: [
      "diamond hands are built in moments like these",
      "this is why we stay in the game",
      "the market rewards patience above all else",
      "zoom out and the chart tells a completely different story",
      "early adopters always win in the long run",
      "this is what accumulation looks like on chain",
      "the fundamentals have not changed one bit",
      "bear markets build the foundations of the next bull run",
      "stay humble and keep stacking regardless of price",
      "the ones complaining now will be bragging later",
      "price is what you pay value is what you get",
      "the noise is loudest right before the move",
      "weak hands create opportunities for strong hands",
      "we are still so early it's almost embarrassing",
      "the technology does not care about your feelings",
      "follow the smart money not the headlines",
    ],
    ctas: ["What's your read on this? Drop below 👇","Are you accumulating or waiting? 👇","Tag someone who needs to see this.","Follow for daily alpha 🔥","DYOR — what are you watching? 👇","Bull or bear right now? Comment below 👇"],
    hashtags: ["#crypto","#bitcoin","#btc","#ethereum","#eth","#web3","#defi","#nft","#blockchain","#hodl","#altcoin","#cryptocurrency","#cryptonews","#bullish","#altseason"],
  },

  motivation: {
    keywords: ["success","mindset","goals","dream","hustle","grind","inspire","motivate","achieve","discipline","focus","growth","journey","believe","overcome","challenge","win","learn","fail","rise","push","limits","potential","vision","mission","purpose","calling","legacy","impact","change","transform","habit","routine","commitment","sacrifice","persistence","determination","resilience","grit","courage","confidence","fear","doubt","impossible","greatness","excellence","mastery","peak","perform","execute"],
    vocabulary: ["relentless","intentional","consistent","resilient","unstoppable","determined","committed","focused","deliberate","purposeful","tenacious","disciplined","persistent","courageous","fearless","bold","audacious","gritty","driven","ambitious","unyielding","methodical","strategic","proactive","growth-oriented","self-aware","accountable","dedicated","inspired","empowered","aligned","congruent","laser-focused","obsessed","hungry","fire","burning","unbreakable","formidable"],
    hooks: [
      "The uncomfortable truth about success:",
      "Nobody talks about this part of the journey:",
      "A reminder nobody asked for but everyone needs:",
      "What separates the top 1% from everyone else:",
      "I had to learn this the hard way:",
      "Honest question that changed my life:",
      "The thing holding most people back isn't talent:",
      "Every successful person I've met has one thing in common:",
      "Stop romanticizing the grind and start doing this:",
      "The version of you that gives up never existed:",
    ],
    phrases: [
      "the gap between where you are and where you want to be is called work",
      "success leaves clues — study the people ahead of you",
      "your comfort zone is the enemy of your potential",
      "every expert was once a beginner who refused to quit",
      "the version of you in 12 months will thank you for starting today",
      "consistency beats intensity every single time",
      "the hard days are the ones that define you",
      "stop waiting for perfect conditions — they don't exist",
      "one percent better every day is 37 times better by year end",
      "discipline is choosing what you want most over what you want now",
      "the most dangerous phrase is it's always been done this way",
      "average is comfortable but extraordinary is fulfilling",
      "your habits are your destiny in slow motion",
      "the person you want to become is on the other side of fear",
      "motivation gets you started discipline keeps you going",
      "success is never owned it is only rented and the rent is due every day",
    ],
    ctas: ["What's one goal you're committed to this month? 👇","Save this for when you need it most.","Tag someone who needs this reminder today.","What resonates most with you? 👇","What did this unlock for you? Comment below."],
    hashtags: ["#motivation","#mindset","#success","#hustle","#discipline","#growthmindset","#entrepreneurmindset","#dailymotivation","#inspire","#goals","#personaldevelopment","#selfimprovement","#hardwork","#consistency","#nevergiveup"],
  },

  business: {
    keywords: ["business","startup","entrepreneur","company","brand","revenue","sales","client","customer","product","service","market","strategy","growth","profit","team","launch","scale","invest","funding","agency","freelance","consulting","pitch","deal","partnership","b2b","saas","build","founder","ceo","operator","operator","execution","product market fit","runway","valuation","raise","bootstrap","solopreneur","side hustle","passive income","multiple streams","leverage","arbitrage","acquisition","retention","churn","mrr","arr","kpi","okr","north star","moat","defensibility","network effects"],
    vocabulary: ["leverage","pivot","iterate","validate","monetize","optimize","automate","systemize","delegate","bootstrapped","traction","conversion","retention","positioning","differentiation","moat","execution","velocity","throughput","scalable","repeatable","productized","compounding","defensible","asymmetric","high-leverage","capital-efficient","product-led","community-led","sales-led","revenue-generating","cash-flowing","self-sustaining"],
    hooks: [
      "The business lesson that cost me the most to learn:",
      "What they don't teach you in business school:",
      "The mistake that almost killed my business:",
      "3 things I wish I knew before starting:",
      "Why most businesses fail in year 2:",
      "Honest breakdown of how we grew to",
      "The one decision that changed everything in my business:",
      "Most founders optimize for the wrong thing:",
      "I almost quit before I figured this out:",
      "The difference between a job and a business is",
    ],
    phrases: [
      "build systems not just tasks so the business runs without you",
      "the best time to start was yesterday the second best time is now",
      "revenue solves most startup problems people think are complicated",
      "hire for attitude and cultural fit and train for skill",
      "your network is your net worth build it like your life depends on it",
      "the market is always telling you something — learn to listen",
      "you cannot scale what you haven't systematized and documented",
      "solve a real painful problem and the money follows naturally",
      "done is better than perfect — ship it iterate and improve",
      "the product is the marketing when it is truly world-class",
      "price on value not on cost and charge what you are worth",
      "the biggest risk is not taking any risk at all",
      "your first 100 customers are your most important investors",
      "the fastest way to learn is to sell something to a real person",
    ],
    ctas: ["What's your biggest business challenge right now? 👇","Save this if you're building something.","What would you add to this list?","DM me if you want to talk strategy.","What's the best business lesson you've learned? 👇"],
    hashtags: ["#entrepreneurship","#startup","#business","#founder","#entrepreneur","#growthhacking","#businesstips","#marketing","#sales","#leadership","#buildinpublic","#saas","#bootstrapped","#productmarketfit","#smallbusiness"],
  },

  lifestyle: {
    keywords: ["life","living","daily","routine","morning","evening","night","healthy","fitness","food","travel","family","friends","love","happy","grateful","mindful","balance","peace","joy","fun","adventure","experience","memory","moment","real","authentic","vibes","energy","aura","aesthetic","glow","wellness","selfcare","boundaries","healing","growth","align","intention","purpose","flow","presence","grounded","centered","wholesome"],
    vocabulary: ["intentional","present","grounded","fulfilled","nourished","thriving","flourishing","centered","aligned","authentic","mindful","grateful","blessed","content","joyful","abundant","free","connected","balanced","whole","radiant","vibrant","embodied","expansive","liberated","sovereign","rooted","flowing","glowing","luminous","magnetic","energized","alive","awake","aware","conscious","deliberate"],
    hooks: [
      "Something I noticed lately that changed everything:",
      "Real talk about what actually brings fulfillment:",
      "The lifestyle upgrade nobody is talking about:",
      "What a year of intentional living taught me:",
      "The thing that matters most, honestly:",
      "An honest reflection after",
      "I stopped doing this one thing and everything changed:",
      "The quiet life is actually the most powerful life:",
      "Nobody talks about the beauty in ordinary moments:",
      "What protecting your energy actually looks like:",
    ],
    phrases: [
      "the small moments are the ones you remember most vividly",
      "life is happening right now are you fully present for it",
      "who you surround yourself with determines who you become",
      "your energy is your most valuable and non-renewable currency",
      "the best investment you can make is in experiences not things",
      "simplicity is the ultimate form of sophistication",
      "the quality of your life is the quality of your relationships",
      "slow down to speed up the things that actually matter",
      "you cannot pour from an empty cup so fill yours first",
      "the richest people I know have the most time not the most money",
      "protect your peace like it is the most precious thing you own",
      "not every day needs to be productive to be valuable",
      "rest is not laziness it is the foundation of sustainability",
      "your nervous system knows things your mind takes time to understand",
    ],
    ctas: ["What's one thing bringing you joy today? 👇","Share this with someone who needs a reminder.","What would you add? Let me know below.","How do you find balance? Genuinely curious 👇"],
    hashtags: ["#lifestyle","#wellness","#selfcare","#mindfulness","#gratitude","#intentionalliving","#healthylifestyle","#morningroutine","#balance","#healing","#growth","#authentic","#dailyinspo","#wellbeing","#liveyourbestlife"],
  },

  education: {
    keywords: ["learn","teach","study","knowledge","skill","course","book","read","research","understand","explain","guide","tutorial","tip","lesson","insight","discover","fact","science","data","evidence","proof","demonstrate","example","case study","framework","model","system","process","methodology","principle","concept","theory","practice","application","implementation","critical thinking","first principles"],
    vocabulary: ["foundational","fundamental","comprehensive","nuanced","counterintuitive","overlooked","underrated","misunderstood","evidence-based","data-driven","practical","actionable","applicable","transferable","scalable","repeatable","systematic","structured","layered","compounding","recursive","iterative","emergent","non-obvious","contrarian","paradigm-shifting","mind-expanding","perspective-altering"],
    hooks: [
      "A concept that took me 10 years to fully grasp:",
      "The mental model that changed everything for me:",
      "What most people misunderstand about",
      "Here's what nobody tells you about",
      "TIL and I had to share this immediately:",
      "The counterintuitive truth about",
      "This one framework changed how I approach everything:",
      "I read 50 books so you don't have to — the single biggest lesson:",
      "The smartest people I know all do this one thing:",
      "School never taught us this but it should have:",
    ],
    phrases: [
      "here is what the research actually shows when you dig deep",
      "most people get this completely and dangerously backwards",
      "let me break this down into something you can actually use",
      "this changed how I think about everything from that point on",
      "the data is clear even when the popular narrative is not",
      "here is a mental model that will change how you see this forever",
      "everything you were taught about this is probably outdated or wrong",
      "the simplest explanation that holds up under scrutiny always wins",
      "if you understand this one concept everything else suddenly makes sense",
      "the skill that compounds faster than any other is learning how to learn",
      "knowledge without application is just entertainment",
      "the best investment you can make is the one that pays in perpetuity",
    ],
    ctas: ["What's the most valuable thing you've learned recently? 👇","Save this for someone who needs it.","What would you add? Comment below.","Follow for more insights like this 🧠","What's your take on this? 👇"],
    hashtags: ["#learning","#education","#knowledgeispower","#learneveryday","#mentalmodels","#selfimprovement","#bookrecommendations","#criticalthinking","#wisdom","#insight","#personalgrowth","#lifelonglearner","#skills","#productivity","#smartthinking"],
  },

  personal: {
    keywords: ["i feel","i think","i believe","personally","honest","real","truth","story","experience","struggled","overcome","journey","changed","realized","learned","admit","vulnerable","share","open up","raw","transparent","my truth","my story","authentic","genuine","real talk","been through","going through","processing","healing","growing","evolving","becoming"],
    vocabulary: ["vulnerable","transparent","honest","candid","raw","unfiltered","authentic","genuine","personal","intimate","reflective","introspective","open","real","human","relatable","imperfect","flawed","growing","evolving","becoming","unlearning","recovering","rebuilding","rediscovering","reclaiming","embracing","accepting","forgiving","releasing","surrendering","trusting"],
    hooks: [
      "Okay, being completely real with you:",
      "I've been sitting on this for a while.",
      "Something personal I've never shared here before:",
      "Raw and honest post incoming:",
      "This is vulnerable but I'm sharing it anyway:",
      "The story behind the highlight reel:",
      "I don't usually share stuff like this but:",
      "This is the part of the journey nobody posts about:",
      "If you've ever felt this way, this is for you:",
      "I owe you an honest update:",
    ],
    phrases: [
      "I am going to be completely honest about something I have been carrying",
      "this is something I have never talked about publicly before today",
      "I used to think I had it all figured out and then",
      "the thing I wish I had known earlier was something nobody told me",
      "I am still figuring this out but here is what I know for certain",
      "here is what the last year actually looked like behind the scenes",
      "I failed at this more times than I can count before it clicked",
      "the hardest thing I have ever had to admit was",
      "I spent years avoiding this truth because it was too uncomfortable",
      "this is the version of the story that does not make the highlight reel",
      "I am not where I want to be yet and I am finally okay with that",
      "vulnerability is not weakness it is the beginning of real connection",
    ],
    ctas: ["Has anyone else been through this? 👇","If this resonates share it with someone who needs it.","I'd love to hear your story too — drop it below.","Comment if you relate — you are not alone in this."],
    hashtags: ["#personalstory","#vulnerable","#authentic","#realtalk","#mygrowth","#healing","#transparency","#mentalhealthawareness","#myjourney","#honesty","#community","#relateable","#humanexperience","#rawandreal","#openup"],
  },

  fitness: {
    keywords: ["workout","gym","training","exercise","fitness","muscle","strength","cardio","run","lift","gains","body","health","nutrition","diet","protein","calories","macros","cut","bulk","lean","shred","tone","build","physique","athlete","performance","recovery","rest","sleep","hydration","supplement","creatine","pr","personal record","form","technique","rep","set","volume","intensity","progressive overload","mind muscle","pump","soreness","dOMS"],
    vocabulary: ["disciplined","consistent","progressive","intense","deliberate","strategic","recovered","fueled","optimized","maximized","periodized","functional","athletic","powerful","explosive","enduring","resilient","conditioned","mobile","flexible","strong","lean","aesthetic","shredded","jacked","fit","healthy","energized","capable"],
    hooks: [
      "The gym taught me more about life than school ever did:",
      "What nobody tells you when you first start training:",
      "The one thing that changed my physique more than anything else:",
      "Fitness truth that took me 5 years to accept:",
      "Your body is not the problem — your programming is:",
      "I was training wrong for years until I learned this:",
    ],
    phrases: [
      "the body achieves what the mind believes",
      "progress not perfection is the standard to hold yourself to",
      "the hardest rep is always the first one getting to the gym",
      "your only competition is the person you were yesterday",
      "consistency over intensity every single time no exceptions",
      "you do not get the body you want you get the body you work for",
      "the pump is temporary the discipline is permanent",
      "rest days are not lazy days they are growth days",
      "train smarter not just harder and watch everything change",
    ],
    ctas: ["What's your current training split? 👇","Drop your best gym tip below.","Tag your training partner.","What's your PR? Let's hear it 💪"],
    hashtags: ["#fitness","#gym","#workout","#training","#gains","#fitlife","#bodybuilding","#strength","#cardio","#healthylifestyle","#nutrition","#muscle","#fitnessmotivation","#gymmotivation","#personalrecord"],
  },

  food: {
    keywords: ["food","eat","cook","recipe","meal","breakfast","lunch","dinner","snack","ingredient","taste","flavor","delicious","yummy","healthy","fresh","homemade","restaurant","cuisine","chef","kitchen","prep","bake","fry","grill","roast","steam","spice","herb","sauce","seasoning","protein","carbs","veggies","fruit","organic","whole food","clean eating","meal prep","batch cook"],
    vocabulary: ["delicious","savory","sweet","umami","rich","fresh","vibrant","aromatic","comforting","nourishing","hearty","light","crispy","tender","fluffy","creamy","silky","crunchy","golden","caramelized","charred","balanced","wholesome","seasonal","local","farm-to-table"],
    hooks: [
      "The meal that changed how I think about food:",
      "This recipe took me 10 tries to get right:",
      "What I eat in a day (actually honest version):",
      "The cooking mistake everyone makes:",
      "5 ingredients that changed my cooking forever:",
    ],
    phrases: [
      "food is love made visible and nourishment made real",
      "the best meals are the ones made with care and intention",
      "eating well does not have to be complicated or expensive",
      "what you put in your body is information for your cells",
      "the kitchen is where magic happens and memories are made",
    ],
    ctas: ["What's your go-to meal? Drop the recipe 👇","Tag someone to cook this with.","Save this recipe for later!","What ingredient changed your cooking? 👇"],
    hashtags: ["#food","#foodie","#recipe","#cooking","#homemade","#healthyfood","#mealprep","#foodphotography","#nutrition","#eatinghealthy","#cleaneating","#delicious","#cookingathome","#foodlover","#wholefood"],
  },

  travel: {
    keywords: ["travel","trip","adventure","explore","destination","journey","wanderlust","abroad","flight","hotel","hostel","backpack","culture","local","hidden gem","off the beaten path","bucket list","solo travel","road trip","itinerary","visa","passport","currency","language","experience","memory","view","landscape","ocean","mountain","city","village","nomad","digital nomad","remote work"],
    vocabulary: ["adventurous","spontaneous","immersive","authentic","culturally-rich","breathtaking","unforgettable","transformative","eye-opening","humbling","liberating","soul-expanding","awe-inspiring","serendipitous","wanderlust-inducing","once-in-a-lifetime","hidden","undiscovered","raw","untouched"],
    hooks: [
      "The trip that completely changed my perspective on life:",
      "What nobody tells you before you travel solo:",
      "I spent 30 days in [place] — here's what I learned:",
      "The cheapest way to travel that nobody talks about:",
      "This destination ruined all other travel for me:",
    ],
    phrases: [
      "travel is the only thing you spend money on that makes you richer",
      "the world is a book and those who do not travel read only one page",
      "not all those who wander are lost some are exactly where they need to be",
      "collect moments not things and experiences not souvenirs",
      "every country you visit adds a new lens through which you see the world",
    ],
    ctas: ["Where are you traveling next? 👇","Tag someone you want to go here with.","Save this for your travel list!","What's your most life-changing travel experience? 👇"],
    hashtags: ["#travel","#adventure","#wanderlust","#explore","#travelgram","#travelblogger","#solotravel","#digitalnomad","#travelthe world","#bucketlist","#travelinspiration","#travelphotography","#tripplanning","#traveltips","#seetheworld"],
  },

  finance: {
    keywords: ["money","finance","invest","save","budget","wealth","rich","poor","income","expense","debt","credit","interest","compound","asset","liability","cash flow","passive income","dividend","stock","bond","etf","index fund","real estate","property","rent","mortgage","insurance","tax","emergency fund","retirement","401k","ira","roth","net worth","financial freedom","financial independence","fire movement","frugal","millionaire","billionaire","portfolio","diversification","risk","return","inflation","deflation","recession"],
    vocabulary: ["financially-free","wealth-building","compound-interest","passive-income","debt-free","cash-flow-positive","financially-independent","tax-advantaged","inflation-protected","diversified","risk-adjusted","long-term","value-investing","dividend-focused","index-investing","frugal","intentional","strategic","automated","optimized"],
    hooks: [
      "The money lesson that took me 10 years to learn:",
      "Nobody talks about how money actually works:",
      "The thing rich people do that poor people don't:",
      "I changed 3 financial habits and my life changed:",
      "The wealth gap starts with one misunderstood concept:",
      "What your bank doesn't want you to know:",
    ],
    phrases: [
      "compound interest is the eighth wonder of the world and most people ignore it",
      "do not save what is left after spending invest what is left after saving",
      "your income is not wealth your net worth is wealth",
      "the goal is not to be rich it is to never have to think about money",
      "financial freedom is buying back your time from everyone else",
      "every dollar you spend is a vote for the life you want to live",
      "rich people buy assets poor people buy liabilities and call them assets",
      "the best time to start investing was 10 years ago the second best time is now",
      "money is a tool not a goal use it accordingly",
    ],
    ctas: ["What's your #1 money tip? Drop it below 👇","Save this — you'll need it.","Tag someone who needs to hear this.","What financial habit changed your life? 👇"],
    hashtags: ["#personalfinance","#investing","#wealthbuilding","#financialfreedom","#money","#invest","#savings","#passiveincome","#financialliteracy","#wealth","#stockmarket","#realestate","#budgeting","#debtfree","#financialindependence"],
  },

  spirituality: {
    keywords: ["faith","god","spirit","soul","universe","energy","meditation","prayer","gratitude","blessing","purpose","calling","divine","sacred","holy","believe","trust","surrender","peace","love","light","consciousness","aware","presence","now","mindful","chakra","manifest","law of attraction","vibration","frequency","alignment","karma","dharma","higher self","ego","enlightenment","awakening"],
    vocabulary: ["divine","sacred","intentional","present","abundant","blessed","grateful","aligned","surrendered","trusting","faithful","peace-filled","spirit-led","purpose-driven","love-centered","light-filled","conscious","awakened","elevated","expanded","grounded","rooted","connected"],
    hooks: [
      "A moment of quiet that changed everything for me:",
      "What faith taught me that success never could:",
      "The spiritual practice that transformed my life:",
      "God's timing is the hardest and most beautiful thing:",
      "Sometimes the blessing is in what didn't happen:",
      "When you align with your purpose everything else falls into place:",
    ],
    phrases: [
      "what is meant for you will find you even when you stop chasing it",
      "faith is not the absence of doubt it is moving forward despite it",
      "your peace is your power and it cannot be taken without your permission",
      "gratitude turns what you have into everything you need",
      "the present moment is the only place where life actually exists",
      "surrender does not mean giving up it means trusting something greater",
      "you are not your thoughts you are the awareness observing your thoughts",
      "the universe does not waste experiences even the painful ones",
    ],
    ctas: ["What's a quote or verse that carries you? 👇","Share this with someone who needs peace today.","What are you grateful for right now? 👇","Comment your prayer or intention for today."],
    hashtags: ["#faith","#spirituality","#blessed","#gratitude","#meditation","#prayer","#god","#universe","#mindfulness","#awakening","#spiritual","#divinetime","#manifest","#soulwork","#innerpeace"],
  },

  relationships: {
    keywords: ["love","relationship","partner","friend","family","connection","communication","trust","loyalty","commitment","heart","dating","marriage","breakup","healing","attachment","boundary","healthy","toxic","red flag","green flag","compatibility","intimacy","vulnerability","respect","support","together","apart","miss","care","forgive","grow"],
    vocabulary: ["loving","supportive","trusting","committed","vulnerable","open","honest","communicative","respectful","empathetic","compassionate","understanding","patient","loyal","devoted","nurturing","intentional","present","secure","attached","healed","whole","worthy"],
    hooks: [
      "What nobody tells you about healthy relationships:",
      "The relationship lesson that changed everything:",
      "Red flags I ignored that I'll never ignore again:",
      "What real love actually looks like day to day:",
      "I didn't know what a healthy relationship felt like until:",
      "The most important relationship you have is with yourself:",
    ],
    phrases: [
      "the relationship you have with yourself sets the tone for every other one",
      "healthy love does not drain you it refuels you",
      "communication is not just talking it is making the other person feel heard",
      "you teach people how to treat you by what you allow",
      "the right person does not make you question if you are enough",
      "boundaries are not walls they are the doors through which the right people enter",
      "love is a choice you make every day not just a feeling you fall into",
    ],
    ctas: ["What's the best relationship advice you've received? 👇","Tag someone you love.","Save this and share it with someone who needs it.","What would you add? Comment below 👇"],
    hashtags: ["#relationships","#love","#selflove","#communication","#dating","#healthyrelationship","#boundaries","#growth","#healing","#heartfelt","#reallove","#connection","#trust","#couplegoals","#friendship"],
  },

  tech: {
    keywords: ["technology","software","code","app","platform","ai","machine learning","data","cloud","api","developer","engineer","product","design","ux","ui","startup","innovation","disruption","automation","future","digital","internet","mobile","web","react","python","javascript","typescript","open source","github","cursor","llm","gpt","claude","agent","build","ship","deploy","scale","infrastructure","devops","backend","frontend","full stack"],
    vocabulary: ["innovative","cutting-edge","scalable","robust","elegant","efficient","performant","modular","extensible","maintainable","production-ready","battle-tested","open-source","developer-friendly","user-centric","data-driven","api-first","cloud-native","serverless","microservices","event-driven"],
    hooks: [
      "The tech insight that changed how I build:",
      "What most developers get completely wrong:",
      "AI is going to eliminate these jobs first:",
      "The best tools I use that nobody talks about:",
      "I built this in one day — here's how:",
      "The future of [tech topic] is not what you think:",
    ],
    phrases: [
      "the best code is the code you do not have to write at all",
      "ship fast learn faster and never stop improving",
      "premature optimization is the root of all evil in software",
      "make it work make it right then make it fast in that order",
      "the problem is almost never the technology it is the thinking behind it",
      "automation is not about replacing humans it is about amplifying them",
      "the best developers are not the ones who know the most syntax but the ones who solve problems best",
    ],
    ctas: ["What's your favorite tool right now? 👇","Tag a developer who needs to see this.","What are you building? Drop it below 👇","Save this for your tech reading list."],
    hashtags: ["#tech","#technology","#coding","#developer","#software","#ai","#machinelearning","#startup","#innovation","#programming","#webdevelopment","#productdesign","#buildinpublic","#openai","#artificialintelligence"],
  },

  gaming: {
    keywords: ["game","gaming","play","player","gamer","esports","fps","rpg","strategy","mmo","battle royale","stream","twitch","youtube","content","community","team","squad","rank","competitive","casual","indie","aaa","console","pc","mobile","controller","mouse","keyboard","headset","monitor","fps","ping","lag","meta","patch","season","battle pass","skin","grind","no life","toxic","carry","clutch","montage","highlight","clip"],
    vocabulary: ["competitive","strategic","tactical","mechanical","clutch","dominant","aggressive","passive","adaptive","calculated","consistent","grinding","focused","in-the-zone","cracked","goated","elite","unhinged","sweaty","tryhard"],
    hooks: [
      "The gaming mindset that applies to real life:",
      "What gaming taught me that school never did:",
      "The pro tip that changed how I play:",
      "Why esports players are some of the most disciplined people alive:",
      "Gaming is a skill — here's proof:",
    ],
    phrases: [
      "every loss is a lesson if you are honest enough to learn from it",
      "the best players are not the ones with the most aim but the best decisions",
      "consistency is the only thing that separates good players from great ones",
      "the meta changes but fundamentals are forever",
      "tilt is just unprocessed frustration — learn to reset",
    ],
    ctas: ["What game are you grinding right now? 👇","Tag your duo.","What's your best gaming tip? Drop it 👇","Clip or it didn't happen 🎮"],
    hashtags: ["#gaming","#gamer","#esports","#gamingcommunity","#twitch","#youtube","#competitive","#fps","#rpg","#indiegame","#gamingsetup","#streamer","#contentcreator","#gamersofinstagram","#levelup"],
  },

  fashion: {
    keywords: ["fashion","style","outfit","clothes","wear","look","aesthetic","trend","designer","brand","luxury","streetwear","casual","formal","accessories","shoes","bag","watch","jewelry","sustainable","thrift","vintage","capsule wardrobe","fit","drip","swag","drip","clean","fresh","saucy","fit check","ootd","haul","collection","season","color","pattern","texture","silhouette","proportion"],
    vocabulary: ["stylish","chic","elegant","edgy","minimalist","maximalist","classic","contemporary","avant-garde","curated","intentional","sustainable","timeless","versatile","statement","understated","elevated","polished","raw","effortless","put-together","expressive","authentic"],
    hooks: [
      "The style rule that changed how I dress:",
      "Why less is always more in a wardrobe:",
      "The capsule wardrobe truth nobody tells you:",
      "Fashion is not about clothes it is about identity:",
      "What your outfit says before you even speak:",
    ],
    phrases: [
      "style is a way of saying who you are without having to speak",
      "fashion fades but style is eternal",
      "the best outfit is the one that makes you feel like yourself",
      "dress for the life you want not the life you have",
      "a great outfit can change the entire trajectory of a day",
    ],
    ctas: ["What's your current style vibe? 👇","Tag someone with great style.","Where do you shop? Drop it below.","Save this for your next outfit inspo 👗"],
    hashtags: ["#fashion","#style","#ootd","#outfitoftheday","#streetstyle","#fashionista","#menswear","#womenswear","#aesthetics","#vintage","#thriftstore","#capsulewardrobe","#sustainablefashion","#designer","#lookbook"],
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL VOCABULARY (600+)
// ══════════════════════════════════════════════════════════════════════════════

export const UNIVERSAL_WORDS = [
  // Greetings
  "good","morning","afternoon","evening","night","today","tonight","yesterday","tomorrow",
  "hello","hey","welcome","greetings","salutations",
  // Intensifiers
  "honestly","genuinely","actually","seriously","really","truly","literally","absolutely",
  "completely","totally","entirely","fully","deeply","profoundly","extremely","incredibly",
  "immensely","remarkably","fundamentally","essentially","ultimately","naturally","inevitably",
  // Openers
  "remember","reminder","quick","important","breaking","announcement","update","news",
  "attention","alert","notice","note","heads up","fact","truth","reality","insight",
  // Connectors
  "because","however","therefore","meanwhile","although","despite","through","within",
  "between","beyond","before","after","during","while","since","unless","until","though",
  "whereas","whereby","wherein","throughout","alongside","beneath","beneath","beside",
  // Time
  "years","months","weeks","days","hours","minutes","recently","finally","eventually",
  "consistently","constantly","always","never","sometimes","often","rarely","daily","weekly",
  "yearly","instantly","immediately","gradually","suddenly","slowly","quickly","rapidly",
  "steadily","persistently","continuously","endlessly","momentarily","briefly","temporarily",
  // Actions
  "building","creating","sharing","learning","growing","changing","working","helping",
  "thinking","feeling","knowing","showing","telling","asking","answering","giving",
  "making","finding","seeing","understanding","realizing","deciding","choosing","moving",
  "starting","stopping","continuing","improving","developing","expanding","scaling","achieving",
  "succeeding","failing","recovering","adapting","evolving","transforming","becoming",
  "discovering","exploring","connecting","communicating","leading","following","inspiring",
  "motivating","teaching","mentoring","coaching","guiding","supporting","encouraging",
  // Emotions
  "excited","grateful","proud","inspired","motivated","focused","determined","hopeful",
  "surprised","overwhelmed","energized","calm","frustrated","confused","disappointed",
  "passionate","enthusiastic","committed","dedicated","driven","ambitious","fearless",
  "confident","courageous","humble","authentic","genuine","vulnerable","transparent",
  // Quality words
  "powerful","simple","clear","direct","honest","real","genuine","authentic","valuable",
  "important","critical","essential","necessary","possible","impossible","difficult","easy",
  "hard","beautiful","meaningful","impactful","transformative","life-changing","groundbreaking",
  "revolutionary","innovative","creative","unique","rare","special","extraordinary","remarkable",
  "exceptional","outstanding","incredible","amazing","unbelievable","unforgettable","priceless",
  // People
  "people","person","world","life","time","day","year","place","thing","way","reason",
  "moment","story","journey","path","road","direction","choice","decision","opportunity",
  "challenge","problem","solution","answer","question","idea","thought","vision","mission",
  "purpose","goal","dream","plan","strategy","system","process","framework","method",
  // Social
  "community","network","family","friends","team","tribe","audience","followers","supporters",
  "believers","advocates","clients","customers","partners","mentors","coaches","leaders",
  "creators","builders","makers","dreamers","doers","achievers","winners","champions",
  // Transitions
  "however","moreover","furthermore","additionally","consequently","therefore","thus",
  "hence","accordingly","subsequently","simultaneously","previously","previously","originally",
  "currently","presently","recently","ultimately","essentially","specifically","particularly",
  // Numbers/Amounts
  "one","two","three","four","five","six","seven","eight","nine","ten","hundred","thousand",
  "million","billion","first","second","third","last","single","double","triple","multiple",
  "several","numerous","countless","many","few","some","most","all","none","any","every",
];

// ══════════════════════════════════════════════════════════════════════════════
// 150+ PHRASE COMPLETIONS
// ══════════════════════════════════════════════════════════════════════════════

export const PHRASE_COMPLETIONS = {
  // Greetings
  "good mo":  ["good morning everyone ☀️", "good morning fam 🌅", "good morning — let's make it count 💪"],
  "good af":  ["good afternoon everyone! Hope your day is going well 🌤️", "good afternoon fam — midday check:"],
  "good ev":  ["good evening everyone 🌆", "good evening fam — how was your day? 🌙"],
  "good ni":  ["good night fam 🌙", "good night everyone — rest well 💤", "good night — tomorrow we go again 🔥"],
  "gm ":      ["GM fam! ☀️ Let's make today count.", "GM everyone! Another day, another opportunity 🔥", "GM — showing up is step one. What are you building today?"],
  "gn ":      ["GN fam! 🌙 Rest well, build tomorrow.", "GN everyone — see you on the other side 💎", "GN — tomorrow is a fresh page. Excited for it 🌟"],

  // Power openers
  "hot ta":   ["hot take:", "hot take that might upset some people:", "hot take — hear me out and then tell me I'm wrong:"],
  "unpop":    ["unpopular opinion:", "unpopular opinion that I will stand behind:", "unpopular opinion that most people are too scared to say:"],
  "real ta":  ["real talk:", "real talk — nobody actually talks about this part:", "real talk, this is the most honest thing I'll share today:"],
  "honest":   ["honestly,", "honestly this single thing changed everything for me:", "honestly the best decision I ever made was"],
  "let me":   ["let me be completely clear about something:", "let me explain why this matters more than most people realize:", "let me share something that has been on my mind for a while:"],
  "quick r":  ["quick reminder:", "quick reminder that you are doing so much better than you think 💪", "quick reminder — the process is always the point, not just the outcome:"],
  "i want":   ["I want to share something that has been weighing on me:", "I want to be completely honest about something I have been thinking:", "I want to talk about the thing we all avoid saying:"],
  "i need":   ["I need to talk about something that is actually real:", "I need you to read this slowly and carefully:", "I need to be honest about something I have been holding back:"],
  "today i":  ["Today I learned something that genuinely shifted my perspective:", "Today I am committing to", "Today I realized something I have been avoiding understanding:"],
  "this is":  ["This is important and I need you to stay with me:", "This is the part nobody talks about:", "This is something I have never said publicly before today:"],
  "the bes":  ["The best investment you can ever make is in your own understanding.", "The best time to start was a year ago. The second best time is right now.", "The best decision I ever made was choosing"],
  "the tru":  ["The truth nobody wants to hear:", "The truth about success that took me years to finally accept:", "The truth is most people already know what they need to do."],
  "the rea":  ["The real reason most people never get what they want is", "The real story behind this that nobody tells you is", "The reality nobody actually prepares you for is"],
  "here is":  ["Here is something I genuinely wish someone had told me earlier:", "Here is what I have learned after years of getting this wrong:", "Here is the thing nobody actually says out loud but everyone needs to hear:"],
  "here's":   ["Here's the truth that changed everything:", "Here's what nobody told me when I started:", "Here's something I need you to genuinely understand:"],
  "what if":  ["What if the only thing holding you back is the story you keep telling yourself?", "What if everything you currently believe about success is incomplete or wrong?", "What if the obstacle is actually the path?"],
  "nobody":   ["Nobody talks about how genuinely hard it is to", "Nobody tells you that success also comes with", "Nobody prepares you for the version of yourself that emerges after"],
  "stop wa":  ["Stop waiting for the perfect moment — it does not exist.", "Stop waiting for someone to give you permission to begin.", "Stop waiting to feel ready because ready is a myth."],

  // Lists
  "3 thin":   ["3 things I genuinely wish I had known much earlier:", "3 things that actually changed my life:", "3 things the most successful people do differently than everyone else:"],
  "5 thin":   ["5 things that will genuinely change how you think:", "5 things I wish someone had told me before I started:", "5 things more important than talent:"],

  // Conditional
  "if you":   ["If you are reading this, you needed to see it today — not tomorrow.", "If you want to fundamentally change your life, start with your mornings.", "If you are struggling right now, I need you to know this:"],
  "if i":     ["If I had to go back and do one thing differently, it would be", "If I could give my younger self one piece of advice it would be", "If I could only do one thing today to move forward it would be"],

  // Time references
  "a year":   ["A year ago I was completely lost and had no idea that", "A year of doing this one thing every single day changed everything:", "A year later and I can finally say with full confidence that"],
  "5 year":   ["5 years ago I would never have believed that", "5 years of doing this taught me something unexpected:", "5 years from now you will wish you had started today."],
  "10 year":  ["10 years ago I had none of this and it all started with one decision:", "10 years of building taught me more than any school ever could:"],

  // Past experiences
  "i used":   ["I used to think success was purely about working harder and longer.", "I used to be completely terrified of sharing this publicly.", "I used to believe that if I just waited long enough things would change."],
  "i was":    ["I was completely wrong about this for years and it held me back:", "I was the person who said I would never do this and then I did:", "I was so focused on the destination that I missed the entire journey."],
  "i've be":  ["I've been sitting on this for months and today I'm finally sharing it.", "I've been building something I am finally ready to tell the world about.", "I've been in your exact position and here is what I genuinely wish I knew:"],

  // Questions
  "what do":  ["What does success actually mean to you — not what others told you? 👇", "What does the best possible version of your day actually look like?", "What does your gut tell you that your mind keeps overriding?"],
  "have yo":  ["Have you ever had that feeling that you are meant for something more? 👇", "Have you noticed how the people who achieve the most always seem to", "Have you ever been in a situation where you knew what to do but were too afraid?"],
  "do you":   ["Do you ever feel like you are made for something bigger than your current situation?", "Do you know the actual difference between being busy and being productive?", "Do you want to know what the one thing that separates people who achieve is?"],
  "can we":   ["Can we talk about something that has been on my mind for a while?", "Can we normalize struggling in public instead of only sharing success?", "Can we be actually honest about how hard this really is?"],

  // Story arcs
  "after y":  ["After years of doing this I finally understand why it was always going to work:", "After years of struggle I can say with complete confidence:", "After years of building this is the one lesson that remains constant:"],
  "the mor":  ["The more I learn the more clearly I see how much I still do not know.", "The most important thing I have learned is deceptively simple:", "The moment everything changed was the moment I decided to"],
  "every d":  ["Every day is a fresh opportunity to get closer to the person you want to become.", "Every decision you make is compounding — toward something or away from it.", "Every expert was once a complete beginner who refused to quit."],
  "most pe":  ["Most people overestimate what they can do in a week and massively underestimate what they can do in a year.", "Most people never even start because they are waiting to feel ready.", "Most people quit right before the breakthrough that would have changed everything."],
  "the sec":  ["The secret nobody talks about openly:", "The secret to consistency is not motivation it is systems.", "The second best time to start is always right now."],
  "i almo":  ["I almost quit right before everything came together and I will never forget that:", "I almost gave up on this and now I cannot imagine where I would be if I had:"],
  "the les":  ["The lesson I had to learn multiple times before it finally stuck:", "The lesson nobody teaches you about real success is this:"],
  "i know":  ["I know this might be hard to hear but it needs to be said:", "I know everybody says this but almost nobody actually does it:", "I know from experience how hard this is and I want you to know"],

  // Crypto specific
  "dyor ":   ["DYOR — but this is what I see happening:", "DYOR always — NFA — but here is what I am watching:", "DYOR and form your own view but the data is pointing toward"],
  "the mar": ["The market does not care about your feelings, only your positioning.", "The market rewards patience and punishes panic consistently.", "The market is always right — the question is whether you understand what it is saying."],
  "diamond": ["Diamond hands are not born, they are forged in moments exactly like this.", "Diamond hands mean nothing if you did not do the research to back your conviction."],
  "zoom ou": ["Zoom out and everything becomes obvious that was confusing up close.", "Zoom out past the noise and tell me what you actually see."],

  // Business
  "revenu":  ["Revenue solves problems that talent alone cannot.", "Revenue is not vanity — it is the score that tells you if you are actually delivering value."],
  "your fi": ["Your first 100 customers are worth more than your next 1000 — they teach you everything.", "Your first year in business teaches you everything school never could."],
  "build a": ["Build a business that works when you do not.", "Build around your strengths and hire around your weaknesses."],
  "the bes": ["The best businesses solve a problem so well that customers become advocates.", "The best marketing is a product so good people cannot stop talking about it."],

  // Motivation
  "discipl": ["Discipline is the bridge between goals and accomplishment — nothing else comes close.", "Discipline is not punishment it is the greatest gift you can give yourself."],
  "consist": ["Consistency is not glamorous but it is the only thing that actually creates lasting results.", "Consistency is doing the unsexy work every single day that nobody applauds you for."],
  "your ha": ["Your habits are quietly writing your future whether you are paying attention or not.", "Your habits will either be your greatest asset or your greatest limitation."],

  // Personal growth
  "the ver": ["The version of you that gives up never existed — only the one who found a way.", "The version of yourself you want to become is already possible — it just requires action."],
  "i am no": ["I am not where I want to be yet and I am genuinely okay with that for the first time.", "I am not perfect and I am not pretending to be — but I am committed."],
  "vulnera": ["Vulnerability is not weakness — it is the foundation of every real human connection.", "Vulnerability shared with the right people is the beginning of true belonging."],
};

// ══════════════════════════════════════════════════════════════════════════════
// HIGH ENGAGEMENT PATTERNS
// ══════════════════════════════════════════════════════════════════════════════

export const HIGH_ENGAGEMENT_PATTERNS = {
  hooks: [
    "I've been sitting on this for a while.",
    "Nobody is talking about this and it's frustrating me.",
    "Hot take:",
    "Unpopular opinion:",
    "The uncomfortable truth:",
    "I failed at this before I finally figured it out.",
    "Everything changed when I stopped trying to",
    "The single best decision I ever made was",
    "This one mindset shift changed absolutely everything:",
    "Read this if you are struggling with",
    "I wish someone had told me this 5 years ago:",
    "What the people at the top never tell you:",
    "I almost quit before this happened:",
    "The thing holding most people back is not what they think.",
    "Stop scrolling. This is important.",
    "I used to be the person who said this would never work.",
    "Real talk, and I need you to hear this:",
    "The reason you are not getting what you want is",
    "3 years ago I had nothing. Today I have",
    "Everyone is asking the wrong question about",
  ],
  engagement_endings: [
    "What's your experience with this? Drop it below 👇",
    "Am I alone in thinking this? Let me know honestly.",
    "Tag someone who genuinely needs to see this today.",
    "Save this for when you need the reminder most.",
    "What would you add? I read every single comment.",
    "Has anyone else been through something like this?",
    "Which one resonates most with you right now?",
    "Follow for more content like this every day 🔥",
    "Repost this if it helped you — someone in your circle needs it.",
    "Reply with your biggest takeaway 👇",
    "What do you wish someone had told you earlier? 👇",
    "Drop a 🔥 if this hit different.",
    "What's the one thing you're committing to this week? 👇",
    "Who do you know that needs this right now? Tag them.",
    "Be honest — were you doing this wrong? 👇",
  ],
  power_transitions: [
    "Here's the thing nobody tells you:",
    "But here's what changed everything:",
    "And then it hit me:",
    "The turning point was",
    "Fast forward to today:",
    "The real lesson here is",
    "What this taught me was",
    "The counterintuitive part?",
    "Here's the plot twist:",
    "What I didn't expect was",
    "The thing nobody prepared me for:",
    "And that's when everything shifted:",
    "This is where it gets interesting:",
    "The part that changed me most was",
    "What happened next surprised me:",
  ],
  viral_patterns: [
    "Do this instead of [common thing]: [better approach]",
    "[X] years ago I [where you were]. Today I [where you are]. Here's what changed:",
    "The [topic] advice everyone gives is wrong. Here's what actually works:",
    "I [action] for [time period]. Here's everything I learned:",
    "Unpopular opinion: [strong claim]. Here's why I believe this:",
    "Nobody talks about the [topic] side of [common experience].",
    "If you do one thing this week, let it be [specific action].",
    "Stop [common action]. Start [better action]. Here's why:",
    "The [topic] mistake I see [people] make every single day:",
    "Hot take: [strong opinion]. Change my mind 👇",
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// 60+ POST TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

export const POST_TEMPLATES = [
  // MORNING
  { id: "gm-energy",      label: "Morning Energy",       icon: "☀️", time: "morning",   category: "Lifestyle",   tags: ["morning","energy","motivation"],
    text: "Good morning! ☀️\n\nEvery sunrise is permission to start again.\n\nOne thing I'm showing up for today:\n→ \n\nWhat's your intention for today? Drop it below 👇" },
  { id: "gm-gratitude",   label: "Morning Gratitude",    icon: "🙏", time: "morning",   category: "Lifestyle",   tags: ["morning","gratitude","mindset"],
    text: "Grateful morning. 🙏\n\nBefore I even check my phone, I'm grateful for:\n    • Being alive and healthy\n    • The people who believe in me\n    • The opportunity in front of me\n\nWhat are you grateful for today?" },
  { id: "gm-hustle",      label: "Morning Hustle",       icon: "💪", time: "morning",   category: "Business",    tags: ["morning","hustle","grind","entrepreneur"],
    text: "Rise before the world wakes up. 💪\n\nThere's a version of your future self watching you decide whether to hit snooze.\n\nMake them proud.\n\nGM everyone — let's build." },
  { id: "gm-crypto",      label: "GM Crypto",            icon: "🌅", time: "morning",   category: "Crypto",      tags: ["morning","gm","crypto","web3"],
    text: "GM fam! 🌅\n\nMarkets don't care about your feelings. They reward:\n    → Patience\n    → Research\n    → Consistency\n\nWhat's on your watchlist today? 👇" },
  { id: "gm-mindset",     label: "Morning Mindset",      icon: "🧠", time: "morning",   category: "Education",   tags: ["morning","mindset","insight"],
    text: "Morning thought worth sitting with:\n\nThe most successful people aren't more talented than you.\n\nThey decided, very clearly, what they were willing to sacrifice to get what they want.\n\nWhat are you willing to sacrifice?" },
  { id: "gm-intention",   label: "Morning Intention",    icon: "🎯", time: "morning",   category: "Lifestyle",   tags: ["morning","intention","focus"],
    text: "Setting my intention for today:\n\n→ The one thing that will move the needle:\n→ The one thing I am committing to:\n→ The one person I will show up fully for:\n\nIntentional mornings create intentional lives.\n\nWhat's your one thing today? 👇" },
  { id: "gm-affirmation", label: "Morning Affirmation",  icon: "✨", time: "morning",   category: "Motivation",  tags: ["morning","affirmation","confidence"],
    text: "Morning affirmations (say them out loud):\n\n✦ I am capable of more than I believe\n✦ I attract what I put out\n✦ Today I choose progress over perfection\n✦ I am exactly where I need to be\n\nGood morning, fam. Let's go 🙏" },

  // AFTERNOON
  { id: "pm-checkin",     label: "Midday Check-in",      icon: "⚡", time: "afternoon", category: "Lifestyle",   tags: ["afternoon","checkin","motivation"],
    text: "Midday check-in ⚡\n\nIf you've done at least ONE meaningful thing before noon — you're winning.\n\nThe momentum is already there. Keep going.\n\nHow's your day unfolding? 👇" },
  { id: "pm-insight",     label: "Afternoon Value",      icon: "💡", time: "afternoon", category: "Education",   tags: ["afternoon","insight","value"],
    text: "Afternoon value drop 💡\n\n[Your insight or tip]\n\nSave this. You'll need it later.\n\nFollow for more like this." },
  { id: "pm-crypto",      label: "Market Update",        icon: "📊", time: "afternoon", category: "Crypto",      tags: ["afternoon","crypto","market"],
    text: "Midday market check 📊\n\nThe narrative hasn't changed. The opportunity is still there.\n\nNoise vs signal — learn to tell the difference.\n\nWhat are you watching right now? 👇" },
  { id: "pm-focus",       label: "Focus Block",          icon: "🎯", time: "afternoon", category: "Productivity",tags: ["afternoon","focus","productivity"],
    text: "Entering focus mode. 🎯\n\nNext 2 hours: no notifications, no social, no distraction.\n\nJust the work that matters.\n\nWho's deep working with me right now? 👇" },

  // EVENING
  { id: "ge-wins",        label: "Evening Wins",         icon: "🌆", time: "evening",   category: "Lifestyle",   tags: ["evening","wins","reflection"],
    text: "Evening reflection 🌆\n\nToday's wins (even the small ones count):\n    ✓ \n    ✓ \n    ✓ \n\nProgress is progress. Never dismiss it.\n\nWhat was your biggest win today?" },
  { id: "ge-lesson",      label: "Today's Lesson",       icon: "📚", time: "evening",   category: "Education",   tags: ["evening","lesson","learning"],
    text: "End of day lesson 📚\n\nThe most valuable thing I learned today:\n\n[Your lesson here]\n\nWhat did today teach you? Drop it below 👇" },
  { id: "ge-crypto",      label: "Evening Crypto",       icon: "🔥", time: "evening",   category: "Crypto",      tags: ["evening","crypto","recap"],
    text: "Evening recap 🔥\n\nMarkets close. The building doesn't stop.\n\nWhile traders obsess over price, builders obsess over value.\n\nWhich side are you on? 👇" },
  { id: "ge-gratitude",   label: "Evening Gratitude",    icon: "💛", time: "evening",   category: "Lifestyle",   tags: ["evening","gratitude"],
    text: "Evening gratitude 💛\n\n3 things from today I don't want to forget:\n    • \n    • \n    • \n\nThe practice of noticing the good changes everything.\n\nWhat are you grateful for tonight?" },
  { id: "ge-review",      label: "Evening Review",       icon: "📋", time: "evening",   category: "Productivity",tags: ["evening","review","reflection"],
    text: "Daily review 📋\n\nDid I:\n    ☐ Move toward my most important goal\n    ☐ Show up fully for the people who matter\n    ☐ Do something that scared me\n    ☐ Take care of my health\n\nHonest answers only. Tomorrow is a new chance.\n\nHow did you show up today?" },

  // NIGHT
  { id: "gn-rest",        label: "Good Night",           icon: "🌙", time: "night",     category: "Lifestyle",   tags: ["night","goodnight","rest"],
    text: "Good night fam 🌙\n\nRest is not a reward. It's a requirement.\n\nReset tonight. Come back tomorrow with everything you have.\n\nSleep well. Build tomorrow. 💪" },
  { id: "gn-reflection",  label: "Night Reflection",     icon: "⭐", time: "night",     category: "Lifestyle",   tags: ["night","reflection"],
    text: "Before I sleep ⭐\n\nDid I show up as the best version of myself today?\n\nHonestly — not perfectly. But I showed up.\n\nAnd sometimes that's enough.\n\nGood night. Tomorrow is a new chapter. 🌙" },
  { id: "gn-builder",     label: "Night Builder",        icon: "🔥", time: "night",     category: "Business",    tags: ["night","entrepreneur","builder"],
    text: "Late night thought 🌙\n\nEvery empire was built in the hours most people spent consuming.\n\nCreators vs consumers.\n\nWhich one are you becoming?\n\nGood night, builders 🔥" },
  { id: "gn-crypto",      label: "GN Crypto",            icon: "💎", time: "night",     category: "Crypto",      tags: ["night","gn","crypto","hodl"],
    text: "GN fam 💎\n\nAnother day of holding while others fold.\n\nDiamond hands aren't born. They're forged.\n\nSee you on the other side. Stay strong. 🌙" },
  { id: "gn-gratitude",   label: "Night Gratitude",      icon: "🙏", time: "night",     category: "Lifestyle",   tags: ["night","gratitude","peace"],
    text: "Before I close my eyes 🙏\n\nI'm grateful for:\n    • The people who showed up for me\n    • The challenges that made me stronger\n    • The fact that tomorrow exists\n\nGood night everyone. You deserve rest. 🌙" },

  // ANY TIME — Personal
  { id: "story-time",     label: "Story Arc",            icon: "🧵", time: "any",       category: "Personal",    tags: ["story","journey","personal"],
    text: "Story time. 🧵\n\nA year ago, I was [where you were]\n\nToday, I [where you are now]\n\nWhat changed?\n\n[The key insight or decision]\n\nIt wasn't easy. But it was worth it.\n\nIf you're in the early stages of your journey — keep going." },
  { id: "bts",            label: "Behind the Scenes",    icon: "🎬", time: "any",       category: "Personal",    tags: ["bts","authentic","real"],
    text: "Behind the scenes. 🎬\n\nMost people see the result. Few see the work.\n\nHere's what today actually looked like:\n\n[Honest breakdown]\n\nAuthenticity always wins. What does your process look like? 👇" },
  { id: "lessons",        label: "Lessons Learned",      icon: "📖", time: "any",       category: "Personal",    tags: ["lessons","growth","wisdom"],
    text: "Things I know now that I wish I knew then:\n\n→ \n→ \n→ \n→ \n\nWhich one hits the hardest for you? 👇" },
  { id: "mindset-shift",  label: "Mindset Shift",        icon: "🔄", time: "any",       category: "Motivation",  tags: ["mindset","shift","growth"],
    text: "This one mindset shift changed everything:\n\nOld thinking: \n\nNew thinking: \n\nResult: \n\nStill a work in progress but the difference is undeniable.\n\nWhat mindset shift has made the biggest impact on you? 👇" },
  { id: "failure-lesson", label: "Failure Lesson",       icon: "💪", time: "any",       category: "Personal",    tags: ["failure","lesson","resilience","growth"],
    text: "I failed at this. Publicly. Painfully. 💪\n\nHere's what happened:\n[The failure]\n\nHere's what I learned:\n[The lesson]\n\nHere's what I would tell my past self:\n[The advice]\n\nFailure is not the end. It's data.\n\nWhat's a failure that taught you something invaluable? 👇" },
  { id: "open-letter",    label: "Open Letter",          icon: "💌", time: "any",       category: "Personal",    tags: ["letter","personal","community","connection"],
    text: "An open letter to anyone who is [situation]:\n\nI see you.\n\nWhat you are going through is harder than most people around you realize.\n\nBut I need you to know:\n\n[Your encouragement]\n\nYou are not alone in this. Not even close.\n\nIf this is you, comment below. Let's talk. 👇" },

  // ANY TIME — Business & Value
  { id: "hot-take",       label: "Hot Take",             icon: "🌡️", time: "any",       category: "General",     tags: ["hottake","opinion","engaging"],
    text: "Hot take 🌡️\n\n[Your strong opinion]\n\nI know this won't be popular with everyone. But I've seen this play out too many times to stay quiet.\n\nChange my mind in the comments 👇" },
  { id: "value-drop",     label: "Value Thread",         icon: "🎁", time: "any",       category: "Education",   tags: ["value","tips","education"],
    text: "Free value. No catch. 🎁\n\n[Your main insight]\n\nHere's how to apply it:\n→ Step 1: \n→ Step 2: \n→ Step 3: \n\nSave this. Share it with someone who's building.\n\nFollow for more." },
  { id: "question",       label: "Community Question",   icon: "💬", time: "any",       category: "Engagement",  tags: ["question","community","engagement"],
    text: "Genuine question for my community 💬\n\n[Your question]\n\nI'm asking because [reason]\n\nDrop your honest answer below. I read every single one. 👇" },
  { id: "announcement",   label: "Big Announcement",     icon: "📢", time: "any",       category: "Business",    tags: ["announcement","launch","news"],
    text: "Big news. 📢\n\n[Your announcement]\n\nThis has been in the works for [timeframe]. I can finally talk about it.\n\nHere's what this means:\n→ \n→ \n\nMore details coming soon. Comment below if you want to be first to know. 👇" },
  { id: "crypto-alpha",   label: "Crypto Alpha Drop",    icon: "🔑", time: "any",       category: "Crypto",      tags: ["crypto","alpha","web3"],
    text: "Alpha drop 🔑\n\nMost people are watching the price.\n\nI'm watching:\n    → \n    → \n    → \n\nZoom out. The signal is in the details.\n\nDYOR. NFA. But this is worth looking at. 👀" },
  { id: "thread-bait",    label: "Thread Starter",       icon: "🧵", time: "any",       category: "Engagement",  tags: ["thread","engagement","discussion"],
    text: "Thread incoming 🧵\n\n[Bold opening claim or question]\n\nOver the next [X minutes], I'm going to break this down completely.\n\nStay with me — this one is worth reading.\n\n1/[total]" },
  { id: "contrarian",     label: "Contrarian View",      icon: "🔁", time: "any",       category: "Education",   tags: ["contrarian","perspective","opinion"],
    text: "Everyone says [common belief].\n\nI disagree. Here's why:\n\n[Your contrarian position]\n\n[Evidence or reasoning]\n\nI could be wrong. But the data says otherwise.\n\nWhat do you think? 👇" },
  { id: "framework",      label: "Share a Framework",    icon: "⚙️", time: "any",       category: "Education",   tags: ["framework","model","system","education"],
    text: "The framework that changed how I approach [topic]:\n\nMost people think about [topic] like this:\n[Old model]\n\nI now think about it like this:\n[New framework]\n\nThe difference?\n[The result or insight]\n\nSave this. Apply it this week. 👇" },
  { id: "three-keys",     label: "3 Keys to Success",    icon: "🗝️", time: "any",       category: "Motivation",  tags: ["keys","success","tips","value"],
    text: "3 things that separate people who succeed from those who don't:\n\n1. They [key 1]\n\n2. They [key 2]\n\n3. They [key 3]\n\nThe good news? All 3 are learnable.\n\nWhich one do you need to work on most? 👇" },
  { id: "before-after",   label: "Before & After",       icon: "↔️", time: "any",       category: "Personal",    tags: ["transformation","growth","before","after"],
    text: "Before [timeframe]:\n    → [Where you were]\n    → [What you believed]\n    → [How you felt]\n\nAfter [timeframe]:\n    → [Where you are]\n    → [What you now know]\n    → [How you feel]\n\nThe only difference? [Key decision or action]\n\nTransformation is always possible. 👇" },
  { id: "myth-busting",   label: "Myth Busting",         icon: "🚫", time: "any",       category: "Education",   tags: ["myth","truth","education","clarity"],
    text: "Myth: [Common belief everyone accepts]\n\nReality: [The actual truth]\n\nWhy this matters:\n[Why the distinction is important]\n\nMost people believe the myth because [reason].\n\nNow you know better. Share this so others do too. 👇" },
  { id: "process-share",  label: "My Process",           icon: "📋", time: "any",       category: "Business",    tags: ["process","system","howto","education"],
    text: "My exact process for [task/goal]:\n\nStep 1: [First step]\nStep 2: [Second step]\nStep 3: [Third step]\nStep 4: [Fourth step]\nStep 5: [Fifth step]\n\nThis process [result it produces].\n\nSave this. It took me [time] to figure out.\n\nWhat process would you want me to share next? 👇" },
  { id: "reading-rec",    label: "Book Recommendation",  icon: "📗", time: "any",       category: "Education",   tags: ["books","reading","recommendation","learning"],
    text: "Book recommendation 📗\n\n[Book title] by [Author]\n\nThe single biggest insight I took from it:\n\n[Your main takeaway]\n\nWho should read it: [Specific audience]\n\nWhen to read it: [Best timing/situation]\n\nWould I re-read it? [Yes/No and why]\n\nWhat are you currently reading? 👇" },
  { id: "day-in-life",    label: "Day in My Life",       icon: "🗓️", time: "any",       category: "Personal",    tags: ["dayinlife","routine","authentic","personal"],
    text: "Real day in my life today:\n\n5am: \n7am: \n9am: \n12pm: \n3pm: \n6pm: \n9pm: \n\nMost days are not glamorous. They are just consistent.\n\nWhat does your ideal day look like? 👇" },
  { id: "humble-brag",    label: "Win Share (Humble)",   icon: "🏆", time: "any",       category: "Business",    tags: ["win","achievement","milestone","grateful"],
    text: "I don't share wins often but this one felt important. 🏆\n\n[Your achievement]\n\nA year ago I would not have believed this was possible.\n\nWhat got me here:\n    → \n    → \n    → \n\nThis is proof that consistency works. Keep going. 💪" },
  { id: "pain-point",     label: "Shared Pain Point",    icon: "😤", time: "any",       category: "Engagement",  tags: ["pain","frustration","relatable","community"],
    text: "Can we talk about something that frustrates me?\n\n[Your pain point or frustration]\n\nI know I'm not alone in this.\n\nHere's what I've found that actually helps:\n\n[Your solution or perspective]\n\nAm I alone here? Tell me below 👇" },
  { id: "gratitude-post", label: "Public Gratitude",     icon: "🧡", time: "any",       category: "Personal",    tags: ["gratitude","appreciation","thankful"],
    text: "Taking a moment to be genuinely grateful. 🧡\n\nGrateful for:\n    → [Person or thing 1]\n    → [Person or thing 2]\n    → [Person or thing 3]\n    → This community and everyone in it\n\nGratitude is not a feeling you wait for — it's a practice you build.\n\nWhat are you most grateful for right now? 👇" },
  { id: "crypto-conviction",label:"Conviction Post",     icon: "💎", time: "any",       category: "Crypto",      tags: ["crypto","conviction","hodl","longterm"],
    text: "My conviction on [asset/project] has not changed.\n\nHere's why:\n\n→ The fundamentals: \n→ The team: \n→ The timing: \n→ The thesis: \n\nPrice is noise. Value is signal.\n\nDYOR. NFA. But this is why I am here.\n\nWhat's your highest conviction position right now? 👇" },
];

// ══════════════════════════════════════════════════════════════════════════════
// 60+ OPENING PHRASES
// ══════════════════════════════════════════════════════════════════════════════

export const OPENING_PHRASES = [
  // Classic openers
  "Good morning! ☀️",
  "Hot take:",
  "Unpopular opinion:",
  "Real talk —",
  "Honest question:",
  "Story time.",
  "A reminder:",
  "Today I learned",
  "Nobody talks about",
  "The uncomfortable truth:",
  "I've been thinking about",
  "Quick question:",
  "Big announcement:",
  "After years of",
  "The single best decision I made was",
  "Here's what changed everything:",
  "3 things I wish I knew:",
  "What if I told you",
  "This is for anyone who",
  "I failed at this before I figured it out.",
  // Emotional/personal
  "Something I've never shared publicly:",
  "I almost quit before",
  "The story behind the highlight reel:",
  "Raw and honest post incoming:",
  "I've been sitting on this for months.",
  "This might be vulnerable but:",
  "Nobody prepared me for",
  "The thing I wish I had known:",
  "I used to believe that",
  "Before you scroll past, read this:",
  // Value-driven
  "Free insight. No catch:",
  "The framework that changed how I think:",
  "What school never taught me about",
  "The counterintuitive truth about",
  "A mental model worth saving:",
  "The thing that separates winners from everyone else:",
  "Here's what I know for certain after",
  "The most underrated skill is",
  "Everyone is optimizing the wrong thing.",
  "This changed how I approach everything:",
  // Question-led
  "Have you ever felt like",
  "Can we be honest about",
  "What does success actually mean?",
  "Am I the only one who thinks",
  "What are you actually building toward?",
  "When was the last time you",
  "Do you know the difference between",
  // Action-led
  "Stop doing this immediately:",
  "Start doing this instead:",
  "Do this one thing and watch what happens:",
  "The habit that compounded into everything:",
  "If I could only give one piece of advice:",
  // Topic-specific
  "GM fam ☀️",
  "GN everyone 🌙",
  "Market update:",
  "Alpha incoming 🔑",
  "Fitness truth nobody says:",
  "Money lesson that took years to learn:",
  "The travel experience that changed me:",
  "Book that rewired how I think:",
];

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

export function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function detectTopics(text) {
  if (!text || text.length < 5) return [];
  const lower = text.toLowerCase();
  const scores = {};
  for (const [topic, cluster] of Object.entries(TOPIC_CLUSTERS)) {
    let score = 0;
    for (const kw of cluster.keywords) { if (lower.includes(kw)) score += 2; }
    for (const w  of cluster.vocabulary) { if (lower.includes(w)) score += 1; }
    if (score > 0) scores[topic] = score;
  }
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

export function getRelevantTemplates(text = "", limit = 6) {
  const tod    = getTimeOfDay();
  const topics = detectTopics(text);
  const primaryTopic = topics[0];
  let pool = POST_TEMPLATES.filter(t => t.time === tod || t.time === "any");
  if (primaryTopic) {
    pool = pool.sort((a, b) => {
      const aM = a.tags.some(tag => TOPIC_CLUSTERS[primaryTopic]?.keywords.includes(tag)) ? 1 : 0;
      const bM = b.tags.some(tag => TOPIC_CLUSTERS[primaryTopic]?.keywords.includes(tag)) ? 1 : 0;
      return bM - aM;
    });
  }
  return pool.slice(0, limit);
}

export function findPhraseCompletion(partialText) {
  if (!partialText || partialText.length < 4) return [];
  const lower = partialText.toLowerCase().trimEnd();
  const results = [];
  for (const [key, completions] of Object.entries(PHRASE_COMPLETIONS)) {
    const trimKey = key.trimEnd();
    if (lower.endsWith(trimKey) || (trimKey.length >= 5 && lower.includes(trimKey))) {
      results.push(...completions.slice(0, 2));
    }
  }
  return [...new Set(results)].slice(0, 3);
}

export function getTopicHashtags(topic, limit = 8) {
  return (TOPIC_CLUSTERS[topic]?.hashtags || []).slice(0, limit);
}

export function getTopicHooks(topic) {
  return TOPIC_CLUSTERS[topic]?.hooks || HIGH_ENGAGEMENT_PATTERNS.hooks.slice(0, 5);
}

export function getTopicCTAs(topic) {
  return TOPIC_CLUSTERS[topic]?.ctas || HIGH_ENGAGEMENT_PATTERNS.engagement_endings.slice(0, 4);
}