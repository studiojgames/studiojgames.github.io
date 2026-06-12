'use strict';

// ===== Audio (合成音・ファイルを重くしない) =====
const SFX = {
  ctx: null, on: true, bgmNodes: null, bgmTimer: null,
  seVol: 0.8, bgmVol: 0.6,   // 効果音 / BGM の音量係数(0〜1) 設定画面から変更
  init(){
    if(!this.ctx){ try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(this.ctx && this.ctx.state==='suspended') this.ctx.resume();
    // iPhoneのマナーモード回避: 無音を1回再生してWeb Audioをアンロック
    if(this.ctx && !this._unlocked){
      try{
        const b=this.ctx.createBuffer(1,1,22050), s=this.ctx.createBufferSource();
        s.buffer=b; s.connect(this.ctx.destination); s.start(0);
        this._unlocked=true;
      }catch(e){}
    }
  },
  tone(freq, dur, type, vol, slideTo){
    if(!this.on || !this.ctx) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(freq,t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t+dur);
    g.gain.setValueAtTime(Math.max(0.0001,(vol||0.2)*this.seVol), t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur);
  },
  noise(dur, vol){
    if(!this.on || !this.ctx) return;
    const t=this.ctx.currentTime, n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
    const s=this.ctx.createBufferSource(); s.buffer=buf;
    const g=this.ctx.createGain(); g.gain.value=(vol||0.3)*this.seVol;
    s.connect(g); g.connect(this.ctx.destination); s.start();
  },
  punch(){ this.noise(0.08,0.4); this.tone(90,0.14,'sine',0.5,45); this.tone(140,0.08,'square',0.2,60); },
  kick(){ this.noise(0.12,0.45); this.tone(70,0.22,'sine',0.6,35); this.tone(110,0.12,'sawtooth',0.3,40); },
  jump(){ this.tone(300,0.18,'square',0.22,620); },
  special(){ this.tone(180,0.3,'sawtooth',0.4,900); this.tone(90,0.3,'sine',0.5,400); this.noise(0.2,0.25); },
  specialFire(){ this.noise(0.25,0.5); this.tone(420,0.25,'sawtooth',0.45,60); this.tone(60,0.35,'sine',0.6,30); },
  ko(){ this.tone(200,0.5,'sawtooth',0.3,60); this.noise(0.4,0.35); },
  block(){ this.tone(800,0.06,'square',0.12); this.tone(600,0.06,'square',0.10); },
  thunder(){
    // 雷鳴: 低くゴロゴロ鳴る長めのノイズ + 重低音のうねり
    if(!this.on || !this.ctx) return;
    const t=this.ctx.currentTime, dur=1.6;
    const n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++){ const env=Math.pow(1-i/n,1.5); d[i]=(Math.random()*2-1)*env; }
    const s=this.ctx.createBufferSource(); s.buffer=buf;
    const lp=this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(900,t); lp.frequency.exponentialRampToValueAtTime(90,t+dur);
    const g=this.ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.95*this.seVol,t+0.04); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    s.connect(lp); lp.connect(g); g.connect(this.ctx.destination); s.start(t);
    // 鋭い初撃(ピシャッ)を上に重ねてBGMから抜けるように
    this.noise(0.12,0.6);
    // 重低音のうねり
    this.tone(55,1.2,'sine',0.6,38);
  },
  startFlash(){
    // PRESS START 押下音: 鋭い上昇＋低音の一撃
    this.tone(220,0.18,'sawtooth',0.25,880);
    this.tone(70,0.3,'sine',0.5,40);
    this.noise(0.18,0.3);
  },
  kickDrum(){
    if(!this.on || !this.ctx) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(45,t+0.12);
    g.gain.setValueAtTime(0.5*this.bgmVol,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+0.18);
  },
  hat(){
    if(!this.on || !this.ctx) return;
    const t=this.ctx.currentTime, n=Math.floor(this.ctx.sampleRate*0.03);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
    const s=this.ctx.createBufferSource(); s.buffer=buf;
    const hp=this.ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=7000;
    const g=this.ctx.createGain(); g.gain.value=0.12*this.bgmVol;
    s.connect(hp); hp.connect(g); g.connect(this.ctx.destination); s.start();
  },
  startBGM(){
    if(!this.on || !this.ctx || this.bgmTimer) return;
    // Stranger Things テーマ: Cmaj7アルペジオ(C-E-G-B-C)を山型に繰り返す。
    // ベースがEに動くとB-E-G-B-Cに変化(Cmaj7/E)。左手はC(オクターブ)。
    const N={B4:493.88,C5:523.25,E5:659.25,G5:783.99,B5:987.77,C6:1046.50};
    // メイン: C-E-G-B-C を上って下りる(16分 ×16でちょうど2回の山)
    const arpC=[N.C5,N.E5,N.G5,N.B5, N.C6,N.B5,N.G5,N.E5,
                N.C5,N.E5,N.G5,N.B5, N.C6,N.B5,N.G5,N.E5];
    // ベースがEのとき: B-E-G-B-C(最低音がBになる)
    const arpE=[N.B4,N.E5,N.G5,N.B5, N.C6,N.B5,N.G5,N.E5,
                N.B4,N.E5,N.G5,N.B5, N.C6,N.B5,N.G5,N.E5];
    // 左手ベース(小節ごと): C → C → E → C のループ(Eのとき上モノがarpEに)
    const bassSeq=[65.41,65.41,82.41,65.41]; // C2,C2,E2,C2
    let step=0;
    const tick=()=>{
      if(!this.on){ return; }
      const s=step%16;
      const bar=Math.floor(step/16)%bassSeq.length;
      const onE=(bassSeq[bar]>80); // Eベースの小節か
      const f=(onE?arpE:arpC)[s];
      if(f) this.tone(f,0.14,'sine',0.10);          // 右手アルペジオ
      if(s===0){ this.tone(bassSeq[bar],1.5,'triangle',0.16); } // 左手ベース(長め)
      if(s%4===0) this.kickDrum();                   // 心臓のような拍頭キック
      step++;
    };
    // 少しゆっくりめ: 16分=105ms(♩≒143相当)
    this.bgmTimer=setInterval(tick, 105);
  },
  stopBGM(){ if(this.bgmTimer){ clearInterval(this.bgmTimer); this.bgmTimer=null; } },
  // ===== タイトル用BGM (MP3ファイル) =====
  titleEl: null,
  _getTitle(){ if(!this.titleEl) this.titleEl=document.getElementById('titleBgm'); return this.titleEl; },
  startTitleBGM(){
    if(!this.on) return;
    const a=this._getTitle(); if(!a) return;
    a.volume=Math.max(0,Math.min(1,0.9*this.bgmVol));
    const p=a.play();
    if(p && p.catch) p.catch(()=>{}); // 自動再生ブロック時は次のタップで再試行
  },
  stopTitleBGM(){ const a=this._getTitle(); if(a){ a.pause(); a.currentTime=0; } },
  // ===== ロビー(キャラ選択)用BGM (MP3ファイル・2曲からランダム) =====
  lobbyEl: null,
  lobbyTracks: ['assets/bgm/lobby.mp3','assets/bgm/lobby2.mp3'],
  _getLobby(){ if(!this.lobbyEl) this.lobbyEl=document.getElementById('lobbyBgm'); return this.lobbyEl; },
  startLobbyBGM(){
    if(!this.on) return;
    const a=this._getLobby(); if(!a) return;
    // 停止中(=ロビーに入り直した)なら毎回ランダムに選曲
    if(a.paused){
      const pick=this.lobbyTracks[Math.floor(Math.random()*this.lobbyTracks.length)];
      const cur=(a.getAttribute('src')||'').split('?')[0];
      if(cur!==pick){ a.setAttribute('src',pick); a.load(); }
    }
    a.volume=Math.max(0,Math.min(1,0.9*this.bgmVol));
    const p=a.play();
    if(p && p.catch) p.catch(()=>{});
  },
  stopLobbyBGM(){ const a=this._getLobby(); if(a){ a.pause(); a.currentTime=0; } },
  // ===== バトル用BGM (ステージ別MP3・対応ステージのみ) =====
  battleEl: null,
  battleTracks: { 'C': 'assets/bgm/battle_budokai.mp3' },
  _getBattle(){ if(!this.battleEl) this.battleEl=document.getElementById('battleBgm'); return this.battleEl; },
  startBattleBGM(place){
    const a=this._getBattle(); if(!a) return;
    const track=this.battleTracks[place];
    if(!track || !this.on){ this.stopBattleBGM(); return; }
    const cur=(a.getAttribute('src')||'').split('?')[0];
    if(cur!==track){ a.setAttribute('src',track); a.load(); }
    a.volume=Math.max(0,Math.min(1,0.7*this.bgmVol));
    if(a.paused){ const p=a.play(); if(p && p.catch) p.catch(()=>{}); }
  },
  stopBattleBGM(){ const a=this._getBattle(); if(a){ a.pause(); a.currentTime=0; } },
  // ===== 風の環境音 (合成・ループ) =====
  windNodes: null,
  startWind(){
    if(!this.on || !this.ctx || this.windNodes) return;
    const ctx=this.ctx, t=ctx.currentTime;
    // ループ用ノイズバッファ(2秒)
    const len=Math.floor(ctx.sampleRate*2);
    const buf=ctx.createBuffer(1,len,ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    const src=ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    // ローパスで「ヒュー」とした風に
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=520; lp.Q.value=0.7;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=120;
    // 全体音量
    const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.16*this.bgmVol,t+2.5);
    // 突風用のゆっくりした音量うねり(LFO)
    const lfo=ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=0.13;
    const lfoGain=ctx.createGain(); lfoGain.gain.value=0.09;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    // フィルタ周波数も揺らして「ゴー…ヒュー…」と変化させる
    const lfo2=ctx.createOscillator(); lfo2.type='sine'; lfo2.frequency.value=0.09;
    const lfo2Gain=ctx.createGain(); lfo2Gain.gain.value=240;
    lfo2.connect(lfo2Gain); lfo2Gain.connect(lp.frequency);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start(t); lfo.start(t); lfo2.start(t);
    this.windNodes={src,lfo,lfo2,g};
  },
  stopWind(){
    if(!this.windNodes) return;
    const {src,lfo,lfo2,g}=this.windNodes, t=this.ctx.currentTime;
    try{ g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(0.0001,t+0.6); }catch(e){}
    try{ src.stop(t+0.7); lfo.stop(t+0.7); lfo2.stop(t+0.7); }catch(e){}
    this.windNodes=null;
  },
  toggle(){
    this.on=!this.on;
    if(!this.on){ this.stopBGM(); this.stopTitleBGM(); this.stopLobbyBGM(); this.stopBattleBGM(); this.stopWind(); }
    return this.on;
  },
  setSeVol(v){ this.seVol=Math.max(0,Math.min(1,v)); },
  setBgmVol(v){
    this.bgmVol=Math.max(0,Math.min(1,v));
    // 再生中のMP3 BGMに即反映
    const a=this._getTitle(); if(a) a.volume=Math.max(0,Math.min(1,0.9*this.bgmVol));
    const lb=this._getLobby(); if(lb) lb.volume=Math.max(0,Math.min(1,0.9*this.bgmVol));
    const bt=this._getBattle(); if(bt) bt.volume=Math.max(0,Math.min(1,0.7*this.bgmVol));
    // 再生中の風にも反映
    if(this.windNodes && this.ctx){
      try{ this.windNodes.g.gain.setTargetAtTime(0.16*this.bgmVol, this.ctx.currentTime, 0.1); }catch(e){}
    }
  }
};

// ===== Constants =====
const W = 900, H = 460;
// バトル時のキャラ表示基準高（ワールド座標）。デカすぎ問題はここで調整
const FIGHTER_H = 235; // スト基準（画面高の約半分）
const ROSTER = [{"id": "nao", "name": "なお", "type": "パワー", "hpMul": 1.25, "dmgMul": 1.35, "walk": 0.82, "jump": 0.92, "win": ["重い一撃やったろ", "王者は揺るがん", "次いくで"], "lose": ["重すぎたか…", "くっ…", "まだや"], "img": "assets/characters/nao.webp", "loseImg": "assets/lose/nao.webp"}, {"id": "rice", "name": "ライス", "type": "スピード", "hpMul": 0.85, "dmgMul": 0.85, "walk": 1.35, "jump": 1.2, "win": ["速さが正義", "捉えられへんやろ", "ナイスゲーム"], "lose": ["詰めが甘かった", "あー惜しい", "次は獲る"], "img": "assets/characters/rice.webp", "loseImg": "assets/lose/rice.webp"}, {"id": "udobu", "name": "うっどぶ", "type": "手数", "hpMul": 0.95, "dmgMul": 0.9, "walk": 1.15, "jump": 1.05, "win": ["猫拳の連打や", "削りきったで", "にゃ〜"], "lose": ["手数足りんかった", "むむ…", "もういっちょ"], "img": "assets/characters/udobu.webp", "loseImg": "assets/lose/udobu.webp"}, {"id": "char", "name": "シャルロット", "type": "トリッキー", "hpMul": 0.92, "dmgMul": 1.05, "walk": 1.18, "jump": 1.1, "win": ["読み勝ちやな", "翻弄したった", "また遊んでや"], "lose": ["読まれたか", "ちっ", "次は化かす"], "img": "assets/characters/char.webp", "loseImg": "assets/lose/char.webp"}, {"id": "arya", "name": "あーりゃ", "type": "防御", "hpMul": 1.18, "dmgMul": 0.95, "walk": 0.95, "jump": 1.0, "win": ["鉄壁やろ？", "守って勝つ", "お疲れさま"], "lose": ["崩されたか…", "うぐ", "立て直す"], "img": "assets/characters/arya.webp", "loseImg": "assets/lose/arya.webp", "imgSkirt": "assets/characters/arya_skirt.webp", "loseImgSkirt": "assets/lose/arya_skirt.webp", "winImgSkirt": "assets/win/arya_skirt.webp"}, {"id": "J", "name": "J", "type": "バランス", "hpMul": 1.05, "dmgMul": 1.05, "walk": 1.05, "jump": 1.05, "win": ["スキはなかったやろ", "ReD同盟、勝利", "ええ試合や"], "lose": ["やられたわ", "ぐっ…", "リベンジや"], "img": "assets/characters/J.webp", "loseImg": "assets/lose/J.webp"}, {"id": "otome", "name": "おとめ", "type": "テクニック", "hpMul": 0.95, "dmgMul": 1.1, "walk": 1.12, "jump": 1.1, "win": ["いい眺めね、その姿勢", "顔を上げるのは許してないわ", "聞き分けのいい子は嫌いじゃなくてよ"], "lose": ["……負けてなど、いないわ", "……次は必ず、跪かせる", "……こんなはずじゃ、ないのよ"], "img": "assets/characters/otome.webp", "loseImg": "assets/lose/otome.webp", "winImg": "assets/win/otome.webp"}];

// 画像プリロード
const IMGS = {};
ROSTER.forEach(r=>{ const im=new Image(); im.src=r.img; IMGS[r.id]=im; });
// ステージ背景プリロード
const BG_DATA = {lion_night:'assets/stages/lion_night.webp', sky_day:'assets/stages/sky_day.webp', budokai:'assets/stages/budokai_bg3.webp'};
// 背景ごとの描画設定: horizon=地平線の縦位置 / ground=地平線より下の塗り色
const BG_CONF = {
  lion_night:{anchor:358, horizon:1.0, ground:'#0a1422'},
  sky_day:   {anchor:358, horizon:1.0, ground:'#9fb8cc'},
  budokai:   {venue:1, base:302, vh:320, pBase:1.0, ground:'#4a382a'},
};
const BG_IMGS = {};
Object.keys(BG_DATA).forEach(k=>{ const im=new Image(); im.src=BG_DATA[k]; BG_IMGS[k]=im; });
const PLATFORM_IMG = new Image(); PLATFORM_IMG.src = 'assets/stages/platform.webp';
const BUDOKAI_FLOOR_IMG = new Image(); BUDOKAI_FLOOR_IMG.src = 'assets/stages/budokai_floor.webp';
let CUR_BG = 'lion_night';
let STAGE_PLACE = 'A';  // 試合の場所(A=獅子の聖殿 / B=蒼穹の塔)
const POSE_DATA = {"J": {"idle": {"b64": "assets/poses/J_idle.webp", "w": 282, "h": 384, "bodyH": 383, "cropH": 384, "footX": 0.8186274509803921, "footY": 0.9981981981981982, "cropW": 282, "scaleAdj": 1.15, "fmt": "webp"}, "punch": {"b64": "assets/poses/J_punch.webp", "w": 345, "h": 384, "bodyH": 464, "cropH": 465, "footX": 0.7775590551181102, "footY": 0.9982300884955753, "cropW": 418, "scaleAdj": 1.15, "fmt": "webp"}, "guard": {"b64": "assets/poses/J_guard.webp", "w": 364, "h": 384, "bodyH": 433, "cropH": 434, "footX": 0.7552742616033755, "footY": 0.9979959919839679, "cropW": 412, "scaleAdj": 1.15, "fmt": "webp"}, "down": {"b64": "assets/poses/J_down.webp", "w": 384, "h": 248, "bodyH": 300, "cropH": 300, "footX": 0.5502958579881657, "footY": 0.9969604863221885, "cropW": 462, "scaleAdj": 1.15, "fmt": "webp"}, "kick": {"b64": "assets/poses/J_kick.webp", "w": 313, "h": 384, "bodyH": 616, "cropH": 616, "footX": 0.3610698365527489, "footY": 0.9987878787878788, "cropW": 503, "scaleAdj": 0.77, "fmt": "webp"}, "walk": {"b64": "assets/poses/J_walk.webp", "w": 176, "h": 384, "bodyH": 414, "cropW": 190, "cropH": 414, "footX": 0.7654639175257731, "footY": 0.9988179669030733, "scaleAdj": 0.754, "fmt": "webp"}}, "char": {"idle": {"b64": "assets/poses/char_idle.webp", "w": 295, "h": 384, "bodyH": 367, "cropW": 295, "cropH": 384, "footX": 0.847915, "footY": 0.9792, "scaleAdj": 0.9, "fmt": "webp"}, "walk": {"b64": "assets/poses/char_walk.webp", "w": 249, "h": 384, "bodyH": 375, "cropW": 249, "cropH": 384, "footX": 0.345081, "footY": 0.9896, "scaleAdj": 0.881, "fmt": "webp"}, "punch": {"b64": "assets/poses/char_punch.webp", "w": 384, "h": 234, "bodyH": 223, "cropW": 384, "cropH": 234, "footX": 0.644176, "footY": 0.9786, "scaleAdj": 1.35, "fmt": "webp"}, "kick": {"b64": "assets/poses/char_kick.webp", "w": 378, "h": 384, "bodyH": 364, "cropW": 378, "cropH": 384, "footX": 0.352838, "footY": 0.974, "scaleAdj": 0.907, "fmt": "webp"}, "guard": {"b64": "assets/poses/char_guard.webp", "w": 363, "h": 384, "bodyH": 366, "cropW": 363, "cropH": 384, "footX": 0.870445, "footY": 0.9792, "scaleAdj": 0.903, "fmt": "webp"}, "down": {"b64": "assets/poses/char_down.webp", "w": 384, "h": 264, "bodyH": 256, "cropW": 384, "cropH": 264, "footX": 0.210172, "footY": 0.9697, "scaleAdj": 1.0, "fmt": "webp"}}, "nao": {"idle": {"b64": "assets/poses/nao_idle.webp", "w": 344, "h": 384, "bodyH": 367, "cropW": 344, "cropH": 384, "footX": 0.840873, "footY": 0.9792, "scaleAdj": 1.1, "fmt": "webp"}, "walk": {"b64": "assets/poses/nao_walk.webp", "w": 239, "h": 384, "bodyH": 374, "cropW": 239, "cropH": 384, "footX": 0.532565, "footY": 0.9896, "scaleAdj": 1.079, "fmt": "webp"}, "punch": {"b64": "assets/poses/nao_punch.webp", "w": 384, "h": 314, "bodyH": 297, "cropW": 384, "cropH": 314, "footX": 0.818382, "footY": 0.9777, "scaleAdj": 1.36, "fmt": "webp"}, "kick": {"b64": "assets/poses/nao_kick.webp", "w": 356, "h": 384, "bodyH": 365, "cropW": 356, "cropH": 384, "footX": 0.316309, "footY": 0.9766, "scaleAdj": 1.105, "fmt": "webp"}, "guard": {"b64": "assets/poses/nao_guard.webp", "w": 373, "h": 384, "bodyH": 365, "cropW": 373, "cropH": 384, "footX": 0.847321, "footY": 0.9766, "scaleAdj": 1.105, "fmt": "webp"}, "down": {"b64": "assets/poses/nao_down.webp", "w": 384, "h": 277, "bodyH": 267, "cropW": 384, "cropH": 277, "footX": 0.605508, "footY": 0.9675, "scaleAdj": 1.513, "fmt": "webp"}}, "udobu": {"idle": {"b64": "assets/poses/udobu_idle.webp", "w": 279, "h": 355, "bodyH": 355, "cropW": 279, "cropH": 355, "footX": 0.4191, "footY": 1.0, "scaleAdj": 1.08, "fmt": "webp"}, "punch": {"b64": "assets/poses/udobu_punch.webp", "w": 466, "h": 336, "bodyH": 355, "cropW": 466, "cropH": 336, "footX": 0.2012, "footY": 1.0, "scaleAdj": 1.1411, "fmt": "webp"}, "walk": {"b64": "assets/poses/udobu_walk.webp", "w": 279, "h": 355, "bodyH": 355, "cropW": 279, "cropH": 355, "footX": 0.6669, "footY": 1.0, "scaleAdj": 1.08, "fmt": "webp"}, "kick": {"b64": "assets/poses/udobu_kick.webp", "w": 369, "h": 338, "bodyH": 355, "cropW": 369, "cropH": 338, "footX": 0.2944, "footY": 1.0, "scaleAdj": 1.13, "fmt": "webp"}, "guard": {"b64": "assets/poses/udobu_guard.webp", "w": 328, "h": 323, "bodyH": 355, "cropW": 328, "cropH": 323, "footX": 0.7135, "footY": 1.0, "scaleAdj": 1.187, "fmt": "webp"}, "down": {"b64": "assets/poses/udobu_down.webp", "w": 460, "h": 321, "bodyH": 355, "cropW": 460, "cropH": 321, "footX": 0.477, "footY": 1.0, "scaleAdj": 1.14, "fmt": "webp"}}, "arya": {"idle": {"w": 219, "h": 512, "cropW": 219, "cropH": 512, "footX": 0.8895, "footY": 1.0, "fmt": "webp", "b64": "assets/poses/arya_idle.webp", "scaleAdj": 1.0, "bodyH": 512}, "walk": {"w": 243, "h": 512, "cropW": 243, "cropH": 512, "footX": 0.2824, "footY": 1.0, "fmt": "webp", "b64": "assets/poses/arya_walk.webp", "scaleAdj": 1.0001, "bodyH": 512}, "punch": {"w": 302, "h": 512, "cropW": 302, "cropH": 512, "footX": 0.8803, "footY": 1.0, "fmt": "webp", "b64": "assets/poses/arya_punch.webp", "scaleAdj": 1.0009, "bodyH": 512}, "kick": {"w": 375, "h": 512, "cropW": 375, "cropH": 512, "footX": 0.1482, "footY": 1.0, "fmt": "webp", "b64": "assets/poses/arya_kick.webp", "scaleAdj": 1.0, "bodyH": 512}, "guard": {"w": 334, "h": 512, "cropW": 334, "cropH": 512, "footX": 0.5411, "footY": 1.0, "fmt": "webp", "b64": "assets/poses/arya_guard.webp", "scaleAdj": 0.95, "bodyH": 512}, "down": {"w": 512, "h": 282, "cropW": 512, "cropH": 282, "footX": 0.7407, "footY": 1.0, "scaleAdj": 1.1286, "bodyH": 512, "fmt": "webp", "b64": "assets/poses/arya_down.webp"}}, "arya_skirt": {"idle": {"b64": "assets/poses/arya_skirt_idle.webp", "w": 332, "h": 512, "cropW": 332, "cropH": 512, "footX": 0.8528, "footY": 1.0, "bodyH": 512, "scaleAdj": 1.0, "fmt": "webp"}, "walk": {"b64": "assets/poses/arya_skirt_walk.webp", "w": 398, "h": 512, "cropW": 398, "cropH": 512, "footX": 0.6672, "footY": 1.0, "bodyH": 512, "scaleAdj": 0.9807, "fmt": "webp"}, "punch": {"b64": "assets/poses/arya_skirt_punch.webp", "w": 436, "h": 512, "cropW": 436, "cropH": 512, "footX": 0.8032, "footY": 1.0, "bodyH": 512, "scaleAdj": 1.0, "fmt": "webp"}, "kick": {"b64": "assets/poses/arya_skirt_kick.webp", "w": 419, "h": 512, "cropW": 419, "cropH": 512, "footX": 0.4206, "footY": 1.0, "bodyH": 512, "scaleAdj": 0.9769, "fmt": "webp"}, "guard": {"b64": "assets/poses/arya_skirt_guard.webp", "w": 296, "h": 470, "cropW": 296, "cropH": 470, "footX": 0.9155, "footY": 1.0, "bodyH": 512, "scaleAdj": 1.1, "fmt": "webp"}, "down": {"b64": "assets/poses/arya_skirt_down.webp", "w": 768, "h": 512, "cropW": 768, "cropH": 512, "footX": 0.3571, "footY": 1.0, "bodyH": 512, "scaleAdj": 0.7013, "fmt": "webp"}}, "rice": {"special": {"b64": "assets/poses/rice_special.webp", "w": 420, "h": 496, "bodyH": 460, "cropW": 420, "cropH": 496, "footX": 0.397, "footY": 1.0, "scaleAdj": 1.15, "fmt": "webp"}, "idle": {"b64": "assets/poses/rice_idle.webp", "w": 326, "h": 460, "bodyH": 460, "cropW": 326, "cropH": 460, "footX": 0.1032, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "walk": {"b64": "assets/poses/rice_walk.webp", "w": 307, "h": 460, "bodyH": 460, "cropW": 307, "cropH": 460, "footX": 0.8188, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "punch": {"b64": "assets/poses/rice_punch.webp", "w": 421, "h": 460, "bodyH": 460, "cropW": 421, "cropH": 460, "footX": 0.8719, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "kick": {"b64": "assets/poses/rice_kick.webp", "w": 441, "h": 460, "bodyH": 460, "cropW": 441, "cropH": 460, "footX": 0.2452, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "guard": {"b64": "assets/poses/rice_guard.webp", "w": 335, "h": 460, "bodyH": 460, "cropW": 335, "cropH": 460, "footX": 0.2176, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "down": {"b64": "assets/poses/rice_down.webp", "w": 703, "h": 285, "bodyH": 460, "cropW": 703, "cropH": 285, "footX": 0.2805, "footY": 1.0, "scaleAdj": 0.654, "fmt": "webp"}}, "otome": {"idle": {"b64": "assets/poses/otome_idle.webp", "w": 322, "h": 456, "bodyH": 456, "cropW": 322, "cropH": 456, "footX": 0.5219, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "walk": {"b64": "assets/poses/otome_walk.webp", "w": 334, "h": 459, "bodyH": 456, "cropW": 334, "cropH": 459, "footX": 0.7107, "footY": 1.0, "scaleAdj": 0.9935, "fmt": "webp"}, "punch": {"b64": "assets/poses/otome_punch.webp", "w": 356, "h": 456, "bodyH": 456, "cropW": 356, "cropH": 456, "footX": 0.3998, "footY": 1.0, "scaleAdj": 1.0, "fmt": "webp"}, "kick": {"b64": "assets/poses/otome_kick.webp", "w": 366, "h": 425, "bodyH": 456, "cropW": 366, "cropH": 425, "footX": 0.426, "footY": 1.0, "scaleAdj": 1.0729, "fmt": "webp"}, "guard": {"b64": "assets/poses/otome_guard.webp", "w": 313, "h": 411, "bodyH": 456, "cropW": 313, "cropH": 411, "footX": 0.6426, "footY": 1.0, "scaleAdj": 1.1095, "fmt": "webp"}, "down": {"b64": "assets/poses/otome_down.webp", "w": 450, "h": 296, "bodyH": 456, "cropW": 450, "cropH": 296, "footX": 0.3814, "footY": 1.0, "scaleAdj": 0.9551, "fmt": "webp"}}};

const POSE_IMGS = {}; // charId -> {state: Image}
const POSE_META = {}; // charId -> {state: {footX,footY,relH}}
Object.keys(POSE_DATA).forEach(cid=>{
  POSE_IMGS[cid]={}; POSE_META[cid]={};
  Object.keys(POSE_DATA[cid]).forEach(st=>{
    if(st==='_meta')return;
    const d=POSE_DATA[cid][st];
    const im=new Image(); im.src=d.b64;
    POSE_IMGS[cid][st]=im;
    if(st==='_meta')return; POSE_META[cid][st]={footX:d.footX,footY:d.footY,bodyH:d.bodyH,cropW:d.cropW,cropH:d.cropH,scaleAdj:d.scaleAdj||1,w:d.w,h:d.h};
  });
});
function hasPoses(cid){ return !!POSE_IMGS[cid]; }
// stateをポーズ名にマップ
function poseNameFor(st, cid){
  if(st==='walk') return (cid && POSE_IMGS[cid] && POSE_IMGS[cid]['walk']) ? 'walk' : 'idle';
  if(st==='idle'||st==='jump') return 'idle';
  if(st==='punch') return 'punch';
  if(st==='kick') return 'kick';
  if(st==='hit') return 'idle';
  if(st==='ko') return 'down';
  return 'idle';
}

let SEL_P1 = 'J';   // プレイヤー選択
let SEL_P2 = 'nao'; // 相手選択
function rosterById(id){ return ROSTER.find(r=>r.id===id); }

// ===== あーりゃ衣装切替（B案）=====
// 'shopan'(ショーパン/デフォルト) または 'skirt'(スカート)
// ===== CPU難易度 =====
// delayBase/delayRand: 思考間隔(秒) guard: 攻撃への反応率 agg: 攻撃性
const CPU_DIFF = {
  easy:   {delayBase:0.50, delayRand:0.55, guard:0.20, agg:0.35},
  normal: {delayBase:0.25, delayRand:0.40, guard:0.62, agg:0.60},
  hard:   {delayBase:0.14, delayRand:0.22, guard:0.78, agg:0.85},
  oni:    {delayBase:0.07, delayRand:0.12, guard:0.90, agg:1.00},
};
let CPU_LEVEL = 'normal';
try{ const s=localStorage.getItem('ra_cpu_diff'); if(CPU_DIFF[s]) CPU_LEVEL=s; }catch(e){}
function setCpuLevel(lv){
  if(!CPU_DIFF[lv]) return;
  CPU_LEVEL=lv;
  try{ localStorage.setItem('ra_cpu_diff', lv); }catch(e){}
}

// プレイヤー側(P1)とCPU側(P2)で別々に保持
let ARYA_COSTUME = { p1:'shopan', p2:'shopan' };
// 描画・ポーズ参照に使う「実際の画像セットID」を返す
// あーりゃでスカート選択時は arya_skirt のデータを使う
function poseCharId(f){
  if(f && f.charId==='arya'){
    const cos = f.isPlayer ? ARYA_COSTUME.p1 : ARYA_COSTUME.p2;
    if(cos==='skirt' && POSE_IMGS['arya_skirt']) return 'arya_skirt';
  }
  return f ? f.charId : null;
}
// 衣装に応じた顔絵カードのbase64を返す（選択グリッド用）。side='p1'/'p2'
function cardImgFor(id, side){
  const r=rosterById(id);
  if(id==='arya'){
    const cos = side==='p2' ? ARYA_COSTUME.p2 : ARYA_COSTUME.p1;
    if(cos==='skirt' && r.imgSkirt) return r.imgSkirt;
  }
  return r.img;
}
// 衣装に応じた負け画像のbase64を返す（プレイヤー＝P1基準）
function loseImgFor(id){
  const r=rosterById(id);
  if(id==='arya' && ARYA_COSTUME.p1==='skirt' && r.loseImgSkirt) return r.loseImgSkirt;
  return r.loseImg;
}
// 衣装に応じた勝ち画像のbase64を返す（プレイヤー＝P1基準）。スカート版なら専用、無ければnull
function winImgFor(id){
  const r=rosterById(id);
  if(id==='arya' && ARYA_COSTUME.p1==='skirt' && r.winImgSkirt) return r.winImgSkirt;
  return r.winImg || null;
}

const FLOOR = 380;
const GRAVITY = 2000;
const WALK = 240;
const JUMP_V = -740;

// ===== Canvas setup =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(r.width * dpr));
  canvas.height = Math.max(1, Math.floor(r.height * dpr));
}
window.addEventListener('resize', resize);

// ===== Input =====
const keys = {};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['a','d','w','j','k','l','u',' ','arrowleft','arrowright','arrowup'].includes(k)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

document.querySelectorAll('.btn[data-key]').forEach(btn => {
  const k = btn.dataset.key;
  const down = e => { e.preventDefault(); keys[k] = true; btn.classList.add('is-down'); };
  const up = e => { e.preventDefault(); keys[k] = false; btn.classList.remove('is-down'); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('contextmenu', e => e.preventDefault());
});

// ===== Fighters =====
function makeFighter(x, facing, isPlayer, charId) {
  const r = rosterById(charId);
  const maxHp = Math.round(100 * r.hpMul);
  return {
    x, y: FLOOR, vx: 0, vy: 0,
    facing, hp: maxHp, maxHp,
    state: 'idle', stateTime: 0,
    hitDealt: false, blocking: false,
    isPlayer, charId, name: r.name, dmgMul: r.dmgMul, walkMul: r.walk, jumpMul: r.jump,
    aiTimer: 0, aiAction: 'wait', aiAgg: 0.6,
    flashTime: 0, shake: 0,
    prevPunch: false, prevKick: false,
    sp: 0, prevSp: false
  };
}

// State: idle, walk, jump, punch, kick, hit, ko, block (via flag)

let p1, p2;
let round = 1;
let wins = [0, 0];
let timer = 60;
let running = false;
let lastT = 0;
let roundEnding = false;
let cameraShake = 0;
let timeFreeze = 0;

const fx = [];
function spawnFx(x, y, opts={}) {
  const n = opts.count || 10;
  const colors = opts.colors || ['#D8FFFF', '#9EEFFF', '#2bd6ff'];
  for (let i = 0; i < n; i++) {
    fx.push({
      x, y,
      vx: (Math.random() - 0.5) * (opts.spread || 500),
      vy: (Math.random() - 0.5) * (opts.spread || 500) - (opts.upBias || 120),
      life: opts.life || 0.5,
      maxLife: opts.life || 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 3 + Math.random() * (opts.size || 5),
      gravity: opts.gravity !== undefined ? opts.gravity : 900
    });
  }
}

const shoutEl = document.getElementById('shout');
function updateHpBar(side, hp, maxHp){
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const fill = document.getElementById('hp'+side);
  const ghost = document.getElementById('hp'+side+'ghost');
  if(!fill) return;
  fill.style.width = pct + '%';
  // 遅延バー: 本体より下回ったら追従（削れ演出）。増えた場合は即追従。
  if(ghost){
    const cur = parseFloat(ghost.style.width) || 100;
    if(pct >= cur){ ghost.style.width = pct + '%'; }
    else { ghost.style.width = cur + '%'; setTimeout(()=>{ ghost.style.width = pct + '%'; }, 80); }
  }
  // 残量で色変化
  fill.classList.toggle('low', pct <= 45 && pct > 22);
  fill.classList.toggle('crit', pct <= 22);
}

function shout(text, ms=1200) {
  shoutEl.textContent = text;
  shoutEl.classList.remove('show');
  // force reflow
  void shoutEl.offsetWidth;
  shoutEl.classList.add('show');
  setTimeout(() => shoutEl.classList.remove('show'), ms);
}

function updateWinPips() {
  ['wins1','wins2'].forEach((id, i) => {
    const spans = document.getElementById(id).children;
    for (let j = 0; j < spans.length; j++) {
      spans[j].classList.toggle('on', j < wins[i]);
    }
  });
}

function startRound() {
  // ステージはプレイヤーが選んだものを使用。ROUND1=そのステージの主役、ROUND2以降=時間が移ろう
  if(round===1){ STAGE_PLACE = SEL_STAGE; }
  SFX.startBattleBGM(STAGE_PLACE);
  if(STAGE_PLACE==='A'){
    // 獅子の聖殿: 夜の獅子紋章で始まり、延長で夜明けの蒼穹へ
    CUR_BG = (round===1) ? 'lion_night' : 'sky_day';
  } else if(STAGE_PLACE==='B'){
    // 蒼穹の塔: 青空の摩天楼で始まり、延長で夜の獅子紋章へ
    CUR_BG = (round===1) ? 'sky_day' : 'lion_night';
  } else {
    // 武舞台: 全ラウンド通して大会会場
    CUR_BG = 'budokai';
  }
  p1 = makeFighter(220, 1, true, SEL_P1);
  p2 = makeFighter(680, -1, false, SEL_P2);
  p2.aiAgg = 0.5 + (round - 1) * 0.12 + wins[0] * 0.08;
  // HUD名前を反映
  document.getElementById('nm1').textContent = rosterById(SEL_P1).name;
  document.getElementById('nm2').textContent = rosterById(SEL_P2).name;
  timer = 99;
  running = false;
  roundEnding = false;
  projs.length = 0;
  hooks.length = 0;
  document.getElementById('round').textContent = 'ROUND ' + round;
  document.getElementById('hp1').style.width = '100%';
  document.getElementById('hp2').style.width = '100%';
  const g1=document.getElementById('hp1ghost'), g2=document.getElementById('hp2ghost');
  if(g1) g1.style.width='100%'; if(g2) g2.style.width='100%';
  ['hp1','hp2'].forEach(id=>{ const e=document.getElementById(id); if(e) e.classList.remove('low','crit'); });
  shout('ROUND ' + round, 900);
  setTimeout(() => { shout('FIGHT!', 800); running = true; }, 1000);
}

function endMatch(playerWon) {
  const me = rosterById(SEL_P1);
  const lines = playerWon ? me.win : me.lose;
  const msg = lines[Math.floor(Math.random()*lines.length)];
  // 衣装対応: スカート版あーりゃなら専用カード/負け画像を使う
  const winFace = winImgFor(SEL_P1);
  const loseFace = loseImgFor(SEL_P1);
  let faceImg, faceSize;
  if(!playerWon){
    faceImg = loseFace || cardImgFor(SEL_P1,'p1');
    faceSize = loseFace ? '200px' : '120px';
  } else {
    faceImg = winFace || cardImgFor(SEL_P1,'p1');
    faceSize = winFace ? '200px' : '120px';
  }
  document.body.classList.remove('in-battle'); resize();
  // 専用の結果パネルを使う(overlayのタイトルDOMは破壊しない)
  let res=document.getElementById('resultOverlay');
  if(!res){
    res=document.createElement('div');
    res.id='resultOverlay';
    res.className='overlay';
    document.body.appendChild(res);
  }
  res.classList.remove('hidden');
  res.innerHTML = `
    <img src="${faceImg}" style="max-width:min(72vw,460px);max-height:min(34vh,230px);width:auto;height:auto;object-fit:contain;border-radius:12px;border:3px solid ${playerWon?'#5effc8':'#5a7a90'};box-shadow:0 0 24px ${playerWon?'#5effc888':'#5a7a9088'};margin-bottom:1vh;">
    <div class="title" style="font-size:clamp(22px,7vh,44px);line-height:1.1;color:${playerWon?'#5effc8':'#9bbdd0'}">${playerWon ? 'YOU WIN' : 'LOSE'}</div>
    <div class="subtitle" style="margin:0.6vh 0;">「${msg}」</div>
    <div class="instructions" style="margin:0.4vh 0 1.2vh;">SCORE <b>${wins[0]} – ${wins[1]}</b></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
      <button class="start-btn" id="reBtn" style="margin:0;padding:12px 20px;font-size:14px;">もう一度</button>
      <button class="start-btn" id="selBtn" style="margin:0;padding:12px 20px;font-size:14px;background:rgba(8,20,32,.6);color:#9EEFFF;border-color:rgba(158,239,255,.4);box-shadow:0 6px 0 rgba(0,15,30,.8),0 0 12px rgba(158,239,255,.2);">キャラ選択へ</button>
      <button class="start-btn" id="titleBtn" style="margin:0;padding:12px 20px;font-size:14px;background:rgba(8,20,32,.6);color:#9EEFFF;border-color:rgba(158,239,255,.4);box-shadow:0 6px 0 rgba(0,15,30,.8),0 0 12px rgba(158,239,255,.2);">タイトルへ</button>
    </div>
  `;
  document.getElementById('reBtn').addEventListener('click', ()=>{ res.classList.add('hidden'); startMatch(); });
  document.getElementById('selBtn').addEventListener('click', ()=>{ res.classList.add('hidden'); SFX.stopBattleBGM(); showCharSelect(); });
  document.getElementById('titleBtn').addEventListener('click', ()=>{ res.classList.add('hidden'); SFX.stopBGM(); SFX.stopLobbyBGM(); SFX.stopBattleBGM(); showTitle(); });
}
function __endMatch_OLD_UNUSED(playerWon){
  const me = rosterById(SEL_P1);
  const lines = playerWon ? me.win : me.lose;
  const msg = lines[Math.floor(Math.random()*lines.length)];
  const winFace = winImgFor(SEL_P1);
  const loseFace = loseImgFor(SEL_P1);
  let faceImg, faceSize;
  if(!playerWon){ faceImg = loseFace || cardImgFor(SEL_P1,'p1'); faceSize = loseFace ? '200px' : '120px'; }
  else { faceImg = winFace || cardImgFor(SEL_P1,'p1'); faceSize = winFace ? '200px' : '120px'; }
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlay').classList.remove('title-screen');
  document.getElementById('overlay').innerHTML = `
    <img src="${faceImg}" style="width:${faceSize};height:${faceSize};object-fit:cover;border-radius:12px;border:3px solid ${playerWon?'#5effc8':'#5a7a90'};box-shadow:0 0 30px ${playerWon?'#5effc888':'#5a7a9088'};margin-bottom:16px;">
    <div class="title" style="font-size:clamp(28px,9vw,52px);color:${playerWon?'#5effc8':'#9bbdd0'}">${playerWon ? 'YOU WIN' : 'LOSE'}</div>
    <div class="subtitle">「${msg}」</div>
    <div class="instructions">SCORE <b>${wins[0]} – ${wins[1]}</b></div>
    <button class="start-btn" id="reBtn">もう一度</button>
    <button class="start-btn" id="selBtn" style="background:rgba(8,20,32,.6);color:#9EEFFF;border-color:rgba(158,239,255,.4);box-shadow:0 6px 0 rgba(0,15,30,.8),0 0 12px rgba(158,239,255,.2);margin-top:10px;">キャラ選択へ</button>
  `;
  document.getElementById('reBtn').addEventListener('click', startMatch);
  document.getElementById('selBtn').addEventListener('click', showCharSelect);
}


// ===== キャラ選択画面（スライド式） =====
let selStage = 'p1'; // 'p1' or 'p2'
let selIdx = 0;       // 現在表示中のキャラの ROSTER インデックス
// 立ち絵パネル。あーりゃは衣装で出し分け。
const STANDEE = {
  J:'assets/standees/J.webp',
  nao:'assets/standees/nao.webp',
  rice:'assets/standees/rice.webp',
  udobu:'assets/standees/udobu.webp',
  char:'assets/standees/char.webp',
  arya:'assets/standees/arya.webp',
  arya_skirt:'assets/standees/arya_skirt.webp',
  otome:'assets/standees/otome.webp',
};
function standeeFor(id, side){
  if(id==='arya'){
    const cos = side==='p2' ? ARYA_COSTUME.p2 : ARYA_COSTUME.p1;
    return cos==='skirt' ? STANDEE['arya_skirt'] : STANDEE['arya'];
  }
  return STANDEE[id] || null;
}

// ロスター一覧は選択画面を開くたびに最新化
function buildSelDots(){
  const dots=document.getElementById('selDots');
  dots.innerHTML='';
  ROSTER.forEach((_,i)=>{
    const d=document.createElement('i');
    if(i===selIdx) d.classList.add('on');
    dots.appendChild(d);
  });
}
function currentSelId(){ return ROSTER[selIdx].id; }

function renderStandee(dir){
  const r = ROSTER[selIdx];
  const img = document.getElementById('selStandee');
  const ov  = document.getElementById('selOverlay');
  img.src = standeeFor(r.id, selStage) || r.img;
  applyStandeeHeight(img, r.id);
  document.getElementById('selName').textContent = r.name;
  document.getElementById('selType').textContent = '― '+r.type+' ―';
  renderStats(r);
  document.querySelectorAll('#selDots i').forEach((d,i)=>d.classList.toggle('on',i===selIdx));
  document.querySelectorAll('#selRoster .sel-rcell').forEach((c,i)=>c.classList.toggle('on',i===selIdx));
  ov.classList.remove('swipe-l','swipe-r');
  if(dir==='l'){ void ov.offsetWidth; ov.classList.add('swipe-l'); }
  else if(dir==='r'){ void ov.offsetWidth; ov.classList.add('swipe-r'); }
  commitPick();
  updateCostumeRow();
}

// 表示中のキャラを現在の段階(p1/p2)の選択として確定
function commitPick(){
  const id = currentSelId();
  if(selStage==='p1'){
    SEL_P1=id;
    document.getElementById('selCpu').textContent='選択中：'+rosterById(id).name+'（あなた）';
  } else {
    SEL_P2=id;
    document.getElementById('selCpu').textContent='対戦相手：'+rosterById(id).name+'（CPU）';
  }
}

function slidePrev(){ selIdx=(selIdx-1+ROSTER.length)%ROSTER.length; renderStandee('r'); }
function slideNext(){ selIdx=(selIdx+1)%ROSTER.length; renderStandee('l'); }

// 旧グリッド互換（呼ばれても何もしない）
function buildSelGrid(){
  const g=document.getElementById('selRoster');
  if(!g) return;
  g.innerHTML='';
  ROSTER.forEach((r,i)=>{
    const c=document.createElement('div');
    c.className='sel-rcell'+(i===selIdx?' on':'');
    c.innerHTML='<img src="'+r.img+'" alt=""><div class="rn">'+r.name+'</div>';
    c.addEventListener('click',()=>{
      if(i===selIdx) return;
      const dir = i>selIdx ? 'l' : 'r';
      selIdx=i; renderStandee(dir);
    });
    g.appendChild(c);
  });
}
function pickChar(id){
  const i=ROSTER.findIndex(r=>r.id===id);
  if(i>=0){ selIdx=i; renderStandee(); }
}
// あーりゃ選択時だけ 👗/🩳 切替ボタンを出す。今選んでいる側(p1/p2)の衣装を操作
function updateCostumeRow(){
  const row=document.getElementById('costumeRow');
  const side=selStage;
  const sel = side==='p1' ? SEL_P1 : SEL_P2;
  if(sel==='arya' && POSE_IMGS['arya_skirt']){
    row.style.display='block';
    refreshCostumeBtn();
  } else {
    row.style.display='none';
  }
}
// 立ち絵の実寸比から算出した身長スケール（足元はポディウムに接地したまま身長差を出す）
const STANDEE_HPCT = {nao:100, J:96.2, arya:92.8, arya_skirt:96.7, rice:94.8, otome:91.7, char:87.4, udobu:85.3};
// キャラ性能(倍率0.8〜1.4くらい)をバー幅10〜100%に変換して表示
function renderStats(r){
  const pct = v => Math.max(10, Math.min(100, Math.round((v-0.7)/(1.45-0.7)*100)));
  const m = {stHp:r.hpMul, stAtk:r.dmgMul, stSpd:r.walk, stJmp:r.jump};
  for(const id in m){
    const el=document.getElementById(id);
    if(el) el.style.width = pct(m[id])+'%';
  }
}
function applyStandeeHeight(img, id){
  const cos = (selStage==='p1' ? ARYA_COSTUME.p1 : ARYA_COSTUME.p2);
  const key = (id==='arya' && cos==='skirt') ? 'arya_skirt' : id;
  // 身長スケール(最長身=100)を画面高さ基準のvhに変換（最長身=70vh）
  img.style.height = ((STANDEE_HPCT[key]||100)*0.70).toFixed(1)+'vh';
}
function refreshCostumeBtn(){
  const side=selStage;
  const cos = side==='p1' ? ARYA_COSTUME.p1 : ARYA_COSTUME.p2;
  const btn=document.getElementById('costumeBtn');
  btn.textContent = cos==='skirt' ? '✦ エレガントVer.' : '⚡ ストリートVer.';
  // 衣装を変えたら立ち絵パネルも差し替え
  if(currentSelId()==='arya'){
    const img=document.getElementById('selStandee');
    img.src = standeeFor('arya', side);
    applyStandeeHeight(img,'arya');
  }
}
function toggleCostume(){
  const side=selStage;
  if(side==='p1') ARYA_COSTUME.p1 = ARYA_COSTUME.p1==='skirt' ? 'shopan' : 'skirt';
  else            ARYA_COSTUME.p2 = ARYA_COSTUME.p2==='skirt' ? 'shopan' : 'skirt';
  refreshCostumeBtn();
}
function highlight(id){
  const i=ROSTER.findIndex(r=>r.id===id);
  if(i>=0) selIdx=i;
}
function showCharSelect(){
  document.body.classList.remove('in-battle'); resize();
  const _r=document.getElementById('resultOverlay'); if(_r) _r.classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
  const so=document.getElementById('selOverlay');
  so.classList.remove('hidden');
  // ロビーBGMに切替（タイトルBGM・風を止める）
  SFX.stopBGM(); SFX.stopTitleBGM(); SFX.stopWind(); SFX.stopBattleBGM();
  SFX.startLobbyBGM();
  selStage='p1';
  selIdx = Math.max(0, ROSTER.findIndex(r=>r.id===SEL_P1));
  buildSelDots();
  buildSelGrid();
  document.getElementById('selSide').textContent='① あなたの幹部を選べ';
  document.getElementById('fightBtn').textContent='この幹部で決定 ▶';
  renderStandee();
}
// ロビー（キャラ選択）からタイトル画面へ戻る
function showTitle(){
  document.body.classList.remove('in-battle'); resize();
  const _r=document.getElementById('resultOverlay'); if(_r) _r.classList.add('hidden');
  document.getElementById('selOverlay').classList.add('hidden');
  SFX.stopBGM(); SFX.stopLobbyBGM(); SFX.stopBattleBGM();
  const ov=document.getElementById('overlay');
  ov.classList.remove('hidden');
  ov.classList.add('title-screen');
  SFX.startTitleBGM();
  SFX.startWind();
}
function onFightBtn(){
  if(selStage==='p1'){
    selStage='p2';
    document.getElementById('selSide').textContent='② 対戦相手（CPU）を選べ';
    document.getElementById('fightBtn').textContent='この相手と試合開始 ▶';
    // CPU側は別キャラを初期表示（同キャラ被り回避）
    selIdx = ROSTER.findIndex(r=>r.id===SEL_P2);
    if(selIdx<0 || ROSTER[selIdx].id===SEL_P1){
      selIdx = (ROSTER.findIndex(r=>r.id===SEL_P1)+1)%ROSTER.length;
    }
    renderStandee();
  } else {
    document.getElementById('selOverlay').classList.add('hidden');
    showStageSelect();
  }
}

// ===== 会場選択 =====
let SEL_STAGE = 'A';  // A=獅子の聖殿 / B=蒼穹の塔
const STAGE_INFO = [
  { id:'A', name:'蒼雨の電脳都市', preview:'assets/stages/lion_night.webp' },
  { id:'B', name:'蒼穹の摩天楼', preview:'assets/stages/sky_day.webp' },
  { id:'C', name:'天下一武道会', preview:'assets/stages/budokai_bg3.webp' },
];
function buildStageGrid(){
  const grid=document.getElementById('stageGrid');
  grid.innerHTML='';
  STAGE_INFO.forEach(s=>{
    const cell=document.createElement('div');
    cell.className='stage-cell'+(s.id===SEL_STAGE?' on':'');
    cell.innerHTML='<img src="'+s.preview+'"><div class="sn">'+s.name+'</div>';
    cell.addEventListener('click',()=>{
      SEL_STAGE=s.id;
      SFX.init(); if(SFX.block) SFX.block();
      buildStageGrid();
    });
    grid.appendChild(cell);
  });
}
function showStageSelect(){
  document.getElementById('selOverlay').classList.add('hidden');
  document.getElementById('stageOverlay').classList.remove('hidden');
  buildStageGrid();
}

function startMatch() {
  const _r=document.getElementById('resultOverlay'); if(_r) _r.classList.add('hidden');
  document.body.classList.add('in-battle'); resize();
  SFX.init(); SFX.stopTitleBGM(); SFX.stopWind(); SFX.stopLobbyBGM(); // バトルBGMはstartRoundでステージ別に開始
  round = 1;
  wins = [0, 0];
  updateWinPips();
  document.getElementById('overlay').classList.add('hidden');
  startRound();
}
// ===== 雷の時間ループ（雨の強弱に合わせてランダムに光る） =====
(function stormLoop(){
  const rain=document.querySelector('#overlay .ts-rain');
  const flash=document.getElementById('tsFlash');
  function bolt(){
    const ov=document.getElementById('overlay');
    if(ov && ov.classList.contains('title-screen') && !ov.classList.contains('hidden') && flash){
      flash.classList.remove('bolt'); void flash.offsetWidth; flash.classList.add('bolt');
      if(window.SFX && SFX.thunder) SFX.thunder();
    }
    // 次の雷までの間隔をランダムに（強い雨の周期=11s に緩く同期）
    setTimeout(bolt, 2500 + Math.random()*3500);
  }
  setTimeout(bolt, 1800);
  // 雨が強いフェーズで heavy クラスを付け外し
  setInterval(()=>{
    if(!rain) return;
    const t=(Date.now()%11000)/11000;
    if(t>0.40 && t<0.65) rain.classList.add('heavy'); else rain.classList.remove('heavy');
  }, 500);
})();

// ===== PRESS START 押下：上下の光を強くフラッシュ → 画面遷移 =====
document.getElementById('startBtn').addEventListener('click', (e)=>{
  if(window.__titleTapLock){ if(e){e.preventDefault();e.stopPropagation();} return; } // スプラッシュ貫通防止
  SFX.init();
  const beam=document.querySelector('#overlay .ts-beam');
  const refl=document.querySelector('#overlay .ts-reflect');
  const flash=document.getElementById('tsFlash');
  if(beam){ beam.classList.remove('flash'); void beam.offsetWidth; beam.classList.add('flash'); }
  if(refl){ refl.classList.remove('flash'); void refl.offsetWidth; refl.classList.add('flash'); }
  if(flash){ flash.classList.remove('start'); void flash.offsetWidth; flash.classList.add('start'); }
  if(window.SFX && SFX.startFlash) SFX.startFlash();
  SFX.stopTitleBGM();
  SFX.stopWind();
  // 光をしっかり見せてから遷移（フラッシュのピークを見せる）
  setTimeout(showCharSelect, 700);
});
// ロビー → タイトル画面へ戻る
document.getElementById('selBackBtn').addEventListener('click', ()=>{ SFX.init(); showTitle(); });
// 会場選択：この会場で試合開始
document.getElementById('stageFightBtn').addEventListener('click', ()=>{
  document.getElementById('stageOverlay').classList.add('hidden');
  startMatch();
});
// 会場選択：キャラ選択へ戻る
document.getElementById('stageBackBtn').addEventListener('click', ()=>{
  document.getElementById('stageOverlay').classList.add('hidden');
  showCharSelect();
});
// 最初のタッチ/クリックで音声をアンロック(iPhone対策)。タイトル画面ならBGM開始
['touchstart','pointerdown','click'].forEach(ev=>{
  window.addEventListener(ev, ()=>{
    SFX.init();
    const ov=document.getElementById('overlay');
    if(ov && ov.classList.contains('title-screen') && !ov.classList.contains('hidden')){
      SFX.startTitleBGM();
      SFX.startWind();
    }
  }, { once:false });
});
// ===== 設定画面 =====
(function(){
  const sBtn=document.getElementById('settingsBtn');
  const ov=document.getElementById('settingsOverlay');
  const closeBtn=document.getElementById('setCloseBtn');
  const sndToggle=document.getElementById('setSoundToggle');
  const bgmSlider=document.getElementById('bgmSlider');
  const seSlider=document.getElementById('seSlider');
  const brightSlider=document.getElementById('brightSlider');
  const bgmVal=document.getElementById('bgmVal');
  const seVal=document.getElementById('seVal');
  const brightVal=document.getElementById('brightVal');
  const arena=document.querySelector('.arena');

  // 初期値をSFXから反映
  bgmSlider.value=Math.round(SFX.bgmVol*100); bgmVal.textContent=bgmSlider.value;
  seSlider.value=Math.round(SFX.seVol*100);  seVal.textContent=seSlider.value;

  // CPU難易度セグメント：保存値を反映し、タップで切替
  const seg=document.getElementById('cpuDiffSeg');
  if(seg){
    const segBtns=seg.querySelectorAll('button');
    segBtns.forEach(b=>b.classList.toggle('on', b.dataset.lv===CPU_LEVEL));
    seg.addEventListener('click', e=>{
      const b=e.target.closest('button[data-lv]');
      if(!b) return;
      setCpuLevel(b.dataset.lv);
      segBtns.forEach(x=>x.classList.toggle('on', x===b));
    });
  }

  function open(){ SFX.init(); ov.classList.remove('hidden');
    sndToggle.textContent=SFX.on?'ON':'OFF';
    sndToggle.classList.toggle('on',SFX.on); sndToggle.classList.toggle('off',!SFX.on);
  }
  function close(){ ov.classList.add('hidden'); }

  sBtn.addEventListener('click', open);
  const tBtn=document.getElementById('titleSettingsBtn');
  if(tBtn){ tBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); open(); }); }
  closeBtn.addEventListener('click', ()=>{ SFX.init(); close(); });

  sndToggle.addEventListener('click', function(){
    SFX.init();
    const on=SFX.toggle();
    this.textContent=on?'ON':'OFF';
    this.classList.toggle('on',on); this.classList.toggle('off',!on);
    if(on){
      const t=document.getElementById('overlay');
      if(t && t.classList.contains('title-screen') && !t.classList.contains('hidden')){
        SFX.startTitleBGM(); SFX.startWind();
      }
    }
  });
  bgmSlider.addEventListener('input', function(){ bgmVal.textContent=this.value; SFX.setBgmVol(this.value/100); });
  seSlider.addEventListener('input', function(){ seVal.textContent=this.value; SFX.setSeVol(this.value/100); SFX.block&&SFX.block(); });
  brightSlider.addEventListener('input', function(){
    brightVal.textContent=this.value;
    const v=this.value/100;            // 1.0=標準。<1暗く >1明るく
    const dim=v<=1 ? (1-v) : 0;        // 暗くする量
    arena.classList.toggle('dim', dim>0.001);
    arena.style.setProperty('--dim', dim.toFixed(3));
    // 明るくする方向はcanvas/overlayにbrightnessフィルタ
    arena.style.filter = v>1 ? ('brightness('+v.toFixed(2)+')') : 'none';
  });
})();
document.getElementById('fightBtn').addEventListener('click', onFightBtn);
// スライド：左右矢印
document.getElementById('selPrev').addEventListener('click', ()=>{ SFX.init(); slidePrev(); });
document.getElementById('selNext').addEventListener('click', ()=>{ SFX.init(); slideNext(); });
// スライド：スワイプ操作
(function(){
  const wrap=document.getElementById('selStageWrap');
  let x0=null;
  wrap.addEventListener('touchstart',e=>{ x0=e.touches[0].clientX; },{passive:true});
  wrap.addEventListener('touchend',e=>{
    if(x0===null) return;
    const dx=e.changedTouches[0].clientX-x0; x0=null;
    if(Math.abs(dx)<36) return;
    SFX.init();
    if(dx<0) slideNext(); else slidePrev();
  },{passive:true});
  // PCマウスドラッグも一応
  let mx=null;
  wrap.addEventListener('mousedown',e=>{ mx=e.clientX; });
  window.addEventListener('mouseup',e=>{
    if(mx===null) return; const dx=e.clientX-mx; mx=null;
    if(Math.abs(dx)<36) return; SFX.init();
    if(dx<0) slideNext(); else slidePrev();
  });
})();
document.getElementById('costumeBtn').addEventListener('click', toggleCostume);

// ===== Input mapping =====
function readInputs(f, opp) {
  if (f.isPlayer) {
    return {
      left: !!(keys['a'] || keys['arrowleft']),
      right: !!(keys['d'] || keys['arrowright']),
      up: !!(keys['w'] || keys[' '] || keys['arrowup']),
      punch: !!keys['j'],
      kick: !!keys['k'],
      block: !!keys['l'],
      sp: !!keys['u']
    };
  }
  // ===== CPU AI =====
  const dx = opp.x - f.x;
  const dist = Math.abs(dx);
  const oppAttacking = opp.state === 'punch' || opp.state === 'kick';
  const oppClose = dist < 110;
  f.aiTimer -= 1/60;

  if (f.aiTimer <= 0) {
    const D = CPU_DIFF[CPU_LEVEL] || CPU_DIFF.normal;
    const agg = D.agg;
    f.aiTimer = D.delayBase + Math.random() * D.delayRand;
    if (oppAttacking && oppClose && Math.random() < D.guard) {
      f.aiAction = Math.random() < 0.5 ? 'block' : 'jump';
    } else if (dist > 130) {
      f.aiAction = (f.sp >= 100 && dist < 460 && Math.random() < 0.35) ? 'sp' : (dx > 0 ? 'right' : 'left');
    } else if (oppClose) {
      const r = Math.random();
      if (f.sp >= 100 && Math.random() < 0.6) f.aiAction = 'sp';
      else if (r < 0.45 * agg) f.aiAction = 'punch';
      else if (r < 0.75 * agg) f.aiAction = 'kick';
      else if (r < 0.85) f.aiAction = 'jump';
      else if (r < 0.92) f.aiAction = 'block';
      else f.aiAction = dx > 0 ? 'right' : 'left';
    } else {
      f.aiAction = dx > 0 ? 'right' : 'left';
    }
  }
  return {
    left: f.aiAction === 'left',
    right: f.aiAction === 'right',
    up: f.aiAction === 'jump',
    punch: f.aiAction === 'punch',
    kick: f.aiAction === 'kick',
    block: f.aiAction === 'block',
    sp: f.aiAction === 'sp'
  };
}

// ===== Hitboxes =====
function bodyBox(f) {
  return { x: f.x - 24, y: f.y - 105, w: 48, h: 105 };
}
function attackBox(f, kind) {
  if (kind === 'punch') {
    return { x: f.x + f.facing * 18, y: f.y - 80, w: 60, h: 22, dir: f.facing };
  } else {
    return { x: f.x + f.facing * 22, y: f.y - 55, w: 78, h: 32, dir: f.facing };
  }
}
function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}
function hits(hb, target) {
  const b = bodyBox(target);
  const ax = hb.dir > 0 ? hb.x : hb.x - hb.w;
  return rectsOverlap({ x: ax, y: hb.y, w: hb.w, h: hb.h }, b);
}

function applyHit(target, attacker, dmg, kb) {
  if (target.state === 'ko') return;
  let actualDmg = dmg;
  let actualKb = kb;
  const blocked = target.blocking && Math.sign(target.x - attacker.x) === Math.sign(attacker.facing) * -1;
  if (target.blocking) {
    actualDmg = dmg * 0.18;
    actualKb = kb * 0.35;
  }
  const armored = target.state === 'special';   // 必殺発動中はのけぞらない
  target.hp = Math.max(0, target.hp - actualDmg);
  if (!armored) {
    target.vx = attacker.facing * actualKb;
    target.vy = blocked ? -80 : -180;
  }
  if (!target.blocking && !armored) {
    target.state = 'hit';
    target.stateTime = 0;
  }
  // SPゲージ: 攻撃ヒットで大きく、被弾で少し溜まる
  attacker.sp = Math.min(100, attacker.sp + (target.blocking ? 5 : 12));
  target.sp = Math.min(100, target.sp + 7);
  target.flashTime = 0.15;
  if (target.blocking) { SFX.block(); }
  else if (dmg >= 12) { SFX.kick(); }
  else { SFX.punch(); }
  cameraShake = Math.max(cameraShake, blocked ? 4 : 10);
  timeFreeze = Math.max(timeFreeze, blocked ? 0.04 : 0.07);
  spawnFx(
    attacker.x + attacker.facing * 50,
    target.y - 60,
    blocked
      ? { count: 8, colors: ['#88ccff','#ffffff','#2bfff2'], spread: 350, size: 4 }
      : { count: 16, colors: ['#D8FFFF','#9EEFFF','#2bd6ff','#ffffff'], spread: 600, size: 6 }
  );
  if (target.hp <= 0) {
    target.state = 'ko';
    target.stateTime = 0;
    target.vy = -300;
    target.vx = attacker.facing * 250;
    cameraShake = 18;
    SFX.ko();
  }
}


// ===== 必殺技システム =====
const SPECIAL_COLORS = {
  nao:'#ff5a3c', rice:'#ffd23e', udobu:'#9be8ff', char:'#c77dff',
  arya:'#6ee7b7', J:'#36d1ff', otome:'#ff9ad5'
};
function specialColor(id){ return SPECIAL_COLORS[id] || '#9EEFFF'; }
const projs = [];
function startSpecial(f){
  f.state = 'special'; f.stateTime = 0; f.hitDealt = false;
  f.specialKind = (f.charId === 'rice') ? 'fishing' : 'beam';
  f.sp = 0; f.vx = 0;
  timeFreeze = Math.max(timeFreeze, 0.10);
  cameraShake = Math.max(cameraShake, 6);
  SFX.special();
  spawnFx(f.x, f.y - 70, { count: 18, colors: [specialColor(f.charId), '#ffffff'], spread: 700, size: 6 });
}
function fireSpecial(f){
  const col = specialColor(f.charId);
  projs.push({
    x: f.x + f.facing * 55, y: f.y - 70,
    vx: f.facing * 560, w: 110, h: 56,
    owner: f, col, life: 1.6, trail: 0
  });
  cameraShake = Math.max(cameraShake, 8);
  SFX.specialFire();
}
// ===== ライス専用必殺技: 釣り上げ(フィッシング) =====
const hooks = [];
function hookFor(f){ return hooks.find(h => h.owner === f) || null; }
function removeHookFor(f){ const i = hooks.findIndex(h => h.owner === f); if(i >= 0) hooks.splice(i,1); }
function fireHook(f){
  const sx = f.x + f.facing * 50, sy = f.y - 95;
  hooks.push({ owner: f, phase: 'cast', x: sx, y: sy, sx, sy, dir: f.facing, dist: 0, t: 0, gx: 0, gy: 0 });
  SFX.specialFire();
}
function fishSlamHit(opp, f){
  const col = specialColor(f.charId);
  opp.hp = Math.max(0, opp.hp - 26 * f.dmgMul);
  f.sp = Math.min(100, f.sp + 12);
  opp.sp = Math.min(100, opp.sp + 7);
  opp.flashTime = 0.2;
  cameraShake = Math.max(cameraShake, 18);
  timeFreeze = Math.max(timeFreeze, 0.12);
  spawnFx(opp.x, FLOOR - 30, { count: 30, colors: [col, '#ffffff', '#D8FFFF'], spread: 950, size: 7 });
  if (opp.hp <= 0) {
    opp.state = 'ko'; opp.stateTime = 0;
    opp.vy = -260; opp.vx = f.facing * 220;
    SFX.ko();
  } else {
    opp.state = 'hit'; opp.stateTime = 0;
    opp.vx = f.facing * 120; opp.vy = -140;
    SFX.kick();
  }
}
function updateHooks(dt){
  for (let i = hooks.length - 1; i >= 0; i--){
    const h = hooks[i];
    const f = h.owner;
    const opp = (f === p1) ? p2 : p1;
    if (!p1 || !p2 || f.state === 'ko'){ hooks.splice(i,1); continue; }
    if (h.phase === 'cast'){
      const v = 860 * dt;
      h.x += h.dir * v; h.dist += v;
      if (opp.state !== 'ko' && rectsOverlap({x: h.x - 26, y: h.y - 26, w: 52, h: 52}, bodyBox(opp))){
        h.phase = 'pull'; h.t = 0;
        h.gx = opp.x; h.gy = opp.y;
        opp.blocking = false;
        SFX.punch();
        spawnFx(opp.x, opp.y - 70, { count: 14, colors: [specialColor(f.charId), '#ffffff'], spread: 600, size: 5 });
      } else if (h.dist > 430){
        h.phase = 'retract';
      }
    } else if (h.phase === 'retract'){
      h.x -= h.dir * 1300 * dt;
      if ((h.dir > 0 && h.x <= h.sx) || (h.dir < 0 && h.x >= h.sx)) hooks.splice(i,1);
    } else if (h.phase === 'pull'){
      if (opp.state === 'ko'){ hooks.splice(i,1); continue; }
      h.t += dt;
      const k = Math.min(1, h.t / 0.34);
      const e = 1 - Math.pow(1 - k, 3);
      const apexX = f.x + f.facing * 95, apexY = FLOOR - 265;
      opp.x = h.gx + (apexX - h.gx) * e;
      opp.y = h.gy + (apexY - h.gy) * e;
      opp.vx = 0; opp.vy = 0;
      opp.state = 'hit'; opp.stateTime = 0;
      h.x = opp.x; h.y = opp.y - 70;
      if (k >= 1){ h.phase = 'slam'; h.t = 0; h.gx = opp.x; h.gy = opp.y; }
    } else if (h.phase === 'slam'){
      if (opp.state === 'ko'){ hooks.splice(i,1); continue; }
      h.t += dt;
      const k = Math.min(1, h.t / 0.16);
      const e = k * k;
      opp.x = h.gx + (f.facing * 25) * e;
      opp.y = h.gy + (FLOOR - h.gy) * e;
      opp.vx = 0; opp.vy = 0;
      opp.state = 'hit'; opp.stateTime = 0;
      h.x = opp.x; h.y = opp.y - 70;
      if (k >= 1){
        opp.y = FLOOR;
        fishSlamHit(opp, f);
        hooks.splice(i,1);
      }
    }
  }
}
function drawHooks(){
  hooks.forEach(h => {
    const f = h.owner;
    const col = specialColor(f.charId);
    const hasRod = f.charId === 'rice' && POSE_META['rice'] && POSE_META['rice']['special'];
    const hx = f.x + f.facing * (hasRod ? 149 : 42), hy = f.y - (hasRod ? 289 : 98);
    ctx.save();
    const sag = (h.phase === 'cast' || h.phase === 'retract') ? 26 : -6;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo((hx + h.x) / 2, Math.min(hy, h.y) + sag, h.x, h.y);
    ctx.stroke();
    const grd = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, 22);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.4, col);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(h.x, h.y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(h.x, h.y + 4, 7, Math.PI * 0.1, Math.PI * 1.1, false);
    ctx.stroke();
    ctx.restore();
  });
}
function updateProjs(dt){
  for (let i = projs.length - 1; i >= 0; i--){
    const p = projs[i];
    p.x += p.vx * dt;
    p.life -= dt;
    p.trail += dt;
    if (p.trail > 0.03){
      p.trail = 0;
      spawnFx(p.x - Math.sign(p.vx) * 40, p.y, { count: 2, colors: [p.col, '#ffffff'], spread: 180, size: 4 });
    }
    const opp = (p.owner === p1) ? p2 : p1;
    const bb = bodyBox(opp);
    const hb = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
    if (opp.state !== 'ko' && rectsOverlap(hb, bb)){
      applyHit(opp, p.owner, 24 * p.owner.dmgMul, 520);
      cameraShake = Math.max(cameraShake, 14);
      timeFreeze = Math.max(timeFreeze, 0.10);
      spawnFx(opp.x, opp.y - 70, { count: 26, colors: [p.col, '#ffffff', '#D8FFFF'], spread: 900, size: 7 });
      projs.splice(i, 1);
      continue;
    }
    if (p.life <= 0 || p.x < -200 || p.x > W + 200) projs.splice(i, 1);
  }
}
function drawProjs(){
  projs.forEach(p => {
    ctx.save();
    const grd = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.w * 0.7);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.35, p.col);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.w * 0.7, p.h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.w * 0.32, p.h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}
function updateSPUI(){
  const s1 = document.getElementById('sp1');
  const s2 = document.getElementById('sp2');
  if (s1 && p1){ s1.style.width = p1.sp + '%'; s1.classList.toggle('full', p1.sp >= 100); }
  if (s2 && p2){ s2.style.width = p2.sp + '%'; s2.classList.toggle('full', p2.sp >= 100); }
  const b = document.getElementById('spBtn');
  if (b && p1) b.classList.toggle('ready', p1.sp >= 100 && running);
}

// ===== Update =====
function updateFighter(dt, f, opp) {
  if (f.state === 'ko') {
    f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.y >= FLOOR) {
      f.y = FLOOR;
      f.vy = 0;
      f.vx *= 0.85;
    }
    f.stateTime += dt;
    if (f.flashTime > 0) f.flashTime -= dt;
    return;
  }

  const inp = readInputs(f, opp);
  const onGround = f.y >= FLOOR - 0.5;
  const busy = f.state === 'punch' || f.state === 'kick' || f.state === 'hit' || f.state === 'special';

  f.blocking = inp.block && onGround && !busy;

  if (onGround && !busy && !f.blocking) {
    if (inp.left) { f.vx = -WALK*f.walkMul; if (f.state !== 'walk') f.state = 'walk'; }
    else if (inp.right) { f.vx = WALK*f.walkMul; if (f.state !== 'walk') f.state = 'walk'; }
    else {
      f.vx = 0;
      if (f.state === 'walk') f.state = 'idle';
    }
    if (inp.up) {
      f.vy = JUMP_V*f.jumpMul;
      f.state = 'jump';
      SFX.jump();
    }
  }
  // 攻撃は地上でも空中でも出せる（ジャンプ攻撃対応）
  const punchEdge = inp.punch && !f.prevPunch;
  const kickEdge = inp.kick && !f.prevKick;
  const spEdge = inp.sp && !f.prevSp;
  if (!busy && !f.blocking) {
    if (spEdge && f.sp >= 100 && onGround) {
      startSpecial(f);
    } else if (punchEdge) {
      f.state = 'punch'; f.stateTime = 0; f.hitDealt = false;
      if (onGround) f.vx = 0;   // 地上は踏み込みで停止／空中はジャンプの勢いを保つ
    } else if (kickEdge) {
      f.state = 'kick'; f.stateTime = 0; f.hitDealt = false;
      if (onGround) f.vx = 0;
    }
  }
  f.prevPunch = inp.punch;
  f.prevKick = inp.kick;
  f.prevSp = inp.sp;

  if (!busy && f.state !== 'jump') {
    f.facing = opp.x > f.x ? 1 : -1;
  }

  f.vy += GRAVITY * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;

  if (f.y >= FLOOR) {
    f.y = FLOOR;
    f.vy = 0;
    if (f.state === 'jump') f.state = 'idle';
  }
  f.x = Math.max(40, Math.min(W - 40, f.x));

  f.stateTime += dt;
  if (f.flashTime > 0) f.flashTime -= dt;

  if (f.state === 'punch') {
    if (!f.hitDealt && f.stateTime > 0.07 && f.stateTime < 0.20) {
      if (hits(attackBox(f, 'punch'), opp)) {
        f.hitDealt = true;
        applyHit(opp, f, 7*f.dmgMul, 240);
      }
    }
    if (f.stateTime > 0.32) f.state = 'idle';
  } else if (f.state === 'kick') {
    if (!f.hitDealt && f.stateTime > 0.16 && f.stateTime < 0.32) {
      if (hits(attackBox(f, 'kick'), opp)) {
        f.hitDealt = true;
        applyHit(opp, f, 13*f.dmgMul, 380);
      }
    }
    if (f.stateTime > 0.5) f.state = 'idle';
  } else if (f.state === 'special') {
    f.vx = 0;
    // 溜め中のオーラ
    if (Math.random() < 0.6) spawnFx(f.x, f.y - 70, { count: 2, colors: [specialColor(f.charId), '#ffffff'], spread: 260, size: 5 });
    if (!f.hitDealt && f.stateTime > 0.26) {
      f.hitDealt = true;
      if (f.specialKind === 'fishing') fireHook(f); else fireSpecial(f);
    }
    if (f.stateTime > 0.55 && !hookFor(f)) f.state = 'idle';
    if (f.stateTime > 2.4) { removeHookFor(f); f.state = 'idle'; }
  } else if (f.state === 'hit') {
    if (f.stateTime > 0.28) f.state = 'idle';
  }
}

function resolveCollision() {
  const dx = p2.x - p1.x;
  const min = 46;
  if (Math.abs(dx) < min && p1.y > FLOOR - 20 && p2.y > FLOOR - 20) {
    const push = (min - Math.abs(dx)) / 2;
    if (dx >= 0) { p1.x -= push; p2.x += push; }
    else { p1.x += push; p2.x -= push; }
    p1.x = Math.max(40, p1.x);
    p2.x = Math.min(W - 40, p2.x);
  }
}

// ===== Draw =====
function drawStage() {
  const bg = BG_IMGS[CUR_BG];
  const conf = BG_CONF[CUR_BG] || {horizon:0.86, ground:'#0a1422'};
  // 画面の実横幅(ワールド座標換算)に合わせて左右に拡張
  const battleNow = document.body.classList.contains('in-battle');
  const scNow = battleNow ? (canvas.height/H) : Math.min(canvas.width/W, canvas.height/H);
  const ext = Math.max(0, (canvas.width/scNow - W)/2);
  if(bg && bg.complete && bg.naturalWidth){
    // 背景は縦横比を保ったまま描画(横伸ばし歪み防止)
    let bw, bh, bx, by;
    if(conf.venue){
      // 会場モード: 1枚絵を中央に等倍配置し、左右は鏡像で観客席をつなぐ(会場のダブりなし)
      const asp = bg.naturalWidth / bg.naturalHeight;
      bh = conf.vh;
      bw = bh * asp;
      bx = (W - bw) / 2;
      by = conf.base - bh * conf.pBase;   // 塀の根元をbaseに固定
      ctx.drawImage(bg, bx, by, bw, bh);
      ctx.save(); ctx.translate(bx, 0); ctx.scale(-1, 1);
      ctx.drawImage(bg, 0, by, bw, bh);   // 左隣(鏡像)
      ctx.restore();
      ctx.save(); ctx.translate(bx + bw, 0); ctx.scale(-1, 1);
      ctx.drawImage(bg, -bw, by, bw, bh); // 右隣(鏡像)
      ctx.restore();
    } else if(conf.anchor){
      // 全景モード: 画像下端を固定し、画面幅もカバーできる最小サイズに
      const visW = W + ext*2;
      const asp = bg.naturalWidth / bg.naturalHeight;
      bh = Math.max(conf.anchor, visW / asp);
      bw = bh * asp;
      bx = (W - bw) / 2;
      by = conf.anchor - bh;
    } else {
      bw = W + ext*2;
      bh = bw * (bg.naturalHeight / bg.naturalWidth);
      bx = -ext;
      by = FLOOR - bh * conf.horizon;          // 地平線をFLOORに合わせる
    }
    ctx.drawImage(bg, bx, by, bw, bh);
    // 地平線より下(地面)を背景の暗色で埋める
    ctx.fillStyle = conf.ground;
    ctx.fillRect(-ext, FLOOR-2, W+ext*2, H-(FLOOR-2));
  } else {
    ctx.fillStyle='#07121e'; ctx.fillRect(0,0,W,H);
  }
  if(STAGE_PLACE==='C'){
    // 武舞台: 石畳の闘技場床。奥行きが出るようファイターの足元が床の中腹に来る配置
    const fl = BUDOKAI_FLOOR_IMG;
    if(fl && fl.complete && fl.naturalWidth){
      const fw = (W + ext*2) * 1.06;
      const fh = fw * (fl.naturalHeight / fl.naturalWidth) * 0.55; // 縦圧縮で会場を隠しすぎない
      const fx = (W - fw) / 2;
      const fy = FLOOR - fh * 0.55;            // 足元は床の中腹に接地
      ctx.drawImage(fl, fx, fy, fw, fh);
    }
  } else {
    // SF土台: 天面をFLOORラインに合わせ、画面幅いっぱいに敷く
    const pf = PLATFORM_IMG;
    if(pf && pf.complete && pf.naturalWidth){
      const pw = (W + ext*2) * 1.06;                       // 画面幅より少し広く(端を切らさない)
      const ph = pw * (pf.naturalHeight / pf.naturalWidth);
      const px = (W - pw) / 2;
      const topInset = ph * 0.18;                // 土台の天面は画像の上から約18%付近
      const py = FLOOR - topInset;               // 天面をFLOORに合わせる
      ctx.drawImage(pf, px, py, pw, ph);
    }
  }
  const grad = ctx.createLinearGradient(0,FLOOR-40,0,H);
  grad.addColorStop(0,'rgba(4,8,13,0)');
  grad.addColorStop(1,'rgba(4,8,13,0.45)');
  ctx.fillStyle=grad; ctx.fillRect(-ext, FLOOR-40, W+ext*2,H-(FLOOR-40));
}

// ===== Color helpers =====
function lightenColor(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,r+70)},${Math.min(255,g+70)},${Math.min(255,b+70)})`;
}
function darkenColor(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,r-55)},${Math.max(0,g-55)},${Math.max(0,b-55)})`;
}

// ===== Anime face =====
function drawAnimeHead(cx, cy, r, opts) {
  const {skin,skinL,skinS,hairColor,hairD,eyeColor,hairStyle,state}=opts;
  const OL='#16001e';
  function ol(c=OL,w=1.5){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();}

  // Back hair volume
  if(hairStyle==='ponytail'){
    ctx.fillStyle=hairD; ctx.beginPath(); ctx.ellipse(cx-r*0.5,cy-r*0.08,r*0.46,r*0.72,-0.22,0,Math.PI*2); ctx.fill(); ol(OL,1);
    ctx.fillStyle=hairColor; ctx.beginPath(); ctx.arc(cx+r*0.05,cy-r*0.72,r*0.56,0,Math.PI*2); ctx.fill(); ol(OL,1.5);
  } else {
    ctx.fillStyle=hairD; ctx.beginPath(); ctx.arc(cx,cy-r*0.72,r*0.64,0,Math.PI*2); ctx.fill(); ol(OL,1.5);
  }

  // Face oval
  ctx.fillStyle=skin;
  ctx.beginPath(); ctx.ellipse(cx+r*0.06,cy,r*0.86,r*0.97,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx-r*0.65,cy+r*0.28);
  ctx.bezierCurveTo(cx-r*0.45,cy+r*1.22,cx+r*0.1,cy+r*1.3,cx+r*0.1,cy+r*1.3);
  ctx.bezierCurveTo(cx+r*0.45,cy+r*1.22,cx+r*0.7,cy+r*0.28,cx+r*0.7,cy+r*0.28);
  ctx.fill(); ol(OL,1.5);
  // Ear
  ctx.fillStyle=skin; ctx.beginPath(); ctx.ellipse(cx+r*0.87,cy+r*0.1,r*0.17,r*0.26,0.1,0,Math.PI*2); ctx.fill(); ol(OL,1);
  // Face gradient shading
  const fg=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
  fg.addColorStop(0,skinS); fg.addColorStop(0.35,skin); fg.addColorStop(0.7,skinL); fg.addColorStop(1,skinS);
  ctx.fillStyle=fg; ctx.globalAlpha=0.35;
  ctx.beginPath(); ctx.ellipse(cx+r*0.06,cy,r*0.84,r*0.95,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;

  // Eye positions
  const eyeY=cy-r*0.08;
  const feX=cx+r*0.35, beX=cx-r*0.2;
  const eW=r*0.45, eH=r*0.32, beW=r*0.28, beH=r*0.22;
  const browY=eyeY-eH-r*0.1;

  // Eyebrows
  ctx.strokeStyle=hairD; ctx.lineWidth=2.2; ctx.lineCap='round';
  if(state==='hit'||state==='ko'){
    ctx.beginPath(); ctx.moveTo(feX-eW*0.55,browY+3); ctx.quadraticCurveTo(feX,browY-1,feX+eW*0.55,browY+3); ctx.stroke();
  } else if(state==='punch'||state==='kick'){
    ctx.beginPath(); ctx.moveTo(feX-eW*0.55,browY-2); ctx.quadraticCurveTo(feX,browY+3,feX+eW*0.55,browY); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(feX-eW*0.55,browY); ctx.quadraticCurveTo(feX,browY-4,feX+eW*0.55,browY); ctx.stroke();
  }
  ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(beX-4,browY+2); ctx.quadraticCurveTo(beX+4,browY-2,beX+9,browY+2); ctx.stroke();

  if(state==='ko'){
    ctx.strokeStyle='#444'; ctx.lineWidth=2.5;
    [[feX,eyeY],[beX,eyeY]].forEach(([ex,ey])=>{
      ctx.beginPath(); ctx.moveTo(ex-6,ey-5); ctx.lineTo(ex+6,ey+5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex+6,ey-5); ctx.lineTo(ex-6,ey+5); ctx.stroke();
    });
  } else {
    // Back eye
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(beX,eyeY,beW,beH,0,0,Math.PI*2); ctx.fill(); ol(OL,0.8);
    ctx.fillStyle=eyeColor; ctx.beginPath(); ctx.ellipse(beX,eyeY,beW*0.65,beH*0.8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.ellipse(beX,eyeY,beW*0.38,beH*0.65,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(beX-2,eyeY-2,beW*0.14,beH*0.2,0,0,Math.PI*2); ctx.fill();
    // Front eye
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(feX,eyeY,eW,eH,0,0,Math.PI*2); ctx.fill(); ol(OL,1.2);
    if(state==='hit'){
      ctx.fillStyle='#ffe8d8'; ctx.beginPath(); ctx.ellipse(feX,eyeY+2,eW,eH*0.45,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(feX-eW,eyeY); ctx.quadraticCurveTo(feX,eyeY-4,feX+eW,eyeY); ctx.stroke();
    } else {
      const ig=ctx.createRadialGradient(feX-r*0.05,eyeY-eH*0.2,0,feX,eyeY,eW*0.65);
      ig.addColorStop(0,lightenColor(eyeColor)); ig.addColorStop(0.55,eyeColor); ig.addColorStop(1,darkenColor(eyeColor));
      ctx.fillStyle=ig; ctx.beginPath(); ctx.ellipse(feX,eyeY,eW*0.65,eH*0.82,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#0a0015'; ctx.beginPath(); ctx.ellipse(feX,eyeY+eH*0.05,eW*0.22,eH*0.58,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.ellipse(feX-eW*0.2,eyeY-eH*0.25,eW*0.14,eH*0.22,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(feX+eW*0.2,eyeY+eH*0.15,eW*0.07,eH*0.1,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.ellipse(feX,eyeY,eW,eH,0,Math.PI+0.15,Math.PI*2-0.15); ctx.stroke();
      ctx.lineWidth=1.8;
      for(let i=0;i<4;i++){
        const a=Math.PI+0.25+i*0.4;
        ctx.beginPath(); ctx.moveTo(feX+Math.cos(a)*eW*1.02,eyeY+Math.sin(a)*eH);
        ctx.lineTo(feX+Math.cos(a)*eW*1.5,eyeY+Math.sin(a)*eH*1.5); ctx.stroke();
      }
    }
  }

  // Nose
  ctx.fillStyle=skinS; ctx.beginPath(); ctx.ellipse(cx+r*0.2,cy+r*0.38,r*0.07,r*0.05,0,0,Math.PI*2); ctx.fill();
  // Mouth
  ctx.strokeStyle='#c05070'; ctx.lineCap='round'; ctx.lineWidth=2;
  const mx=cx+r*0.12,my=cy+r*0.66;
  if(state==='punch'||state==='kick'){
    ctx.fillStyle='#6a0020'; ctx.beginPath(); ctx.ellipse(mx,my,r*0.18,r*0.12,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.fillRect(mx-r*0.12,my-r*0.06,r*0.24,r*0.07);
  } else if(state==='hit'){
    ctx.beginPath(); ctx.moveTo(mx-r*0.18,my); ctx.quadraticCurveTo(mx,my+r*0.1,mx+r*0.18,my); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(mx-r*0.16,my-r*0.02); ctx.quadraticCurveTo(mx,my+r*0.1,mx+r*0.16,my-r*0.02); ctx.stroke();
  }
  // Blush
  if(state!=='ko'&&state!=='hit'){
    ctx.globalAlpha=0.3; ctx.fillStyle='#ff7799';
    ctx.beginPath(); ctx.ellipse(feX+r*0.1,cy+r*0.26,r*0.28,r*0.12,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx-r*0.28,cy+r*0.26,r*0.2,r*0.1,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  // Front hair
  if(hairStyle==='ponytail'){
    ctx.fillStyle=hairColor;
    ctx.beginPath();
    ctx.moveTo(cx-r*0.9,cy-r*0.35);
    ctx.bezierCurveTo(cx-r*0.85,cy-r*1.58,cx+r*0.55,cy-r*1.62,cx+r*0.9,cy-r*0.55);
    ctx.bezierCurveTo(cx+r*0.88,cy-r*0.28,cx+r*0.62,cy-r*0.08,cx+r*0.52,cy-r*0.22);
    ctx.bezierCurveTo(cx+r*0.2,cy-r*0.45,cx-r*0.05,cy-r*0.5,cx-r*0.9,cy-r*0.35);
    ctx.fill(); ol(OL,1.5);
    ctx.fillStyle=hairD;
    ctx.beginPath();
    ctx.moveTo(cx-r*0.9,cy-r*0.35);
    ctx.bezierCurveTo(cx-r*1.08,cy,cx-r*0.88,cy+r*0.5,cx-r*0.68,cy+r*0.58);
    ctx.bezierCurveTo(cx-r*0.5,cy+r*0.6,cx-r*0.38,cy+r*0.42,cx-r*0.48,cy+r*0.1);
    ctx.bezierCurveTo(cx-r*0.6,cy-r*0.1,cx-r*0.72,cy-r*0.28,cx-r*0.9,cy-r*0.35);
    ctx.fill(); ol(OL,1);
    ctx.fillStyle=hairColor; ctx.beginPath(); ctx.arc(cx,cy-r*0.98,r*0.4,0,Math.PI*2); ctx.fill(); ol(OL,1.5);
    ctx.strokeStyle='#ff44aa'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(cx,cy-r*0.98,r*0.44,-0.7,0.7); ctx.stroke();
    ctx.fillStyle='#ffffff99'; ctx.beginPath(); ctx.ellipse(cx+r*0.15,cy-r,r*0.2,r*0.12,-0.5,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle=hairColor;
    ctx.beginPath();
    ctx.moveTo(cx-r*0.95,cy-r*0.28);
    ctx.bezierCurveTo(cx-r*0.9,cy-r*1.58,cx+r*0.62,cy-r*1.62,cx+r*0.92,cy-r*0.5);
    ctx.bezierCurveTo(cx+r*0.9,cy-r*0.22,cx+r*0.62,cy,cx+r*0.52,cy-r*0.08);
    ctx.bezierCurveTo(cx+r*0.25,cy-r*0.22,cx-r*0.3,cy-r*0.28,cx-r*0.95,cy-r*0.28);
    ctx.fill(); ol(OL,1.5);
    ctx.strokeStyle=hairD; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(cx,cy-r*0.92); ctx.lineTo(cx+r*0.3,cy-r*0.2); ctx.stroke();
    ctx.fillStyle='#6666cc88'; ctx.beginPath(); ctx.ellipse(cx+r*0.2,cy-r*0.92,r*0.22,r*0.12,-0.4,0,Math.PI*2); ctx.fill();
  }
}

// ===== HANA — ビキニファイター =====
function drawShadow(f) {
  const h=Math.max(0,FLOOR-f.y);
  const scale=1-Math.min(0.65,h/260);
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(f.x,FLOOR+4,28*scale,6*scale,0,0,Math.PI*2); ctx.fill();
}

function drawFighter(f) {
  const t=f.stateTime, st=f.state;
  // 接地影: ジャンプ中は小さく薄く
  {
    const airH = Math.max(0, FLOOR - f.y);
    const k = Math.max(0.25, 1 - airH/280);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${(0.38*k).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(f.x, FLOOR + 6, 60*k, 10*k, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);

  if(f.flashTime>0){ ctx.shadowColor='#fff'; ctx.shadowBlur=24; }

  if(hasPoses(poseCharId(f))){
    // ===== ポーズ画像方式（手足が動く） =====
    drawPosed(f, st, t);
  } else {
    // ===== 1枚絵フォールバック =====
    drawSingleImg(f, st, t);
  }
  ctx.restore();
  ctx.shadowBlur=0;
}

function drawPosed(f, st, t){
  const cid=poseCharId(f);
  let pose = poseNameFor(st, cid);
  if(st==='hit') pose='idle';
  if(st==='special') pose = POSE_META[cid]['special'] ? 'special' : 'punch';
  const im = POSE_IMGS[cid][pose] || POSE_IMGS[cid]['idle'];
  const meta = POSE_META[cid][pose] || POSE_META[cid]['idle'];
  const idleMeta = POSE_META[cid]['idle'];
  if(!im || !im.complete) return;


  // ガード中で guard 画像を持つキャラは guard ポーズを表示
  let im2=im, meta2=meta;
  if(f.blocking && st!=='ko' && st!=='hit' && POSE_IMGS[cid]['guard']){
    im2=POSE_IMGS[cid]['guard']; meta2=POSE_META[cid]['guard'];
  }
  // 歩きは walk と idle を時間で交互に出して二足歩行に見せる
  else if(st==='walk' && POSE_IMGS[cid]['walk']){
    if(Math.floor(Date.now()/170)%2===0){ im2=POSE_IMGS[cid]['walk']; meta2=POSE_META[cid]['walk']; }
    else { im2=POSE_IMGS[cid]['idle']; meta2=POSE_META[cid]['idle']; }
  }
  let px = (FIGHTER_H / idleMeta.bodyH) * (meta2.scaleAdj||1);
  // ガード画像は idle と体の高さ(bodyH)が違うと縮んで見えるので比率で補正
  if(f.blocking && meta2===POSE_META[cid]['guard'] && meta2.bodyH){
    px *= idleMeta.bodyH / meta2.bodyH;
  }
  const drawHfinal = meta2.cropH * px;
  const drawW2 = meta2.cropW * px;
  let ox = -meta2.footX*drawW2;
  let oy = -meta2.footY*drawHfinal + 3;  // 接地補正: 足裏を床に密着

  let lunge=0, bob=0, lean=0;
  if(st==='walk'){ bob = Math.abs(Math.sin(Date.now()*0.012))*-3; }
  else if(st==='idle'){ bob = Math.abs(Math.sin(Date.now()*0.004))*2; }  // 下方向のみ
  else if(st==='punch'){ const p=t<0.1?t/0.1:Math.max(0,1-(t-0.1)/0.22); lunge=p*14; }
  else if(st==='kick'){ const p=t<0.16?t/0.16:Math.max(0,1-(t-0.16)/0.34); lunge=p*16; }
  else if(st==='hit'){ lean=-0.18*Math.max(0,1-t/0.28); lunge=-8*Math.max(0,1-t/0.28); }
    const koAng = st==='ko'? Math.min(0.2, t*0.5) : 0;

  ctx.save();
  ctx.translate(lunge, bob);
  if(lean) ctx.rotate(lean);
  ctx.drawImage(im2, ox, oy, drawW2, drawHfinal);
  ctx.restore();

}

function drawSingleImg(f, st, t){
  const img = IMGS[f.charId];
  let lean=0, lunge=0, bobY=0;
  if(st==='idle'){ bobY=Math.sin(Date.now()*0.004)*3; }
  else if(st==='walk'){ bobY=Math.abs(Math.sin(t*12))*-4; lean=Math.sin(t*12)*0.05; }
  else if(st==='jump'){ lean=-0.08; }
  else if(st==='punch'){ const p=t<0.1?t/0.1:Math.max(0,1-(t-0.1)/0.22); lunge=p*26; lean=p*0.18; }
  else if(st==='kick'){ const p=t<0.16?t/0.16:Math.max(0,1-(t-0.16)/0.34); lunge=p*30; lean=-p*0.14; }
  else if(st==='hit'){ lean=-0.22*Math.max(0,1-t/0.28); lunge=-10*Math.max(0,1-t/0.28); }
  const koAng = st==='ko'? Math.min(Math.PI*0.5, t*2.4):0;
  ctx.save();
  ctx.translate(lunge,bobY);
  ctx.rotate(-lean-(st==='ko'?koAng:0));
  const S=Math.round(FIGHTER_H*0.81); // フォールバック描画も同比率で縮小
  if(img && img.complete){
    ctx.save();
    roundRectPath(ctx,-S/2,-S+6,S,S,14); ctx.clip();
    ctx.drawImage(img,-S/2,-S+6,S,S);
    ctx.restore();
    ctx.lineWidth=3; ctx.strokeStyle=f.isPlayer?'#ff2a2a':'#ffb020';
    ctx.shadowColor=ctx.strokeStyle; ctx.shadowBlur=f.flashTime>0?30:10;
    roundRectPath(ctx,-S/2,-S+6,S,S,14); ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.restore();
}

function roundRectPath(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r); c.closePath();
}

function drawFx() {
  for (const p of fx) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) fx.splice(i, 1);
  }
}

// ===== Round end logic =====
function checkRoundEnd() {
  if (roundEnding || !running) return;
  if (p1.hp <= 0 || p2.hp <= 0 || timer <= 0) {
    roundEnding = true;
    running = false;
    let winnerIdx = -1;
    if (p1.hp > p2.hp) winnerIdx = 0;
    else if (p2.hp > p1.hp) winnerIdx = 1;
    if (winnerIdx >= 0) wins[winnerIdx]++;
    updateWinPips();

    setTimeout(() => {
      if (timer <= 0 && p1.hp > 0 && p2.hp > 0) shout('TIME UP', 1400);
      else shout('K.O.!', 1400);

      setTimeout(() => {
        if (wins[0] >= 2) endMatch(true);
        else if (wins[1] >= 2) endMatch(false);
        else { round++; startRound(); }
      }, 1600);
    }, 700);
  }
}

// ===== Main loop =====
function loop(t) {
  const rawDt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
  lastT = t;
  let dt = rawDt;
  if (timeFreeze > 0) {
    timeFreeze -= rawDt;
    dt = 0;
  }

  if (running && p1 && p2) {
    updateFighter(dt, p1, p2);
    updateFighter(dt, p2, p1);
    updateProjs(dt);
    updateHooks(dt);
    resolveCollision();
    timer -= dt;
    if (timer < 0) timer = 0;
    document.getElementById('timer').textContent = Math.ceil(timer);
    updateHpBar(1, p1.hp, p1.maxHp);
    updateHpBar(2, p2.hp, p2.maxHp);
    checkRoundEnd();
  } else if (p1 && p2 && roundEnding) {
    hooks.length = 0;
    // keep physics rolling on KO
    updateFighter(rawDt, p1, p2);
    updateFighter(rawDt, p2, p1);
    resolveCollision();
  }

  updateFx(rawDt);
  updateSPUI();
  if (cameraShake > 0) cameraShake -= rawDt * 40;

  // === Render ===
  const dpr = window.devicePixelRatio || 1;
  // アスペクト比を保つ。バトル中(in-battle)は画面いっぱいにcover、それ以外はfitで全体表示。
  const battle = document.body.classList.contains('in-battle');
  const ratioX = canvas.width / W, ratioY = canvas.height / H;
  const scale = battle ? ratioY : Math.min(ratioX, ratioY); // バトル=高さフィット
  const drawW = W * scale, drawH = H * scale;
  const offX = (canvas.width  - drawW) / 2;
  const offY = (canvas.height - drawH) / 2;
  const sx = scale, sy = scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if(offX > 0.5 || offY > 0.5){ ctx.fillStyle = '#04080d'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  const shakeX = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake * sx : 0;
  const shakeY = cameraShake > 0 ? (Math.random() - 0.5) * cameraShake * sy : 0;
  ctx.setTransform(sx, 0, 0, sy, offX + shakeX, offY + shakeY);

  drawStage();
  if (p1 && p2) {
    drawShadow(p1);
    drawShadow(p2);
    // Draw nearer fighter on top
    const order = p1.y >= p2.y ? [p2, p1] : [p1, p2];
    drawFighter(order[0]);
    drawFighter(order[1]);
  }
  drawHooks();
  drawProjs();
  drawFx();

  // scanlines overlay
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;

  requestAnimationFrame(loop);
}

resize();
requestAnimationFrame(loop);

// ===== スタジオロゴ スプラッシュ：ボタンを押すまで表示。押下で音声解禁＋BGM開始 =====
(function(){
  const splash=document.getElementById('splash');
  if(!splash) return;
  const btn=document.getElementById('splashStartBtn');
  let done=false;
  const start=(e)=>{
    if(e){ e.preventDefault(); e.stopPropagation(); }
    if(done) return; done=true;
    SFX.init();                 // この能動タップで音声解禁(iPhone対策)
    // タイトルのPRESS STARTを一時的に無効化（貫通タップ防止）
    if(typeof window!=='undefined') window.__titleTapLock = true;
    splash.classList.add('hide');
    setTimeout(()=>splash.classList.add('gone'), 520); // フェードアウト後に非表示
    // 設定はタイトル画面のボタンから開く(フロート⚙️は廃止)
    // タイトルが見えるのでBGM＆風を開始
    const ov=document.getElementById('overlay');
    if(ov && ov.classList.contains('title-screen') && !ov.classList.contains('hidden')){
      SFX.startTitleBGM();
      SFX.startWind();
    }
    // 600ms後にタイトルのタップを解禁（指を離した後の貫通を防ぐ）
    setTimeout(()=>{ window.__titleTapLock = false; }, 600);
  };
  // click（指を離した時）で発火＝pointerdownの貫通を防ぐ
  if(btn){ btn.addEventListener('click', start); }
})();

// ===== 横向き固定: 縦持ちなら回転案内を表示 =====
document.body.classList.add('lock-landscape');

// ===== BGMフェイルセーフ: 最初のユーザー操作で必ず音声を起こす =====
(function(){
  function wake(){
    if(!SFX.on) return;
    SFX.init();
    const ov=document.getElementById('overlay');
    const sel=document.getElementById('selOverlay');
    const onTitle = ov && ov.classList.contains('title-screen') && !ov.classList.contains('hidden');
    const onLobby = sel && !sel.classList.contains('hidden');
    if(onTitle){
      const a=document.getElementById('titleBgm');
      if(a && a.paused){ SFX.startTitleBGM(); SFX.startWind(); }
    } else if(onLobby){
      const lb=document.getElementById('lobbyBgm');
      if(lb && lb.paused){ SFX.startLobbyBGM(); }
    }
  }
  document.addEventListener('pointerdown', wake, {capture:true});
  document.addEventListener('touchstart', wake, {capture:true, passive:true});
  document.addEventListener('click', wake, {capture:true});
})();
