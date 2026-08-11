'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const VALUES = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:10,Q:10,K:10};
const ORDER = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13};

function createDeck(){const d=[];for(const s of SUITS)for(const r of RANKS)d.push({rank:r,suit:s,id:r+s});return d;}
function shuffle(a){const arr=[...a];for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function cardColor(s){return (s==='♥'||s==='♦')?'#dc2626':'#0f172a';}

function scoreFifteens(cards){let pts=0;const n=cards.length;for(let m=1;m<(1<<n);m++){let sum=0;for(let i=0;i<n;i++)if(m&(1<<i))sum+=VALUES[cards[i].rank];if(sum===15)pts+=2;}return pts;}
function scorePairs(cards){const c={};for(const x of cards)c[x.rank]=(c[x.rank]||0)+1;let pts=0;for(const k of Object.values(c)){if(k===2)pts+=2;else if(k===3)pts+=6;else if(k===4)pts+=12;}return pts;}
function scoreRuns(cards){if(cards.length<3)return 0;const orders=cards.map(c=>ORDER[c.rank]).sort((a,b)=>a-b);const multi={};for(const o of orders)multi[o]=(multi[o]||0)+1;const unique=[...new Set(orders)].sort((a,b)=>a-b);let best=0,i=0;while(i<unique.length){let j=i;while(j+1<unique.length&&unique[j+1]===unique[j]+1)j++;const len=j-i+1;if(len>=3){let ways=1;for(let k=i;k<=j;k++)ways*=multi[unique[k]];best+=len*ways;}i=j+1;}return best;}
function scoreFlush(cards,isCrib,starter){if(cards.length<4)return 0;const s=cards[0].suit;if(!cards.every(c=>c.suit===s))return 0;if(isCrib)return starter&&starter.suit===s?5:0;return starter&&starter.suit===s?5:4;}
function scoreNobs(cards,starter){if(!starter)return 0;return cards.some(c=>c.rank==='J'&&c.suit===starter.suit)?1:0;}
function scoreHand(cards,starter,isCrib=false){const all=starter?[...cards,starter]:[...cards];const f=scoreFifteens(all),p=scorePairs(all),r=scoreRuns(all),fl=scoreFlush(cards,isCrib,starter),n=scoreNobs(cards,starter);const total=f+p+r+fl+n;const parts=[];if(f)parts.push(f+' from fifteens');if(p)parts.push(p+' from pairs');if(r)parts.push(r+' from runs');if(fl)parts.push(fl+' from flush');if(n)parts.push(n+' for nobs');return {total,parts};}

function scorePegging(played){
  console.log('[DEBUG] scorePegging', played.map(c=>c.rank+c.suit));
  if(!played.length)return {pts:0,reasons:[]};
  let pts=0;const reasons=[];
  const total=played.reduce((s,c)=>s+VALUES[c.rank],0);
  if(total===15){pts+=2;reasons.push('2 points for fifteen');}
  if(total===31){pts+=2;reasons.push('2 points for thirty-one');}
  let same=1;const last=played[played.length-1].rank;
  for(let i=played.length-2;i>=0;i--){if(played[i].rank===last)same++;else break;}
  if(same===2){pts+=2;reasons.push('2 points for a pair');}
  else if(same===3){pts+=6;reasons.push('6 points for three of a kind');}
  else if(same===4){pts+=12;reasons.push('12 points for four of a kind');}
  if(played.length>=3){
    for(let len=Math.min(played.length,7);len>=3;len--){
      const slice=played.slice(-len).map(c=>ORDER[c.rank]);
      const sorted=[...slice].sort((a,b)=>a-b);
      let ok=true;
      for(let i=1;i<sorted.length;i++)if(sorted[i]!==sorted[i-1]+1){ok=false;break;}
      if(ok&&new Set(slice).size===len){pts+=len;reasons.push(len+' points for a run of '+len);break;}
    }
  }
  console.log('[DEBUG] → pts:',pts,'reasons:',reasons);
  return {pts,reasons};
}

function aiChooseDiscard(hand){let best=-1,bestKeep=hand.slice(0,4);for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){const keep=hand.filter((_,i)=>i!==a&&i!==b);let sc=scoreHand(keep,null,false).total;for(const c of keep){if(c.rank==='5')sc+=1.5;if(['J','Q','K','A'].includes(c.rank))sc+=0.3;}if(sc>best){best=sc;bestKeep=keep;}}return {keep:bestKeep,discard:hand.filter(c=>!bestKeep.includes(c))};}
function aiChoosePlay(hand,played,total){const legal=hand.filter(c=>total+VALUES[c.rank]<=31);if(!legal.length)return null;let best=legal[0],bestVal=-999;for(const c of legal){const {pts}=scorePegging([...played,c]);const nt=total+VALUES[c.rank];let v=pts*10;if(nt===15||nt===31)v+=5;if(nt>21)v+=1;if(nt%5===0&&nt<31)v-=2;if(v>bestVal){bestVal=v;best=c;}}return best;}

function speak(text){
  console.log('[DEBUG] speak:', text);
  try{
    if(typeof window==='undefined'||!window.speechSynthesis){console.log('[DEBUG] no speechSynthesis');return;}
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.rate=0.9;u.volume=1;
    window.speechSynthesis.speak(u);
  }catch(e){console.log('[DEBUG] speak error',e);}
}

function Card({card,faceUp=true,selected=false,onClick,small=false}){const w=small?48:64,h=small?68:90;if(!faceUp)return(<div onClick={onClick} style={{width:w,height:h,borderRadius:8,background:'linear-gradient(135deg,#1e3a5f,#0f172a)',border:'2px solid #334155',display:'flex',alignItems:'center',justifyContent:'center',cursor:onClick?'pointer':'default',flexShrink:0}}><span style={{color:'#38bdf8',fontWeight:700,fontSize:small?13:16}}>CRIB</span></div>);const col=cardColor(card.suit);return(<div onClick={onClick} style={{width:w,height:h,borderRadius:8,background:selected?'#fef08a':'#f8fafc',border:selected?'3px solid #eab308':'2px solid #cbd5e1',boxShadow:selected?'0 0 0 2px #eab308':'0 2px 6px rgba(0,0,0,0.3)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'4px 0',cursor:onClick?'pointer':'default',flexShrink:0,transform:selected?'translateY(-8px)':'none',transition:'transform 0.12s',userSelect:'none'}}><span style={{color:col,fontWeight:700,fontSize:small?12:14}}>{card.rank}</span><span style={{color:col,fontSize:small?18:24}}>{card.suit}</span><span style={{color:col,fontWeight:700,fontSize:small?12:14,transform:'rotate(180deg)'}}>{card.rank}</span></div>);}

function PegBoard({s1,s2,d1,d2}){const W=280,MAX=121;const peg=(sc,col)=>({position:'absolute',left:Math.min(sc/MAX,1)*(W-14),top:2,width:14,height:14,borderRadius:'50%',background:col,boxShadow:'0 0 0 2px #0f172a',transition:'left 0.9s cubic-bezier(0.34,1.2,0.64,1)',zIndex:2});const track={position:'relative',width:W,height:18,background:'#0f172a',borderRadius:9,border:'1px solid #334155'};const ticks=[];for(let i=0;i<=120;i+=5)ticks.push(<div key={i} style={{position:'absolute',left:(i/MAX)*(W-2),top:0,width:2,height:18,background:i%15===0?'#475569':'#1e293b'}}/>);return(<div style={{background:'#1e293b',borderRadius:12,padding:12,border:'1px solid #334155'}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><div style={{minWidth:72}}><div style={{fontSize:13,fontWeight:700,color:'#38bdf8'}}>You: {s1}</div>{d1&&<div style={{fontSize:11,fontWeight:800,color:'#fbbf24',letterSpacing:1}}>DEALER</div>}</div><div style={track}>{ticks}<div style={peg(s1,'#38bdf8')}/></div></div><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{minWidth:72}}><div style={{fontSize:13,fontWeight:700,color:'#f472b6'}}>AI: {s2}</div>{d2&&<div style={{fontSize:11,fontWeight:800,color:'#fbbf24',letterSpacing:1}}>DEALER</div>}</div><div style={track}>{ticks}<div style={peg(s2,'#f472b6')}/></div></div></div>);}

export default function CribbageApp(){
  const [mode,setMode]=useState(null);
  const [phase,setPhase]=useState('menu');
  const [deck,setDeck]=useState([]);
  const [pHand,setPHand]=useState([]);
  const [oHand,setOHand]=useState([]);
  const [crib,setCrib]=useState([]);
  const [starter,setStarter]=useState(null);
  const [played,setPlayed]=useState([]);
  const [total,setTotal]=useState(0);
  const [pScore,setPScore]=useState(0);
  const [oScore,setOScore]=useState(0);
  const [dealer,setDealer]=useState(0);
  const [sel,setSel]=useState([]);
  const [msg,setMsg]=useState('');
  const [banner,setBanner]=useState(null);
  const [goFlag,setGoFlag]=useState(false);
  const [turn,setTurn]=useState(0);
  const [show,setShow]=useState(null);
  const [cribOwner,setCribOwner]=useState(0);
  const [savedP,setSavedP]=useState([]);
  const [savedO,setSavedO]=useState([]);
  const [busy,setBusy]=useState(false);
  const lastRef=useRef(null);
  const timerRef=useRef(null);

  const announce=useCallback((text,who=0,holdMs=6000)=>{
    console.log('%c[ANNOUNCE] '+text,'background:#0ea5e9;color:white;font-size:14px;padding:4px');
    if(timerRef.current)clearTimeout(timerRef.current);
    setBanner({text,who});
    setMsg(text);
    speak(text);
    timerRef.current=setTimeout(()=>setBanner(null),holdMs);
  },[]);

  const startNew=(m)=>{setMode(m);setDealer(Math.random()<0.5?0:1);setPScore(0);setOScore(0);setPhase('menu');};

  useEffect(()=>{
    if(!mode||phase!=='menu')return;
    const d=shuffle(createDeck());
    setDeck(d.slice(12));setPHand(d.slice(0,6));setOHand(d.slice(6,12));
    setCrib([]);setStarter(null);setPlayed([]);setTotal(0);setSel([]);
    setMsg(dealer===0?'You are DEALER – discard 2 to your crib':'Opponent is DEALER – discard 2 to their crib');
    setPhase('discard');setTurn(dealer===0?1:0);setCribOwner(dealer);
    setShow(null);setSavedP([]);setSavedO([]);setGoFlag(false);setBanner(null);setBusy(false);lastRef.current=null;
  },[mode,phase,dealer]);

  useEffect(()=>{
    if(phase!=='discard'||mode!=='ai'||oHand.length!==6)return;
    const t=setTimeout(()=>{const {keep,discard}=aiChooseDiscard(oHand);setOHand(keep);setCrib(c=>[...c,...discard]);},800);
    return ()=>clearTimeout(t);
  },[phase,mode,oHand]);

  useEffect(()=>{
    if(phase!=='discard'||pHand.length!==4||oHand.length!==4||crib.length!==4)return;
    const t=setTimeout(()=>{
      const d=[...deck];const cut=d.pop();setStarter(cut);setDeck(d);
      const goPlay=()=>{setPhase('play');setPlayed([]);setTotal(0);setTurn(dealer===0?1:0);setSavedP([...pHand]);setSavedO([...oHand]);lastRef.current=null;setBusy(false);setMsg('Starter cut – non-dealer leads');};
      if(cut.rank==='J'){
        setBusy(true);
        if(cribOwner===0){announce('His heels! Jack starter. 2 points to you (dealer).',0,6500);setTimeout(()=>{setPScore(s=>Math.min(121,s+2));setTimeout(goPlay,3500);},2200);}
        else{announce('His heels! Jack starter. 2 points to opponent (dealer).',1,6500);setTimeout(()=>{setOScore(s=>Math.min(121,s+2));setTimeout(goPlay,3500);},2200);}
      }else goPlay();
    },600);
    return ()=>clearTimeout(t);
  },[phase,pHand,oHand,crib,deck,cribOwner,dealer,announce]);

  useEffect(()=>{
    if(phase!=='play'||mode!=='ai'||turn!==1||busy)return;
    const t=setTimeout(()=>{
      const legal=oHand.filter(c=>total+VALUES[c.rank]<=31);
      if(!legal.length){
        if(!goFlag){setMsg('Opponent says GO');speak('Opponent says go');setGoFlag(true);setTurn(0);return;}
        setBusy(true);
        if(lastRef.current===1){announce('Both said GO. Opponent scores 1 point for go.',1,6500);setTimeout(()=>{setOScore(s=>Math.min(121,s+1));setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(0);lastRef.current=null;setBusy(false);setMsg('New pile – your turn');},3200);},2200);}
        else if(lastRef.current===0){announce('Both said GO. You score 1 point for go.',0,6500);setTimeout(()=>{setPScore(s=>Math.min(121,s+1));setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(0);lastRef.current=null;setBusy(false);setMsg('New pile – your turn');},3200);},2200);}
        else{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(0);lastRef.current=null;setBusy(false);setMsg('New pile – your turn');}
        return;
      }
      const choice=aiChoosePlay(oHand,played,total);if(!choice)return;
      const nextPlayed=[...played,choice];const {pts,reasons}=scorePegging(nextPlayed);const nt=total+VALUES[choice.rank];
      setOHand(h=>h.filter(c=>c.id!==choice.id));setPlayed(nextPlayed);setTotal(nt);lastRef.current=1;
      const rem=oHand.filter(c=>c.id!==choice.id);const canO=rem.some(c=>nt+VALUES[c.rank]<=31);const canP=pHand.some(c=>nt+VALUES[c.rank]<=31);
      if(pts>0){setBusy(true);const text='Opponent plays '+choice.rank+choice.suit+'. '+reasons.join('. ');announce(text,1,6500);setTimeout(()=>{setOScore(s=>Math.min(121,s+pts));setTimeout(()=>endAi(nt,canO,canP),3500);},2200);}
      else{setMsg('Opponent plays '+choice.rank+choice.suit);setTimeout(()=>endAi(nt,canO,canP),700);}
      function endAi(tot,canO,canP){
        if(tot===31||(!canO&&!canP)){
          if(tot!==31){setBusy(true);announce('No more plays. Opponent scores 1 point for go.',1,6500);setTimeout(()=>{setOScore(s=>Math.min(121,s+1));setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(0);lastRef.current=null;setBusy(false);setMsg('New pile – your turn');},3200);},2200);}
          else setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(0);lastRef.current=null;setBusy(false);setMsg('Thirty-one – new pile');},1500);
        }else{setTurn(0);setGoFlag(false);setBusy(false);}
      }
    },1000);
    return ()=>clearTimeout(t);
  },[phase,mode,turn,oHand,played,total,goFlag,pHand,busy,announce]);

  const doShow=useCallback(()=>{
    setBusy(true);setPhase('show');
    const p=scoreHand(savedP,starter,false);const o=scoreHand(savedO,starter,false);const c=scoreHand(crib,starter,true);
    setShow({p:p.total,o:o.total,c:c.total});
    const steps=[];
    if(dealer===1){steps.push({t:'Your hand scores '+p.total+(p.parts.length?': '+p.parts.join(', '):''),w:0,pts:p.total});steps.push({t:'Opponent hand scores '+o.total+(o.parts.length?': '+o.parts.join(', '):''),w:1,pts:o.total});}
    else{steps.push({t:'Opponent hand scores '+o.total+(o.parts.length?': '+o.parts.join(', '):''),w:1,pts:o.total});steps.push({t:'Your hand scores '+p.total+(p.parts.length?': '+p.parts.join(', '):''),w:0,pts:p.total});}
    steps.push({t:'Crib scores '+c.total+(c.parts.length?': '+c.parts.join(', '):'')+(cribOwner===0?' (yours)':' (theirs)'),w:cribOwner,pts:c.total});
    let i=0;
    const next=()=>{if(i>=steps.length){setBusy(false);setMsg('Hand complete. Tap Next Hand.');return;}const s=steps[i];announce(s.t,s.w,7000);setTimeout(()=>{if(s.w===0)setPScore(x=>Math.min(121,x+s.pts));else setOScore(x=>Math.min(121,x+s.pts));setTimeout(()=>{i++;next();},3800);},2400);};
    next();
  },[savedP,savedO,crib,starter,dealer,cribOwner,announce]);

  useEffect(()=>{if(phase==='play'&&pHand.length===0&&oHand.length===0&&starter&&!busy){const t=setTimeout(doShow,1200);return ()=>clearTimeout(t);}},[phase,pHand,oHand,starter,busy,doShow]);

  useEffect(()=>{if(pScore>=121||oScore>=121){setPhase('gameover');const t=pScore>=121?'You reach 121 and win!':'Opponent reaches 121 and wins!';setMsg(t);speak(t);}},[pScore,oScore]);

  const toggle=card=>{if(phase!=='discard'||busy)return;setSel(prev=>{if(prev.find(c=>c.id===card.id))return prev.filter(c=>c.id!==card.id);if(prev.length>=2)return prev;return [...prev,card];});};
  const discard=()=>{if(sel.length!==2||busy)return;setPHand(pHand.filter(c=>!sel.find(s=>s.id===c.id)));setCrib(c=>[...c,...sel]);setSel([]);};

  const play=card=>{
    if(phase!=='play'||turn!==0||busy)return;if(total+VALUES[card.rank]>31)return;
    const nextPlayed=[...played,card];const {pts,reasons}=scorePegging(nextPlayed);const nt=total+VALUES[card.rank];
    setPHand(h=>h.filter(c=>c.id!==card.id));setPlayed(nextPlayed);setTotal(nt);lastRef.current=0;
    const rem=pHand.filter(c=>c.id!==card.id);const canP=rem.some(c=>nt+VALUES[c.rank]<=31);const canO=oHand.some(c=>nt+VALUES[c.rank]<=31);
    if(pts>0){setBusy(true);const text='You play '+card.rank+card.suit+'. '+reasons.join('. ');announce(text,0,6500);setTimeout(()=>{setPScore(s=>Math.min(121,s+pts));setTimeout(()=>finishP(nt,canP,canO),3500);},2200);}
    else{setMsg('You play '+card.rank+card.suit);setTimeout(()=>finishP(nt,canP,canO),600);}
    function finishP(tot,canP,canO){
      if(tot===31||(!canP&&!canO)){
        if(tot!==31){setBusy(true);announce('No more plays. You score 1 point for go.',0,6500);setTimeout(()=>{setPScore(s=>Math.min(121,s+1));setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(1);lastRef.current=null;setBusy(false);setMsg('New pile – opponent turn');},3200);},2200);}
        else setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(1);lastRef.current=null;setBusy(false);setMsg('Thirty-one – new pile');},1500);
      }else{setTurn(1);setGoFlag(false);setBusy(false);}
    }
  };

  const sayGo=()=>{
    if(phase!=='play'||turn!==0||busy)return;if(pHand.some(c=>total+VALUES[c.rank]<=31))return;
    if(!goFlag){setMsg('You say GO');speak('You say go');setGoFlag(true);setTurn(1);}
    else{setBusy(true);
      if(lastRef.current===0){announce('Both said GO. You score 1 point for go.',0,6500);setTimeout(()=>{setPScore(s=>Math.min(121,s+1));setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(1);lastRef.current=null;setBusy(false);setMsg('New pile – opponent turn');},3200);},2200);}
      else if(lastRef.current===1){announce('Both said GO. Opponent scores 1 point for go.',1,6500);setTimeout(()=>{setOScore(s=>Math.min(121,s+1));setTimeout(()=>{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(1);lastRef.current=null;setBusy(false);setMsg('New pile – opponent turn');},3200);},2200);}
      else{setPlayed([]);setTotal(0);setGoFlag(false);setTurn(1);lastRef.current=null;setBusy(false);setMsg('New pile – opponent turn');}
    }
  };

  const nextHand=()=>{if(busy)return;setDealer(d=>1-d);setSavedP([]);setSavedO([]);setShow(null);setPhase('menu');};

  if(!mode)return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0f172a,#1e293b)',color:'#f1f5f9',padding:16,maxWidth:480,margin:'0 auto',textAlign:'center'}}>
      <h1 style={{fontSize:28,fontWeight:800,color:'#38bdf8',marginTop:40}}>Cribbage</h1>
      <p style={{color:'#94a3b8',margin:'8px 0 32px'}}>First to 121 · Open F12 Console for debug</p>
      <div style={{fontSize:64,marginBottom:24}}>🃏</div>
      <button onClick={()=>startNew('ai')} style={{background:'#38bdf8',color:'#0f172a',border:'none',borderRadius:10,padding:'14px 28px',fontSize:17,fontWeight:700,cursor:'pointer',margin:8}}>Play vs AI</button>
      <button onClick={()=>startNew('local')} style={{background:'#334155',color:'#f1f5f9',border:'none',borderRadius:10,padding:'14px 28px',fontSize:17,fontWeight:600,cursor:'pointer',margin:8}}>Local 2-Player</button>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#0f172a,#1e293b)',color:'#f1f5f9',padding:'12px 8px 80px',maxWidth:480,margin:'0 auto',position:'relative'}}>
      <div style={{textAlign:'center',marginBottom:10}}>
        <h1 style={{fontSize:26,fontWeight:800,color:'#38bdf8',margin:0}}>Cribbage</h1>
        <p style={{fontSize:13,color:'#94a3b8',margin:'4px 0 0'}}>{mode==='ai'?'vs Computer':'Local'} · First to 121</p>
      </div>
      <PegBoard s1={pScore} s2={oScore} d1={dealer===0} d2={dealer===1}/>
      <div style={{textAlign:'center',fontSize:15,minHeight:48,margin:'12px 0',lineHeight:1.4,padding:'0 8px',fontWeight:500}}>{msg}</div>

      <div style={{margin:'10px 0'}}>
        <div style={{fontSize:12,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',marginBottom:6}}>AI ({oHand.length}) {dealer===1&&<span style={{color:'#fbbf24',fontWeight:800,marginLeft:6}}>DEALER</span>}</div>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',minHeight:76}}>
          {(phase==='show'?savedO:oHand).map(c=><Card key={c.id} card={c} faceUp={phase==='show'} small/>)}
        </div>
      </div>

      <div style={{background:'#1e293b',borderRadius:12,padding:10,border:'1px solid #334155',minHeight:90,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
          {starter&&<div style={{textAlign:'center'}}><div style={{fontSize:10,color:'#94a3b8'}}>STARTER</div><Card card={starter} small/></div>}
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:'#94a3b8'}}>CRIB ({crib.length}) {cribOwner===0?'(yours)':'(theirs)'}</div>
            <div style={{display:'flex',gap:2}}>
              {crib.length===0?<div style={{width:48,height:68,borderRadius:8,border:'2px dashed #475569'}}/>:phase==='show'?crib.map(c=><Card key={c.id} card={c} small/>):crib.map((c,i)=><Card key={i} card={c} faceUp={false} small/>)}
            </div>
          </div>
        </div>
        {phase==='play'&&<>
          <div style={{background:'#0f172a',borderRadius:20,padding:'4px 14px',fontSize:18,fontWeight:700,color:'#fbbf24',border:'1px solid #334155'}}>{total} / 31</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center',minHeight:70}}>{played.map((c,i)=><Card key={c.id+i} card={c} small/>)}</div>
        </>}
        {phase==='show'&&show&&<div style={{textAlign:'center',fontSize:14,lineHeight:1.6}}><div>Your hand: <strong style={{color:'#38bdf8'}}>+{show.p}</strong></div><div>Opp hand: <strong style={{color:'#f472b6'}}>+{show.o}</strong></div><div>Crib: <strong style={{color:'#fbbf24'}}>+{show.c}</strong></div></div>}
      </div>

      <div style={{margin:'10px 0'}}>
        <div style={{fontSize:12,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',marginBottom:6}}>You ({phase==='show'?savedP.length:pHand.length}) {dealer===0&&<span style={{color:'#fbbf24',fontWeight:800,marginLeft:6}}>DEALER</span>}{phase==='discard'&&sel.length>0?' · '+sel.length+'/2':''}</div>
        <div style={{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap',minHeight:96}}>
          {(phase==='show'?savedP:pHand).map(c=><Card key={c.id} card={c} selected={!!sel.find(s=>s.id===c.id)} onClick={()=>phase==='discard'?toggle(c):play(c)}/>)}
        </div>
      </div>

      <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
        {phase==='discard'&&<button onClick={discard} disabled={sel.length!==2||busy} style={{background:'#38bdf8',color:'#0f172a',border:'none',borderRadius:10,padding:'12px 22px',fontSize:16,fontWeight:700,cursor:'pointer',opacity:sel.length===2&&!busy?1:0.5}}>Discard to Crib</button>}
        {phase==='play'&&turn===0&&!busy&&<button onClick={sayGo} style={{background:'#334155',color:'#f1f5f9',border:'none',borderRadius:10,padding:'12px 22px',fontSize:16,fontWeight:600,cursor:'pointer'}}>GO</button>}
        {phase==='show'&&!busy&&<button onClick={nextHand} style={{background:'#38bdf8',color:'#0f172a',border:'none',borderRadius:10,padding:'12px 22px',fontSize:16,fontWeight:700,cursor:'pointer'}}>Next Hand</button>}
        {phase==='gameover'&&<button onClick={()=>{setMode(null);setPhase('menu');setPScore(0);setOScore(0);}} style={{background:'#38bdf8',color:'#0f172a',border:'none',borderRadius:10,padding:'12px 22px',fontSize:16,fontWeight:700,cursor:'pointer'}}>Main Menu</button>}
      </div>

      {banner&&(
        <div style={{position:'fixed',inset:0,zIndex:99999,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:banner.who===0?'#0284c7':'#be185d',color:'#fff',padding:'28px 24px',borderRadius:20,fontWeight:800,fontSize:22,lineHeight:1.35,textAlign:'center',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.7)',border:'4px solid rgba(255,255,255,0.4)'}}>
            {banner.text}
          </div>
        </div>
      )}
    </div>
  );
}