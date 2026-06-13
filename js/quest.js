// ============================================================
//  ReD QUEST : ワープゲート・ラッシュ
//  横スクロールアクション(完走型) / 全4ステージ
//  - 敵=踏んで倒す / 落とし穴=即ミス / ReDコイン収集 / 残機3
//  - クリアでタイム+コインのランク評価(S/A/B/C)
//  既存の格闘ゲーム資産(POSE_IMGS等)を window.RA 経由で流用
// ============================================================
(function(){
  'use strict';

  // ---- ステージ定義(遠景+地面の2枚パララックス) ----
  const STAGES = [
    { key:'st1', name:'ネオンシティ',   bg:'assets/quest/st1_bg.webp', ground:'assets/quest/st1_ground.webp', sky:'#0a1830', accent:'#37d0ff' },
    { key:'st2', name:'フローティング',  bg:'assets/quest/st2_bg.webp', ground:'assets/quest/st2_ground.webp', sky:'#3a7bd5', accent:'#bfffce' },
    { key:'st3', name:'スペースコロニー', bg:'assets/quest/st3_bg.webp', ground:'assets/quest/st3_ground.webp', sky:'#0b1228', accent:'#9ec7ff' },
    { key:'st4', name:'トーキョー',      bg:'assets/quest/st4_bg.webp', ground:'assets/quest/st4_ground.webp', sky:'#5fb6ff', accent:'#ff5b6e' },
  ];

  // ---- 画像プリロード ----
  const IMG = {};
  function loadImg(src){ if(IMG[src]) return IMG[src]; const i=new Image(); i.src=src; IMG[src]=i; return i; }
  STAGES.forEach(s=>{ loadImg(s.bg); loadImg(s.ground); });

  // ---- 状態 ----
  let RA=null;                 // window.RA(game.js公開部品)
  let cv, cx;                  // 専用canvas / context
  let raf=null, running=false;
  let stageIdx=0, charId='J';
  let lives=3, coinsTotal=0, coinsRun=0, elapsed=0;
  let cam=0;                   // カメラX(ワールド座標)
  let stageLen=0;             // ステージ全長(px)
  let player=null;
  let enemies=[], coins=[], pits=[], gate=null;
  let lastT=0;
  let groundTopY=0;           // 地面の上端Y(canvas座標)
  let stageState='play';      // play | clear | dead | done
  let msgT=0, msg='';
  let keys={left:false,right:false,jump:false};

  // ワールド定数(専用キャンバスに合わせる)
  let VW=900, VH=460;          // 仮想解像度(描画はこの座標で行いcanvasにスケール)
  const GRAV=2100, MOVE=300, JUMP_V=820;

  // ---- ステージ生成(プロシージャル・難易度漸増) ----
  function buildStage(idx){
    const seedBase=(idx+1)*1000;
    function rnd(n){ // 簡易決定論乱数
      let x=Math.sin(seedBase+n*12.9898)*43758.5453; return x-Math.floor(x);
    }
    const segCount = 14 + idx*3;          // セグメント数(ステージが進むほど長い)
    const seg = 360;                       // 1セグメント幅
    stageLen = segCount*seg + 600;
    enemies=[]; coins=[]; pits=[];

    for(let i=2;i<segCount;i++){
      const x = i*seg;
      const r = rnd(i);
      // 落とし穴(後半ステージほど増)
      if(r < 0.16 + idx*0.04 && i<segCount-2){
        pits.push({ x:x, w: 90 + Math.floor(rnd(i+99)*70) });
      } else {
        // 敵(踏んで倒す)
        if(r > 0.55){
          const patrol = 60 + Math.floor(rnd(i+7)*80);
          enemies.push({ x:x, y:0, w:46, h:46, dir:1, x0:x-patrol, x1:x+patrol, alive:true, t:rnd(i)*6, sp: 50+idx*18 });
        }
        // コイン(山なり配置)
        const cn = 3 + Math.floor(rnd(i+3)*3);
        for(let k=0;k<cn;k++){
          const cxp = x + (k-cn/2)*46;
          const arc = Math.sin((k/(cn-1))*Math.PI)* (i%3===0? 120: 40);
          coins.push({ x:cxp, y: 150 - arc, got:false });
        }
      }
    }
    // ゴール=ワープゲート
    gate={ x: stageLen-360, w:150, h:230, t:0 };
  }

  function resetPlayer(){
    player={ x:140, y:0, vx:0, vy:0, w:70, h: (RA?RA.FIGHTER_H:235)*0.55, onGround:true, face:1, state:'idle', stT:0, hurtT:0 };
  }

  // ---- 開始 ----
  function start(selChar){
    RA = window.RA;
    charId = selChar || 'J';
    stageIdx=0; lives=3; coinsTotal=0; elapsed=0;
    setupCanvas();
    enterStage(0);
    show();
    running=true; lastT=0;
    if(!raf) raf=requestAnimationFrame(loop);
  }
  function enterStage(idx){
    stageIdx=idx; coinsRun=0; cam=0; elapsed=0; stageState='play';
    buildStage(idx); resetPlayer();
    setMsg(STAGES[idx].name, 1.4);
  }
  function setMsg(t,dur){ msg=t; msgT=dur; }

  // ---- canvas ----
  function setupCanvas(){
    cv=document.getElementById('questCanvas');
    cx=cv.getContext('2d');
    fitCanvas();
  }
  function fitCanvas(){
    if(!cv) return;
    const dpr=Math.min(2, window.devicePixelRatio||1);
    const w=window.innerWidth, h=window.innerHeight;
    cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
    cv.style.width=w+'px'; cv.style.height=h+'px';
    // 仮想解像度→実ピクセルのスケール(高さ基準でcoverに近い形)
    VH=460; VW=VH*(w/h);
    cx.setTransform(cv.width/VW,0,0,cv.height/VH,0,0);
    groundTopY = VH*0.72;
  }
  window.addEventListener('resize', ()=>{ if(running) fitCanvas(); });

  // ---- メインループ ----
  function loop(t){
    raf=requestAnimationFrame(loop);
    if(!running){ return; }
    const dt = lastT? Math.min(0.05,(t-lastT)/1000):0; lastT=t;
    if(stageState==='play'){ update(dt); }
    if(msgT>0) msgT-=dt;
    render();
  }

  function update(dt){
    elapsed+=dt;
    const p=player;

    // 入力→横移動
    let ax=0;
    if(keys.left){ ax-=1; p.face=-1; }
    if(keys.right){ ax+=1; p.face=1; }
    p.vx = ax*MOVE;
    p.x += p.vx*dt;
    if(p.x<60) p.x=60;

    // ジャンプ
    if(keys.jump && p.onGround){ p.vy=-JUMP_V; p.onGround=false; if(RA&&RA.SFX&&RA.SFX.jump) try{RA.SFX.jump();}catch(e){} }
    p.vy += GRAV*dt; p.y += p.vy*dt;

    // 落とし穴判定: プレイヤー足元が穴の上か
    let overPit=false;
    for(const pit of pits){ if(p.x> pit.x && p.x< pit.x+pit.w){ overPit=true; break; } }

    // 接地(穴の上では着地しない=落下)
    const footY=0; // y=0が地面ライン
    if(!overPit){
      if(p.y>=footY){ p.y=footY; p.vy=0; p.onGround=true; }
      else p.onGround=false;
    } else {
      p.onGround=false;
      if(p.y> 220){ die('落下！'); return; } // 穴に落ちた
    }

    // 状態(描画ポーズ用)
    if(!p.onGround) p.state='jump';
    else if(Math.abs(p.vx)>10) p.state='walk';
    else p.state='idle';

    // カメラ追従
    const targetCam = Math.max(0, Math.min(stageLen-VW, p.x - VW*0.35));
    cam += (targetCam-cam)*Math.min(1, dt*8);

    // 敵更新+踏みつけ判定
    const pBottom=p.y; // 足
    const pTop=p.y - p.h;
    for(const e of enemies){
      if(!e.alive) continue;
      e.t+=dt;
      e.x += e.dir*e.sp*dt;
      if(e.x<e.x0){ e.x=e.x0; e.dir=1; } if(e.x>e.x1){ e.x=e.x1; e.dir=-1; }
      // 当たり(AABB・ワールド座標)
      const ex=e.x, ey=0; // 敵は地面上
      const hit = Math.abs(p.x - ex) < (p.w*0.4 + e.w*0.5) && pBottom > ey - e.h && pTop < ey;
      if(hit){
        if(p.vy>0 && pBottom < ey - e.h*0.4){
          // 上から踏んだ→撃破
          e.alive=false; p.vy=-JUMP_V*0.6;
          coinsRun+=2;
          if(RA&&RA.SFX&&RA.SFX.punch) try{RA.SFX.punch();}catch(e2){}
        } else if(p.hurtT<=0){
          die('やられた！'); return;
        }
      }
    }
    if(p.hurtT>0) p.hurtT-=dt;

    // コイン収集(横+縦の距離で判定)
    for(const c of coins){
      if(c.got) continue;
      const dx = p.x - c.x;
      if(Math.abs(dx) > 42) continue;
      // コインの画面y(描画と同じ式) と プレイヤー中心の画面y を比較
      const coinScrY = groundTopY - 60 - c.y*0.5;
      const playerScrY = groundTopY - 4 + p.y - p.h*0.5;
      if(Math.abs(coinScrY - playerScrY) < 70){
        c.got=true; coinsRun++;
        if(RA&&RA.SFX&&RA.SFX.tone) try{RA.SFX.tone(1200,0.08,'square',0.2,1800);}catch(e){}
      }
    }

    // ゴール(ワープゲート)
    if(gate && p.x > gate.x+10){ clearStage(); }
  }

  function die(reason){
    lives--; setMsg(reason, 1.2);
    if(RA&&RA.SFX&&RA.SFX.ko) try{RA.SFX.ko();}catch(e){}
    if(lives<=0){ stageState='dead'; setMsg('GAME OVER', 9); showResult(false); }
    else { stageState='play'; resetPlayer(); }
  }
  function clearStage(){
    coinsTotal+=coinsRun;
    stageState='clear';
    if(stageIdx< STAGES.length-1){
      setMsg('STAGE CLEAR!', 1.6);
      setTimeout(()=>{ if(running) enterStage(stageIdx+1); }, 1500);
    } else {
      stageState='done'; showResult(true);
    }
  }

  // ---- 描画 ----
  function render(){
    if(!cx) return;
    const st=STAGES[stageIdx];
    // 空
    cx.fillStyle=st.sky; cx.fillRect(0,0,VW,VH);

    // 遠景(パララックス0.4)
    const bg=IMG[st.bg];
    if(bg&&bg.complete){
      const bh=VH*0.62, bw=bh*(bg.width/bg.height);
      const off=-(cam*0.4)% bw;
      for(let x=off-bw; x<VW+bw; x+=bw){ cx.drawImage(bg, x, VH*0.06, bw, bh); }
    }

    // 地面(パララックス1.0)
    const gnd=IMG[st.ground];
    const gy=groundTopY;
    if(gnd&&gnd.complete){
      const gh=VH-gy+30, gw=gh*(gnd.width/gnd.height);
      const off=-(cam)% gw;
      for(let x=off-gw; x<VW+gw; x+=gw){ cx.drawImage(gnd, x, gy, gw, gh); }
    } else { cx.fillStyle='#222'; cx.fillRect(0,gy,VW,VH-gy); }

    // 落とし穴(地面を黒く欠く)
    cx.fillStyle=st.sky;
    for(const pit of pits){ const sx=pit.x-cam; if(sx>-200&&sx<VW+200){ cx.fillRect(sx, gy, pit.w, VH-gy+30); } }

    // コイン
    for(const c of coins){ if(c.got) continue; const sx=c.x-cam; if(sx<-30||sx>VW+30) continue;
      const cyp= gy - 60 - c.y*0.5 + Math.sin((performance.now()/300)+c.x)*4;
      drawCoin(sx, cyp);
    }

    // 敵
    for(const e of enemies){ if(!e.alive) continue; const sx=e.x-cam; if(sx<-80||sx>VW+80) continue;
      drawEnemy(sx, gy, e);
    }

    // ワープゲート
    if(gate){ const sx=gate.x-cam; if(sx>-260&&sx<VW+260) drawGate(sx, gy, st.accent); }

    // プレイヤー
    drawPlayer(gy);

    // HUD
    drawHUD(st);

    // 中央メッセージ
    if(msgT>0 && msg){
      cx.save();
      cx.globalAlpha=Math.min(1,msgT*1.5);
      cx.fillStyle='#fff'; cx.font='bold 44px Orbitron, sans-serif'; cx.textAlign='center';
      cx.shadowColor=st.accent; cx.shadowBlur=20;
      cx.fillText(msg, VW/2, VH*0.42);
      cx.restore();
    }
  }

  function drawCoin(x,y){
    cx.save(); cx.translate(x,y);
    const w=Math.abs(Math.cos(performance.now()/200))*14+4;
    cx.fillStyle='#ffd23c'; cx.strokeStyle='#b8860b'; cx.lineWidth=2;
    cx.beginPath(); cx.ellipse(0,0,w,16,0,0,Math.PI*2); cx.fill(); cx.stroke();
    cx.fillStyle='#fff6c8'; cx.font='bold 14px sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
    if(w>9) cx.fillText('R',0,1);
    cx.restore();
  }
  function drawEnemy(x,gy,e){
    cx.save(); cx.translate(x, gy-2);
    // ドローン風の敵(コード描画・新素材不要)
    const bob=Math.sin(e.t*6)*4;
    cx.translate(0,bob);
    cx.fillStyle='#1a2740'; cx.strokeStyle='#ff4060'; cx.lineWidth=3;
    cx.beginPath(); cx.moveTo(-e.w/2,0); cx.lineTo(0,-e.h); cx.lineTo(e.w/2,0); cx.closePath();
    cx.fill(); cx.stroke();
    cx.fillStyle='#ff4060'; cx.beginPath(); cx.arc(0,-e.h*0.55,7,0,Math.PI*2); cx.fill();
    cx.fillStyle='#ffd0d8'; cx.beginPath(); cx.arc(0,-e.h*0.55,3,0,Math.PI*2); cx.fill();
    cx.restore();
  }
  function drawGate(x,gy,accent){
    cx.save(); cx.translate(x, gy);
    const t=performance.now()/400;
    // 渦巻くワープゲート
    for(let i=4;i>=0;i--){
      cx.beginPath();
      cx.ellipse(0,-110, 55-i*8, 110-i*16, 0, 0, Math.PI*2);
      cx.strokeStyle = i%2? accent : '#ffffff';
      cx.globalAlpha = 0.35+0.5*Math.abs(Math.sin(t+i));
      cx.lineWidth=5; cx.stroke();
    }
    cx.globalAlpha=1;
    cx.fillStyle='#fff'; cx.font='bold 20px Orbitron, sans-serif'; cx.textAlign='center';
    cx.fillText('WARP', 0, -200);
    cx.restore();
  }

  function drawPlayer(gy){
    const p=player; if(!p) return;
    const sx = p.x - cam;
    const ix = sx, iy = gy - 4 + p.y; // p.y(0が地面)を加味
    cx.save();
    cx.translate(ix, iy);
    cx.scale(p.face,1);
    // POSE_IMGS流用
    let drew=false;
    if(RA && RA.POSE_IMGS){
      let cid=charId;
      if(cid==='arya' && RA.POSE_IMGS['arya_skirt'] ) { /* ショーツ既定 */ }
      const poses=RA.POSE_IMGS[cid], meta=RA.POSE_META[cid];
      if(poses && meta){
        let pose = (RA.poseNameFor? RA.poseNameFor(p.state, cid) : 'idle');
        const im=poses[pose]||poses['idle']; const m=meta[pose]||meta['idle'];
        const idleMeta=meta['idle'];
        if(im && im.complete && idleMeta){
          const FH=(RA.FIGHTER_H||235)*0.62;
          let px=(FH/idleMeta.bodyH)*(m.scaleAdj||1);
          const dw=m.cropW*px, dh=m.cropH*px;
          const ox=-m.footX*dw, oy=-m.footY*dh;
          cx.drawImage(im, ox, oy, dw, dh); drew=true;
        }
      }
    }
    if(!drew){ // フォールバック
      cx.fillStyle='#37d0ff'; cx.fillRect(-22,-90,44,90);
    }
    cx.restore();
  }

  function drawHUD(st){
    cx.save();
    cx.textAlign='left'; cx.textBaseline='top';
    // 上帯
    cx.fillStyle='rgba(4,10,20,0.55)'; cx.fillRect(0,0,VW,46);
    cx.fillStyle='#9EEFFF'; cx.font='bold 20px Orbitron, sans-serif';
    cx.fillText('STAGE '+(stageIdx+1)+'/'+STAGES.length+'  '+st.name, 16, 12);
    // コイン
    cx.textAlign='center';
    cx.fillStyle='#ffd23c'; cx.fillText('◎ '+(coinsTotal+coinsRun), VW*0.62, 12);
    // タイム
    cx.fillStyle='#cfe9ff'; cx.fillText('TIME '+elapsed.toFixed(1), VW*0.80, 12);
    // 残機
    cx.textAlign='right'; cx.fillStyle='#ff7b8c';
    cx.fillText('♥ '+lives, VW-16, 12);
    // 進捗バー
    const prog=Math.max(0,Math.min(1, player? player.x/stageLen:0));
    cx.fillStyle='rgba(255,255,255,0.15)'; cx.fillRect(16,40,VW-32,4);
    cx.fillStyle=st.accent; cx.fillRect(16,40,(VW-32)*prog,4);
    cx.restore();
  }

  // ---- 結果(ランク評価) ----
  function rankOf(){
    // タイムとコインで雑にスコア化
    const coinScore=Math.min(1,(coinsTotal)/ (STAGES.length*20));
    const timeBonus=Math.max(0,1-(elapsed/ (STAGES.length*45)));
    const s=coinScore*0.6+timeBonus*0.4;
    return s>0.8?'S':s>0.6?'A':s>0.4?'B':'C';
  }
  function showResult(cleared){
    running=false;
    const ov=document.getElementById('questResult');
    const body=document.getElementById('questResultBody');
    if(!ov||!body) { hide(); return; }
    const rank=cleared?rankOf():'-';
    body.innerHTML =
      '<div class="qr-title">'+(cleared?'ALL CLEAR!':'GAME OVER')+'</div>'+
      (cleared?'<div class="qr-rank">RANK <b>'+rank+'</b></div>':'')+
      '<div class="qr-stat">獲得コイン <b>'+coinsTotal+'</b></div>'+
      '<div class="qr-stat">タイム <b>'+elapsed.toFixed(1)+'s</b></div>';
    ov.classList.remove('hidden');
  }

  // ---- 表示/終了 ----
  function show(){
    document.body.classList.add('in-quest');
    document.getElementById('questScreen').classList.remove('hidden');
  }
  function hide(){
    running=false;
    document.body.classList.remove('in-quest');
    const qs=document.getElementById('questScreen'); if(qs) qs.classList.add('hidden');
    const qr=document.getElementById('questResult'); if(qr) qr.classList.add('hidden');
  }
  function quit(){ hide(); if(typeof window.showTitle==='function') window.showTitle(); }

  // ---- 入力配線(専用ボタン) ----
  function bindControls(){
    const map=[['qLeft','left'],['qRight','right'],['qJump','jump']];
    map.forEach(([id,k])=>{
      const b=document.getElementById(id); if(!b) return;
      const dn=e=>{e.preventDefault(); keys[k]=true; b.classList.add('on');};
      const up=e=>{e.preventDefault(); keys[k]=false; b.classList.remove('on');};
      b.addEventListener('pointerdown',dn); b.addEventListener('pointerup',up);
      b.addEventListener('pointerleave',up); b.addEventListener('pointercancel',up);
    });
    // キーボードも(PC確認用)
    window.addEventListener('keydown',e=>{ const k=e.key.toLowerCase();
      if(k==='arrowleft'||k==='a')keys.left=true; if(k==='arrowright'||k==='d')keys.right=true;
      if(k==='arrowup'||k==='w'||k===' ')keys.jump=true; });
    window.addEventListener('keyup',e=>{ const k=e.key.toLowerCase();
      if(k==='arrowleft'||k==='a')keys.left=false; if(k==='arrowright'||k==='d')keys.right=false;
      if(k==='arrowup'||k==='w'||k===' ')keys.jump=false; });
  }

  // ---- 公開API ----
  window.ReDQuest = {
    start: start,
    quit: quit,
    _bind: bindControls,
  };
  document.addEventListener('DOMContentLoaded', bindControls);
  if(document.readyState!=='loading') bindControls();
})();
