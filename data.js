/* ============================================================
   Hardwood — data layer
   Figures reflect the 2024·25 NBA season (final) and are rounded
   for display. Curated reference dataset for a design study.
   Season logs cover recent, high-confidence seasons.
   ============================================================ */
window.DB = (function () {

  /* ---------- TEAMS ---------- */
  // id, city, name, abbr, conf, div, color, arena, coach, w, l, off, def, pace
  const teams = {
    okc:{city:"Oklahoma City",name:"Thunder",abbr:"OKC",conf:"West",color:"#007AC1",arena:"Paycom Center",coach:"Mark Daigneault",w:68,l:14,off:119.2,def:106.6,pace:100.9,seed:1},
    hou:{city:"Houston",name:"Rockets",abbr:"HOU",conf:"West",color:"#CE1141",arena:"Toyota Center",coach:"Ime Udoka",w:52,l:30,off:114.9,def:109.6,pace:99.5,seed:2},
    lal:{city:"Los Angeles",name:"Lakers",abbr:"LAL",conf:"West",color:"#552583",arena:"Crypto.com Arena",coach:"JJ Redick",w:50,l:32,off:115.5,def:113.5,pace:98.3,seed:3},
    den:{city:"Denver",name:"Nuggets",abbr:"DEN",conf:"West",color:"#0E2240",arena:"Ball Arena",coach:"David Adelman",w:50,l:32,off:119.7,def:114.0,pace:98.6,seed:4},
    lac:{city:"Los Angeles",name:"Clippers",abbr:"LAC",conf:"West",color:"#1D428A",arena:"Intuit Dome",coach:"Tyronn Lue",w:50,l:32,off:115.6,def:109.4,pace:97.6,seed:5},
    min:{city:"Minnesota",name:"Timberwolves",abbr:"MIN",conf:"West",color:"#236192",arena:"Target Center",coach:"Chris Finch",w:49,l:33,off:115.7,def:110.8,pace:98.0,seed:6},
    gsw:{city:"Golden State",name:"Warriors",abbr:"GSW",conf:"West",color:"#1D428A",arena:"Chase Center",coach:"Steve Kerr",w:48,l:34,off:114.9,def:110.9,pace:99.8,seed:7},
    mem:{city:"Memphis",name:"Grizzlies",abbr:"MEM",conf:"West",color:"#5D76A9",arena:"FedExForum",coach:"Tuomas Iisalo",w:48,l:34,off:117.9,def:112.7,pace:103.3,seed:8},
    dal:{city:"Dallas",name:"Mavericks",abbr:"DAL",conf:"West",color:"#00538C",arena:"American Airlines Center",coach:"Jason Kidd",w:39,l:43,off:113.6,def:114.2,pace:97.4,seed:10},
    sac:{city:"Sacramento",name:"Kings",abbr:"SAC",conf:"West",color:"#5A2D81",arena:"Golden 1 Center",coach:"Doug Christie",w:40,l:42,off:115.4,def:115.0,pace:100.3,seed:9},
    phx:{city:"Phoenix",name:"Suns",abbr:"PHX",conf:"West",color:"#E56020",arena:"Footprint Center",coach:"Mike Budenholzer",w:36,l:46,off:114.8,def:117.7,pace:98.4,seed:11},
    sas:{city:"San Antonio",name:"Spurs",abbr:"SAS",conf:"West",color:"#8A8D8F",arena:"Frost Bank Center",coach:"Mitch Johnson",w:34,l:48,off:112.1,def:115.6,pace:100.6,seed:13},
    cle:{city:"Cleveland",name:"Cavaliers",abbr:"CLE",conf:"East",color:"#860038",arena:"Rocket Arena",coach:"Kenny Atkinson",w:64,l:18,off:121.0,def:111.8,pace:98.1,seed:1},
    bos:{city:"Boston",name:"Celtics",abbr:"BOS",conf:"East",color:"#007A33",arena:"TD Garden",coach:"Joe Mazzulla",w:61,l:21,off:119.5,def:110.9,pace:97.2,seed:2},
    nyk:{city:"New York",name:"Knicks",abbr:"NYK",conf:"East",color:"#F58426",arena:"Madison Square Garden",coach:"Tom Thibodeau",w:51,l:31,off:117.3,def:112.0,pace:96.1,seed:3},
    ind:{city:"Indiana",name:"Pacers",abbr:"IND",conf:"East",color:"#FDBB30",arena:"Gainbridge Fieldhouse",coach:"Rick Carlisle",w:50,l:32,off:117.4,def:113.3,pace:102.9,seed:4},
    mil:{city:"Milwaukee",name:"Bucks",abbr:"MIL",conf:"East",color:"#00471B",arena:"Fiserv Forum",coach:"Doc Rivers",w:48,l:34,off:115.1,def:112.0,pace:99.4,seed:5},
    det:{city:"Detroit",name:"Pistons",abbr:"DET",conf:"East",color:"#C8102E",arena:"Little Caesars Arena",coach:"J.B. Bickerstaff",w:44,l:38,off:114.2,def:112.6,pace:99.9,seed:6},
    orl:{city:"Orlando",name:"Magic",abbr:"ORL",conf:"East",color:"#0077C0",arena:"Kia Center",coach:"Jamahl Mosley",w:41,l:41,off:108.9,def:109.1,pace:97.8,seed:7},
    atl:{city:"Atlanta",name:"Hawks",abbr:"ATL",conf:"East",color:"#E03A3E",arena:"State Farm Arena",coach:"Quin Snyder",w:40,l:42,off:114.0,def:114.4,pace:103.1,seed:8},
    chi:{city:"Chicago",name:"Bulls",abbr:"CHI",conf:"East",color:"#CE1141",arena:"United Center",coach:"Billy Donovan",w:39,l:43,off:114.2,def:115.3,pace:103.4,seed:9},
    mia:{city:"Miami",name:"Heat",abbr:"MIA",conf:"East",color:"#98002E",arena:"Kaseya Center",coach:"Erik Spoelstra",w:37,l:45,off:111.7,def:111.6,pace:97.0,seed:10},
    phi:{city:"Philadelphia",name:"76ers",abbr:"PHI",conf:"East",color:"#006BB6",arena:"Wells Fargo Center",coach:"Nick Nurse",w:24,l:58,off:110.9,def:114.9,pace:99.0,seed:13},
    tor:{city:"Toronto",name:"Raptors",abbr:"TOR",conf:"East",color:"#CE1141",arena:"Scotiabank Arena",coach:"Darko Rajaković",w:30,l:52,off:111.5,def:114.2,pace:99.3,seed:11},
    bkn:{city:"Brooklyn",name:"Nets",abbr:"BKN",conf:"East",color:"#6E6E6E",arena:"Barclays Center",coach:"Jordi Fernández",w:26,l:56,off:109.3,def:114.9,pace:99.6,seed:12},
    cha:{city:"Charlotte",name:"Hornets",abbr:"CHA",conf:"East",color:"#00788C",arena:"Spectrum Center",coach:"Charles Lee",w:19,l:63,off:106.5,def:114.7,pace:99.4,seed:14},
    was:{city:"Washington",name:"Wizards",abbr:"WAS",conf:"East",color:"#E31837",arena:"Capital One Arena",coach:"Brian Keefe",w:18,l:64,off:108.5,def:118.2,pace:101.5,seed:15},
    por:{city:"Portland",name:"Trail Blazers",abbr:"POR",conf:"West",color:"#E03A3E",arena:"Moda Center",coach:"Chauncey Billups",w:36,l:46,off:111.4,def:113.6,pace:100.4,seed:12},
    nop:{city:"New Orleans",name:"Pelicans",abbr:"NOP",conf:"West",color:"#C8102E",arena:"Smoothie King Center",coach:"Willie Green",w:21,l:61,off:110.5,def:116.4,pace:99.6,seed:14},
    uta:{city:"Utah",name:"Jazz",abbr:"UTA",conf:"West",color:"#F9A01B",arena:"Delta Center",coach:"Will Hardy",w:17,l:65,off:110.9,def:118.7,pace:99.8,seed:15},
  };
  Object.keys(teams).forEach(k=>{teams[k].id=k;teams[k].full=teams[k].city+" "+teams[k].name;});

  /* ---------- helper to build a player ---------- */
  // log rows: [season, teamId, gp, mp, fg%, 3p%, ft%, trb, ast, stl, blk, pts]
  function P(o){ o.cur = o.log[o.log.length-1]; return o; }

  const players = {

    sga: P({id:"sga", n:"Shai Gilgeous-Alexander", t:"okc", pos:"Guard", num:2, ht:"6-6", wt:195,
      born:1998, from:"Canada", draft:"2018 · Rd 1, Pick 11", exp:7,
      acc:["2025 Kia MVP","2025 Finals MVP","2025 Scoring champion","4× All-Star","All-NBA First Team","NBA Champion"],
      blurb:"The engine of a 68-win champion. Led the league in scoring while anchoring the NBA's best defense — the first guard to win MVP, Finals MVP and the scoring title in one season since the 1970s.",
      career:{pts:22.1,reb:4.9,ast:5.3,ts:.611,per:24.9},
      log:[
        ["2022-23","okc",68,35.5,.510,.345,.905,4.8,5.5,1.6,1.0,31.4],
        ["2023-24","okc",75,34.0,.535,.353,.874,5.5,6.2,2.0,0.9,30.1],
        ["2024-25","okc",76,34.2,.519,.375,.898,5.0,6.4,1.7,1.0,32.7],
      ]}),

    jokic: P({id:"jokic", n:"Nikola Jokić", t:"den", pos:"Center", num:15, ht:"6-11", wt:284,
      born:1995, from:"Serbia", draft:"2014 · Rd 2, Pick 41", exp:10,
      acc:["3× Kia MVP","2023 Finals MVP","2023 NBA Champion","7× All-Star","5× All-NBA First Team"],
      blurb:"Averaged a triple-double for the season — the third player ever to do so — on the most efficient high-volume shooting line in the league. The best passing big man the game has seen.",
      career:{pts:21.3,reb:10.9,ast:7.0,ts:.629,per:28.9},
      log:[
        ["2022-23","den",69,33.7,.632,.383,.822,11.8,9.8,1.3,0.7,24.5],
        ["2023-24","den",79,34.6,.583,.359,.817,12.4,9.0,1.4,0.9,26.4],
        ["2024-25","den",70,36.7,.576,.417,.800,12.7,10.2,1.8,0.6,29.6],
      ]}),

    giannis: P({id:"giannis", n:"Giannis Antetokounmpo", t:"mil", pos:"Forward", num:34, ht:"6-11", wt:243,
      born:1994, from:"Greece", draft:"2013 · Rd 1, Pick 15", exp:12,
      acc:["2× Kia MVP","2021 Finals MVP","2021 NBA Champion","2020 Defensive POY","9× All-Star"],
      blurb:"A force at the rim who shouldered a heavy scoring and rebounding load again. Among the most efficient interior scorers in the league at 60% from the field.",
      career:{pts:23.4,reb:9.9,ast:5.0,ts:.610,per:27.6},
      log:[
        ["2022-23","mil",63,32.1,.553,.275,.645,11.8,5.7,0.8,0.8,31.1],
        ["2023-24","mil",73,35.2,.611,.274,.657,11.5,6.5,1.2,1.1,30.4],
        ["2024-25","mil",67,34.2,.601,.222,.617,11.9,6.5,0.9,1.2,30.4],
      ]}),

    luka: P({id:"luka", n:"Luka Dončić", t:"lal", pos:"Guard", num:77, ht:"6-7", wt:230,
      born:1999, from:"Slovenia", draft:"2018 · Rd 1, Pick 3", exp:7,
      acc:["2024 Scoring champion","5× All-Star","5× All-NBA First Team","2024 NBA Finalist"],
      blurb:"Traded from Dallas to the Lakers at the February deadline in one of the most stunning deals in league history. A walking triple-double threat and elite shot-creator.",
      career:{pts:28.1,reb:8.6,ast:8.3,ts:.583,per:27.1},
      log:[
        ["2022-23","dal",66,36.2,.496,.342,.742,8.6,8.0,1.4,0.5,32.4],
        ["2023-24","dal",70,37.5,.487,.382,.786,9.2,9.8,1.4,0.5,33.9],
        ["2024-25","lal",50,35.9,.450,.366,.786,8.2,7.7,1.6,0.5,28.2],
      ]}),

    edwards: P({id:"edwards", n:"Anthony Edwards", t:"min", pos:"Guard", num:5, ht:"6-4", wt:225,
      born:2001, from:"Georgia", draft:"2020 · Rd 1, Pick 1", exp:5,
      acc:["3× All-Star","All-NBA Second Team","2025 Three-point makes leader"],
      blurb:"Took the leap into perennial-MVP-candidate territory, leading the league in made threes while carrying Minnesota back to the conference finals.",
      career:{pts:24.5,reb:5.4,ast:4.4,ts:.567,per:19.4},
      log:[
        ["2022-23","min",79,36.0,.459,.369,.756,5.8,4.4,1.6,0.7,24.6],
        ["2023-24","min",79,35.1,.461,.357,.836,5.4,5.1,1.3,0.5,25.9],
        ["2024-25","min",79,36.3,.447,.396,.837,5.7,4.5,1.2,0.6,27.6],
      ]}),

    tatum: P({id:"tatum", n:"Jayson Tatum", t:"bos", pos:"Forward", num:0, ht:"6-8", wt:210,
      born:1998, from:"Duke", draft:"2017 · Rd 1, Pick 3", exp:8,
      acc:["2024 NBA Champion","6× All-Star","4× All-NBA First Team"],
      blurb:"The two-way centerpiece of the defending champions. A prolific three-level scorer whose 2025 postseason was cut short by an Achilles injury.",
      career:{pts:23.7,reb:7.6,ast:4.2,ts:.583,per:21.5},
      log:[
        ["2022-23","bos",74,36.9,.466,.350,.854,8.8,4.6,1.1,0.7,30.1],
        ["2023-24","bos",74,35.7,.471,.376,.833,8.1,4.9,1.0,0.6,26.9],
        ["2024-25","bos",72,36.4,.451,.343,.812,8.7,6.0,1.1,0.6,26.8],
      ]}),

    wemby: P({id:"wemby", n:"Victor Wembanyama", t:"sas", pos:"Center", num:1, ht:"7-4", wt:235,
      born:2004, from:"France", draft:"2023 · Rd 1, Pick 1", exp:2,
      acc:["2024 Rookie of the Year","2025 All-Star","2025 All-Defensive First Team","Block leader"],
      blurb:"A generational two-way unicorn — rim protection, shot-blocking and perimeter shooting in a 7-4 frame. His season ended in February after a blood-clot diagnosis.",
      career:{pts:23.0,reb:11.2,ast:3.8,ts:.579,per:25.8},
      log:[
        ["2023-24","sas",71,29.7,.465,.325,.797,10.6,3.9,1.2,3.6,21.4],
        ["2024-25","sas",46,33.2,.476,.354,.837,11.0,3.7,1.1,3.8,24.3],
      ]}),

    curry: P({id:"curry", n:"Stephen Curry", t:"gsw", pos:"Guard", num:30, ht:"6-2", wt:185,
      born:1988, from:"Davidson", draft:"2009 · Rd 1, Pick 7", exp:16,
      acc:["4× NBA Champion","2× Kia MVP","2022 Finals MVP","11× All-Star","All-time 3PM leader"],
      blurb:"Still the gravity that bends defenses. The greatest shooter in NBA history remained an elite lead guard into his late thirties.",
      career:{pts:24.7,reb:4.7,ast:6.4,ts:.625,per:23.4},
      log:[
        ["2022-23","gsw",56,34.7,.493,.427,.915,6.1,6.3,0.9,0.4,29.4],
        ["2023-24","gsw",74,32.7,.450,.408,.923,4.5,5.1,0.7,0.4,26.4],
        ["2024-25","gsw",70,32.2,.448,.397,.933,4.4,6.0,1.1,0.4,24.5],
      ]}),

    lebron: P({id:"lebron", n:"LeBron James", t:"lal", pos:"Forward", num:23, ht:"6-9", wt:250,
      born:1984, from:"St. Vincent-St. Mary HS", draft:"2003 · Rd 1, Pick 1", exp:22,
      acc:["4× NBA Champion","4× Kia MVP","4× Finals MVP","21× All-Star","All-time scoring leader"],
      blurb:"In his 22nd season and age-40 campaign, still an All-NBA-level playmaker and scorer — the most durable superstar the sport has produced.",
      career:{pts:27.0,reb:7.5,ast:7.4,ts:.588,per:27.3},
      log:[
        ["2022-23","lal",55,35.5,.500,.321,.768,8.3,6.8,0.9,0.6,28.9],
        ["2023-24","lal",71,35.3,.540,.410,.750,7.3,8.3,1.3,0.5,25.7],
        ["2024-25","lal",70,34.9,.513,.376,.782,7.8,8.2,1.0,0.6,24.4],
      ]}),

    durant: P({id:"durant", n:"Kevin Durant", t:"phx", pos:"Forward", num:35, ht:"6-11", wt:240,
      born:1988, from:"Texas", draft:"2007 · Rd 1, Pick 2", exp:17,
      acc:["2× NBA Champion","2014 Kia MVP","2× Finals MVP","4× Scoring champion","15× All-Star"],
      blurb:"One of the purest scorers ever, still automatic from all three levels at elite efficiency in his late thirties.",
      career:{pts:27.2,reb:7.0,ast:4.4,ts:.633,per:25.0},
      log:[
        ["2022-23","phx",47,35.6,.560,.404,.919,6.7,5.0,0.7,1.4,29.1],
        ["2023-24","phx",75,37.2,.523,.413,.856,6.6,5.0,0.9,1.2,27.1],
        ["2024-25","phx",62,36.8,.527,.430,.839,6.0,4.2,0.8,1.2,26.6],
      ]}),

    brunson: P({id:"brunson", n:"Jalen Brunson", t:"nyk", pos:"Guard", num:11, ht:"6-2", wt:190,
      born:1996, from:"Villanova", draft:"2018 · Rd 2, Pick 33", exp:7,
      acc:["2025 Clutch Player of the Year","2× All-Star","All-NBA Second Team"],
      blurb:"The heartbeat of a 51-win Knicks team and the league's premier crunch-time shot-maker. Turned a second-round pedigree into perennial All-NBA production.",
      career:{pts:20.1,reb:3.6,ast:5.4,ts:.579,per:20.6},
      log:[
        ["2022-23","nyk",68,35.0,.491,.416,.826,3.5,6.2,0.9,0.2,24.0],
        ["2023-24","nyk",77,35.4,.479,.401,.847,3.6,6.7,0.9,0.2,28.7],
        ["2024-25","nyk",65,35.0,.488,.384,.821,2.9,7.3,0.9,0.1,26.0],
      ]}),

    mitchell: P({id:"mitchell", n:"Donovan Mitchell", t:"cle", pos:"Guard", num:45, ht:"6-3", wt:215,
      born:1996, from:"Louisville", draft:"2017 · Rd 1, Pick 13", exp:8,
      acc:["6× All-Star","All-NBA Second Team"],
      blurb:"The go-to scorer for the East's 64-win top seed, pairing shot-creation with a career-best defensive commitment.",
      career:{pts:24.4,reb:4.4,ast:4.6,ts:.573,per:21.7},
      log:[
        ["2022-23","cle",68,35.8,.484,.386,.867,4.3,4.4,1.5,0.4,28.3],
        ["2023-24","cle",55,35.3,.462,.366,.865,5.1,6.1,1.8,0.5,26.6],
        ["2024-25","cle",71,31.4,.443,.365,.833,4.5,5.0,1.3,0.5,24.0],
      ]}),

    ad: P({id:"ad", n:"Anthony Davis", t:"dal", pos:"Forward", num:3, ht:"6-10", wt:253,
      born:1993, from:"Kentucky", draft:"2012 · Rd 1, Pick 1", exp:13,
      acc:["2020 NBA Champion","10× All-Star","4× All-NBA First Team","5× All-Defensive"],
      blurb:"The headline return in the Dončić blockbuster. An elite two-way big — interior scoring, rim protection and switchable defense — when healthy.",
      career:{pts:24.2,reb:10.5,ast:2.6,ts:.586,per:27.0},
      log:[
        ["2022-23","lal",56,34.0,.563,.257,.784,12.5,2.6,1.1,2.0,25.9],
        ["2023-24","lal",76,35.5,.556,.271,.816,12.6,3.5,1.2,2.3,24.7],
        ["2024-25","dal",51,33.6,.516,.284,.782,11.6,3.5,1.3,2.2,24.7],
      ]}),

    cade: P({id:"cade", n:"Cade Cunningham", t:"det", pos:"Guard", num:2, ht:"6-6", wt:220,
      born:2001, from:"Oklahoma State", draft:"2021 · Rd 1, Pick 1", exp:4,
      acc:["2025 All-Star","All-NBA Third Team","2025 Most Improved candidate"],
      blurb:"Turned Detroit from lottery mainstay into a playoff team, running one of the league's highest-usage offenses as a jumbo lead guard.",
      career:{pts:21.4,reb:5.9,ast:7.0,ts:.554,per:19.3},
      log:[
        ["2022-23","det",12,33.0,.443,.316,.845,6.2,7.5,1.1,0.6,19.9],
        ["2023-24","det",62,33.5,.449,.355,.869,4.3,7.5,0.9,0.6,22.7],
        ["2024-25","det",70,35.0,.469,.360,.846,6.1,9.1,1.0,0.8,26.1],
      ]}),

    hali: P({id:"hali", n:"Tyrese Haliburton", t:"ind", pos:"Guard", num:0, ht:"6-5", wt:185,
      born:2000, from:"Iowa State", draft:"2020 · Rd 1, Pick 12", exp:5,
      acc:["2× All-Star","All-NBA Third Team","2025 NBA Finalist","Assist leader (2024)"],
      blurb:"The pace-and-space maestro who orchestrated Indiana's run to the NBA Finals with elite passing and clutch shot-making. Tore his Achilles in Game 7.",
      career:{pts:17.6,reb:3.9,ast:9.2,ts:.605,per:19.6},
      log:[
        ["2022-23","ind",56,33.6,.490,.400,.871,3.7,10.4,1.6,0.4,20.7],
        ["2023-24","ind",69,32.4,.477,.361,.855,3.9,10.9,1.2,0.7,20.1],
        ["2024-25","ind",73,33.6,.473,.388,.851,3.5,9.2,1.4,0.7,18.6],
      ]}),

    kat: P({id:"kat", n:"Karl-Anthony Towns", t:"nyk", pos:"Center", num:32, ht:"6-11", wt:248,
      born:1995, from:"Kentucky", draft:"2015 · Rd 1, Pick 1", exp:10,
      acc:["4× All-Star","3× All-NBA","2024 Three-Point Contest champion"],
      blurb:"Traded to New York in the offseason and thrived as a floor-spacing five, posting one of the best shooting-big seasons in the league.",
      career:{pts:22.5,reb:11.3,ast:3.2,ts:.611,per:23.6},
      log:[
        ["2022-23","min",29,33.0,.495,.369,.871,8.8,4.8,0.7,0.6,20.8],
        ["2023-24","min",62,32.8,.504,.417,.874,8.3,3.0,0.7,0.7,21.8],
        ["2024-25","nyk",72,35.0,.526,.420,.829,12.8,3.1,0.9,0.7,24.4],
      ]}),

    jdub: P({id:"jdub", n:"Jalen Williams", t:"okc", pos:"Forward", num:8, ht:"6-6", wt:211,
      born:2001, from:"Santa Clara", draft:"2022 · Rd 1, Pick 12", exp:3,
      acc:["2025 All-Star","All-NBA Third Team","2025 All-Defensive","NBA Champion"],
      blurb:"The versatile co-star on the championship Thunder — a two-way wing who defends multiple positions and creates his own offense.",
      career:{pts:18.3,reb:4.7,ast:4.6,ts:.585,per:18.2},
      log:[
        ["2022-23","okc",75,30.3,.521,.356,.812,4.5,3.3,1.4,0.5,14.1],
        ["2023-24","okc",71,31.5,.540,.427,.814,4.0,4.5,1.1,0.6,19.1],
        ["2024-25","okc",71,32.6,.484,.365,.870,5.3,5.1,1.6,0.7,21.6],
      ]}),

    chet: P({id:"chet", n:"Chet Holmgren", t:"okc", pos:"Center", num:7, ht:"7-1", wt:208,
      born:2002, from:"Gonzaga", draft:"2022 · Rd 1, Pick 2", exp:2,
      acc:["2024 All-Rookie First Team","NBA Champion","All-Defensive candidate"],
      blurb:"A rim-protecting, floor-stretching big whose defense swung the Thunder's title run. Missed time with a hip injury during the regular season.",
      career:{pts:16.0,reb:7.9,ast:2.5,ts:.610,per:19.7},
      log:[
        ["2023-24","okc",82,29.4,.530,.370,.792,7.9,2.4,0.6,2.3,16.5],
        ["2024-25","okc",32,27.5,.490,.379,.813,8.0,1.8,0.6,2.2,15.0],
      ]}),

    sabonis: P({id:"sabonis", n:"Domantas Sabonis", t:"sac", pos:"Forward", num:10, ht:"6-11", wt:240,
      born:1996, from:"Gonzaga", draft:"2016 · Rd 1, Pick 11", exp:9,
      acc:["2025 Rebounding champion","3× All-Star","All-NBA Second Team"],
      blurb:"Led the league in rebounding for a third straight season while running Sacramento's offense from the elbow — a nightly double-double machine and elite connective passer.",
      career:{pts:15.0,reb:9.4,ast:4.4,ts:.617,per:21.6},
      log:[
        ["2022-23","sac",79,34.6,.615,.373,.742,12.3,7.3,0.8,0.5,19.1],
        ["2023-24","sac",82,35.7,.594,.379,.715,13.7,8.2,0.9,0.6,19.4],
        ["2024-25","sac",70,34.7,.590,.418,.754,13.9,6.0,0.7,0.5,19.1],
      ]}),

    trae: P({id:"trae", n:"Trae Young", t:"atl", pos:"Guard", num:11, ht:"6-1", wt:164,
      born:1998, from:"Oklahoma", draft:"2018 · Rd 1, Pick 5", exp:7,
      acc:["2025 Assists leader","3× All-Star","All-NBA Third Team"],
      blurb:"The engine of Atlanta's offense and the league's assist leader — a deep-range shot-maker and pick-and-roll savant who bends defenses well beyond the arc.",
      career:{pts:25.5,reb:3.9,ast:9.6,ts:.560,per:21.8},
      log:[
        ["2022-23","atl",73,34.8,.429,.335,.886,3.0,10.2,1.1,0.1,26.2],
        ["2023-24","atl",54,36.0,.430,.371,.858,2.8,10.8,1.3,0.2,25.7],
        ["2024-25","atl",76,36.0,.417,.340,.869,3.1,11.6,1.2,0.1,24.2],
      ]}),

    daniels: P({id:"daniels", n:"Dyson Daniels", t:"atl", pos:"Guard", num:5, ht:"6-8", wt:200,
      born:2003, from:"Australia", draft:"2022 · Rd 1, Pick 8", exp:3,
      acc:["2025 Most Improved Player","2025 Steals leader","All-Defensive First Team"],
      blurb:"“The Great Barrier Thief.” Averaged three steals a game — the first player to do so in three decades — in a breakout season that made him the league's most disruptive perimeter defender.",
      career:{pts:9.0,reb:4.6,ast:3.4,ts:.531,per:14.2},
      log:[
        ["2023-24","nop",79,24.3,.451,.312,.700,3.9,2.7,1.4,0.5,5.8],
        ["2024-25","atl",76,33.6,.492,.340,.756,5.9,4.4,3.0,0.5,14.1],
      ]}),

    harden: P({id:"harden", n:"James Harden", t:"lac", pos:"Guard", num:1, ht:"6-5", wt:220,
      born:1989, from:"Arizona State", draft:"2009 · Rd 1, Pick 3", exp:16,
      acc:["2018 Kia MVP","3× Scoring champion","11× All-Star","All-NBA (7×)"],
      blurb:"Reinvented as a table-setting lead guard for a 50-win Clippers team — still one of the craftiest scorers and passers alive deep into his thirties.",
      career:{pts:23.8,reb:5.5,ast:7.1,ts:.604,per:23.9},
      log:[
        ["2022-23","phi",58,36.8,.441,.385,.867,6.1,10.7,1.2,0.4,21.0],
        ["2023-24","lac",72,34.3,.428,.381,.877,5.1,8.5,1.1,0.8,16.6],
        ["2024-25","lac",79,35.3,.410,.352,.874,5.8,8.7,1.5,0.7,22.8],
      ]}),

    zubac: P({id:"zubac", n:"Ivica Zubac", t:"lac", pos:"Center", num:40, ht:"7-0", wt:240,
      born:1997, from:"Croatia", draft:"2016 · Rd 2, Pick 32", exp:9,
      acc:["2025 All-NBA Third Team","Career-best season"],
      blurb:"Quietly one of the season's biggest risers — a rim-running, glass-cleaning anchor who set career highs across the board as the Clippers' defensive backbone.",
      career:{pts:11.3,reb:8.4,ast:1.5,ts:.655,per:20.6},
      log:[
        ["2022-23","lac",76,28.5,.633,null,.734,9.9,1.0,0.4,1.3,10.8],
        ["2023-24","lac",68,26.7,.629,null,.789,9.2,1.4,0.3,0.9,11.7],
        ["2024-25","lac",80,32.8,.626,null,.657,12.6,2.7,0.7,1.1,16.8],
      ]}),

  };

  Object.values(players).forEach(p=>{ p.team = teams[p.t]; });

  /* ---------- STANDINGS (final, top 8 each) ---------- */
  const standings = {
    West:["okc","hou","lal","den","lac","min","gsw","mem","sac","dal"],
    East:["cle","bos","nyk","ind","mil","det","orl","atl","chi","mia"],
  };

  /* ---------- LEADERS ---------- */
  const leaders = {
    pts:{label:"Points per game", abbr:"PPG", rows:[
      ["sga",32.7],["giannis",30.4],["jokic",29.6],["luka",28.2],
      ["edwards",27.6],["tatum",26.8],["durant",26.6],["cade",26.1],
      ["brunson",26.0],["ad",24.7]]},
    reb:{label:"Rebounds per game", abbr:"RPG", rows:[
      ["sabonis",13.9],["kat",12.8],["jokic",12.7],["zubac",12.6],
      ["giannis",11.9],["ad",11.6],["wemby",11.0],["tatum",8.7]]},
    ast:{label:"Assists per game", abbr:"APG", rows:[
      ["trae",11.6],["jokic",10.2],["hali",9.2],["cade",9.1],
      ["harden",8.7],["lebron",8.2],["luka",7.7],["brunson",7.3]]},
    stl:{label:"Steals per game", abbr:"SPG", rows:[
      ["daniels",3.0],["sga",1.7],["jdub",1.6],["luka",1.6],
      ["harden",1.5],["hali",1.4],["mitchell",1.3],["edwards",1.2]]},
    blk:{label:"Blocks per game", abbr:"BPG", rows:[
      ["wemby",3.8],["ad",2.2],["chet",2.2],["giannis",1.2],
      ["durant",1.2],["zubac",1.1],["jdub",0.7],["hali",0.7]]},
    ts:{label:"True shooting %", abbr:"TS%", pct:true, rows:[
      ["jokic",.665],["zubac",.655],["sga",.637],["durant",.635],
      ["curry",.625],["kat",.618],["harden",.604],["giannis",.601]]},
  };

  /* ---------- season index (championship history, recent) ---------- */
  const champions = [
    ["2024-25","okc","Oklahoma City def. Indiana 4–3","sga"],
    ["2023-24","bos","Boston def. Dallas 4–1","tatum"],
    ["2022-23","den","Denver def. Miami 4–1","jokic"],
    ["2021-22","gsw","Golden State def. Boston 4–2","curry"],
    ["2020-21","mil","Milwaukee def. Phoenix 4–2","giannis"],
  ];

  /* ---------- search index ---------- */
  const searchIndex = [
    ...Object.values(players).map(p=>({type:"player",id:p.id,name:p.n,sub:p.pos+" · "+p.team.abbr,color:p.team.color})),
    ...Object.values(teams).map(t=>({type:"team",id:t.id,name:t.full,sub:t.conf+" · "+t.w+"-"+t.l,color:t.color})),
  ];

  return {teams, players, standings, leaders, champions, searchIndex,
    season:"2024-25",
    columns:["Season","Team","GP","MPG","FG%","3P%","FT%","REB","AST","STL","BLK","PTS"]};
})();
