// components/game/boss-raid.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster } from '@/types/game';
import { getMonsters } from '@/actions/game-actions';
import { getBossStatus, attackBoss, resetBoss, distributeBossKillReward } from '@/actions/boss-actions';
import { useGameStore } from '@/store/game-store';
import confetti from 'canvas-confetti';

interface BossRaidProps {
  onClose: () => void;
}

type DeckMonster = Monster & { instanceId: string; level: number };

// 레이드용 시너지 (오직 '공격력' 위주의 버프로 통일)
const calculateRaidSynergy = (deck: DeckMonster[]) => {
  const counts: Record<string, number> = {};
  deck.forEach(m => {
    const type = m.type ? m.type.split('/')[0].trim() : '노말';
    counts[type] = (counts[type] || 0) + 1;
  });

  let buffAtk = 1.0;
  const activeSynergies: string[] = [];

  if ((counts['불꽃'] || 0) >= 3) { buffAtk += 0.2; activeSynergies.push('🔥 불꽃의 분노 (공격력 +20%)'); }
  if ((counts['물'] || 0) >= 3) { buffAtk += 0.1; activeSynergies.push('💧 거친 파도 (공격력 +10%)'); }
  if ((counts['풀'] || 0) >= 3) { buffAtk += 0.1; activeSynergies.push('🌿 자연의 힘 (공격력 +10%)'); }
  if ((counts['전기'] || 0) >= 3) { buffAtk += 0.25; activeSynergies.push('⚡ 벼락 (공격력 +25%)'); }
  if ((counts['드래곤'] || 0) >= 2) { buffAtk += 0.15; activeSynergies.push('🐉 용의 포효 (공격력 +15%)'); }
  if ((counts['노말'] || 0) >= 4) { buffAtk += 0.1; activeSynergies.push('⚪ 단합된 힘 (공격력 +10%)'); }
  
  if (Object.keys(counts).length >= 5) {
    buffAtk += 0.3; activeSynergies.push('🌟 원소 지배 (공격력 +30%)');
  }

  return { buffAtk, activeSynergies };
};

const playSynthSound = (type: 'swing' | 'hit' | 'critical' | 'win' | 'click' | 'boss_roar') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'swing') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.2); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'hit') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.3); gainNode.gain.setValueAtTime(0.8, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'critical') {
      osc.type = 'square'; osc.frequency.setValueAtTime(1000, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.5); gainNode.gain.setValueAtTime(0.8, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5); osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'win') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554.37, now + 0.15); osc.frequency.setValueAtTime(659.25, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.6); osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'click') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'boss_roar') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(50, now); osc.frequency.linearRampToValueAtTime(100, now + 1.5); gainNode.gain.setValueAtTime(1.0, now); gainNode.gain.linearRampToValueAtTime(0, now + 1.5); osc.start(now); osc.stop(now + 1.5);
    }
  } catch (e) {}
};

export default function BossRaid({ onClose }: BossRaidProps) {
  const { currentUser, addCoins } = useGameStore();
  
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [myInventoryCards, setMyInventoryCards] = useState<DeckMonster[]>([]);
  const [selectedCards, setSelectedCards] = useState<DeckMonster[]>([]);
  
  const [stage, setStage] = useState<'DECK_BUILDING' | 'RAIDING' | 'RESULT'>('DECK_BUILDING');
  
  const [bossMonster, setBossMonster] = useState<Monster | null>(null);
  // ⭐️ 초기 UI값을 50만으로 설정
  const [bossHp, setBossHp] = useState(500000);
  const [bossMaxHp, setBossMaxHp] = useState(500000);
  const [hitEffect, setHitEffect] = useState(false); 
  const [isBossKilled, setIsBossKilled] = useState(false); 
  
  const [currentTurn, setCurrentTurn] = useState(0);
  const [totalDamage, setTotalDamage] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, text: string, color: string, large?: boolean}[]>([]);
  
  const [showSynergyHint, setShowSynergyHint] = useState(false);

  // ⭐️ 덱을 구성할 때 실시간으로 보여줄 공격력 버프 시너지
  const pSynergy = calculateRaidSynergy(selectedCards);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    bgmRef.current = new Audio('/sounds/boss-bgm.mp3'); 
    bgmRef.current.loop = true; 
    bgmRef.current.volume = 0.5;

    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    getMonsters().then(data => {
      setAllMonsters(data);
      if (currentUser) {
        const myCards = currentUser.inventory.map((invId, index) => {
          const [baseId, lvlStr] = invId.split('_');
          const level = parseInt(lvlStr || '0', 10);
          const m = data.find(x => x.id === baseId);
          if (!m) return null;
          const buff = 1 + (0.2 * level);
          return {
            ...m,
            hp: Math.round(m.hp * buff),
            attack: Math.round(m.attack * buff),
            name: level > 0 ? `${m.name} +${level}` : m.name,
            instanceId: `my-${invId}-${index}`,
            level: level
          };
        }).filter(Boolean) as DeckMonster[];
        
        while(myCards.length < 10) {
          const fallback = data.filter(m => m.rarity === 'COMMON')[0] || data[0];
          if(fallback) {
              myCards.push({ ...fallback, instanceId: `fallback-${Math.random()}`, level: 0 });
          }
        }
        setMyInventoryCards(myCards);
      }
    });

    const fetchBoss = async () => {
      const status = await getBossStatus();
      setBossHp(status.hp);
      setBossMaxHp(status.maxHp);
      setBossMonster(status.bossMonster); 
    };
    fetchBoss();
    const interval = setInterval(fetchBoss, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const toggleCardSelection = (card: DeckMonster) => {
    const isSelected = selectedCards.find(c => c.instanceId === card.instanceId);
    if (isSelected) {
      setSelectedCards(prev => prev.filter(c => c.instanceId !== card.instanceId));
      playSynthSound('click');
    } else {
      if (selectedCards.length < 10) {
        setSelectedCards(prev => [...prev, card]);
        playSynthSound('click');
      } else {
        alert("10장을 모두 골랐습니다!");
      }
    }
  };

  const startRaid = () => {
    setStage('RAIDING');
    setCurrentTurn(0);
    setTotalDamage(0);
    setIsBossKilled(false);
    playSynthSound('boss_roar');

    if (bgmRef.current) {
      bgmRef.current.play().catch((e) => console.log('BGM 재생 차단됨:', e)); 
    }
  };

  const handleAttack = async () => {
    if (currentTurn >= 10) return;
    
    playSynthSound('swing');
    const attacker = selectedCards[currentTurn];
    
    const isCrit = Math.random() < 0.2;
    const variance = (Math.random() * 0.4) + 0.8; 
    
    // ⭐️ 보스 레이드 데미지 연산: (기본 HP + 기본 공격력) * 시너지의 공격력 버프 계수 * 난수 * 10
    // 시너지가 제대로 적용되어 데미지가 뻥튀기 됩니다.
    let damage = Math.round((attacker.hp + attacker.attack) * pSynergy.buffAtk * variance * 10);
    if (isCrit) damage = Math.round(damage * 2);

    setHitEffect(true);
    setTimeout(() => setHitEffect(false), 350);

    if (isCrit) {
      playSynthSound('critical');
      setFloatingTexts([{ id: Date.now(), text: `CRITICAL!! ${damage.toLocaleString()}`, color: "text-yellow-300", large: true }]);
    } else {
      playSynthSound('hit');
      setFloatingTexts([{ id: Date.now(), text: `${damage.toLocaleString()} DMG!`, color: "text-red-400" }]);
    }

    setTotalDamage(prev => prev + damage);
    setBossHp(prev => Math.max(0, prev - damage));
    
    const newStatus = await attackBoss(damage);
    setBossHp(newStatus.hp);
    setBossMonster(newStatus.bossMonster);

    if (newStatus.hp <= 0) {
      setIsBossKilled(true);
      playSynthSound('win');
      
      if (bgmRef.current) {
        bgmRef.current.pause();
      }

      confetti({ particleCount: 800, spread: 360, origin: { y: 0.3 }, zIndex: 100 });
      
      if (currentUser) {
        distributeBossKillReward(currentUser.id);
      }
      
      await resetBoss();
      setStage('RESULT');
      return;
    }

    setCurrentTurn(c => c + 1);
    if (currentTurn === 9) {
      setTimeout(() => {
        if (bgmRef.current) bgmRef.current.pause();
        setStage('RESULT');
      }, 1000);
    }
  };

  return (
    <div className={`fixed inset-0 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-xl touch-none overflow-hidden transition-colors duration-100 ${hitEffect ? 'bg-red-600/80' : 'bg-red-950/95'}`}>
      <button onClick={onClose} className="absolute top-6 right-6 text-4xl text-white hover:text-red-400 transition-transform hover:scale-110 z-[100]">
        ✖
      </button>

      {/* ⭐️ 레이드용 시너지 툴팁 모달 */}
      <AnimatePresence>
        {showSynergyHint && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute z-[100] top-24 bg-gray-900 border-2 border-red-500 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-white">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
              <h3 className="text-xl font-black text-red-400">🐉 레이드 시너지 가이드</h3>
              <button onClick={() => setShowSynergyHint(false)} className="text-gray-400 hover:text-white">✖</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">레이드에서는 체력 대신 <span className="text-red-300 font-bold">오직 공격력 증폭</span>만 적용됩니다!</p>
            <ul className="space-y-3 text-sm font-bold">
              <li className="flex justify-between"><span>🔥 불꽃 타입 3마리</span> <span className="text-red-400">공격력 +20%</span></li>
              <li className="flex justify-between"><span>💧 물 타입 3마리</span> <span className="text-red-400">공격력 +10%</span></li>
              <li className="flex justify-between"><span>🌿 풀 타입 3마리</span> <span className="text-red-400">공격력 +10%</span></li>
              <li className="flex justify-between"><span>⚡ 전기 타입 3마리</span> <span className="text-red-400">공격력 +25%</span></li>
              <li className="flex justify-between"><span>🐉 드래곤 타입 2마리</span> <span className="text-red-400">공격력 +15%</span></li>
              <li className="flex justify-between border-t border-gray-700 pt-2 mt-2"><span>🌟 원소 지배 (5종류 이상)</span> <span className="text-yellow-400">공격력 +30%</span></li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {stage === 'DECK_BUILDING' && (
          <motion.div key="deck" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -50 }} className="flex flex-col h-full w-full max-w-6xl py-10 z-50">
            <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] text-center">🔥 월드 보스 레이드 준비</h2>
            <p className="text-gray-300 text-center mb-6 font-bold">환상의 포켓몬을 쓰러뜨리고 막대한 코인을 얻으세요!</p>
            
            <div className="bg-gray-800 border-2 border-red-500 rounded-2xl p-4 mb-6 shadow-lg text-center flex flex-col items-center relative">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-red-400 font-black text-lg">✨ 레이드 공격 시너지</h3>
                <button onClick={() => setShowSynergyHint(true)} className="bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-500 transition-colors">ℹ️</button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {pSynergy.activeSynergies.length > 0 ? pSynergy.activeSynergies.map((syn, idx) => (
                    <span key={idx} className="bg-red-500 text-white font-bold px-3 py-1 rounded-full text-xs shadow-md animate-pulse">{syn}</span>
                )) : <span className="text-gray-500 text-sm">속성을 맞춰 데미지를 뻥튀기 하세요!</span>}
              </div>
            </div>

            <div className="mb-4 flex justify-between items-end">
              <h3 className="text-white font-black text-2xl">레이드 토벌대 ({selectedCards.length}/10)</h3>
              <button onClick={startRaid} disabled={selectedCards.length !== 10} className={`font-black py-3 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)] ${selectedCards.length === 10 ? 'bg-red-600 hover:bg-red-500 text-white hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                보스 토벌 시작! ⚔️
              </button>
            </div>

            {/* 상단 덱 슬롯 */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide items-center">
              {Array.from({ length: 10 }).map((_, i) => {
                const card = selectedCards[i];
                return (
                  <div key={`slot-${i}`} onClick={() => card && toggleCardSelection(card)} 
                    className={`relative min-w-[70px] h-24 md:min-w-[90px] md:h-32 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${card ? 'bg-red-950 border-red-500 hover:border-white shadow-inner' : 'bg-gray-800/50 border-gray-600 border-dashed'}`}>
                    {card ? (
                      <>
                        {card.level > 0 && <span className="absolute -top-2 -left-2 text-[9px] bg-yellow-400 text-yellow-900 font-black px-1.5 py-0.5 rounded-full z-10 shadow">+{card.level}</span>}
                        <div className="relative w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white rounded-full shadow-sm mb-1">
                          {card.image ? <Image src={card.image} alt={card.name} fill className="object-contain p-1 drop-shadow-md" /> : <span className="text-xl text-gray-400">❔</span>}
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-white truncate w-[90%] text-center">{card.name}</span>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs font-bold">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-red-900 w-full my-4"></div>

            <h3 className="text-gray-400 font-bold mb-4">보유 몬스터 (클릭하여 추가/제거)</h3>
            
            {/* ⭐️ 하단 인벤토리: aspect-[3/4] 및 flex-1 구조로 늘어짐 방지 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 overflow-y-auto flex-1 custom-scrollbar pb-10 content-start">
              {myInventoryCards.map((card) => {
                const isSelected = selectedCards.some(c => c.instanceId === card.instanceId);
                return (
                  <motion.div 
                    key={card.instanceId} 
                    whileHover={{ scale: 1.05 }}
                    onClick={() => toggleCardSelection(card)}
                    className={`bg-gray-800 p-2 rounded-xl border-2 cursor-pointer relative transition-all flex flex-col items-center justify-between aspect-[3/4] ${isSelected ? 'border-red-700 opacity-50 grayscale' : 'border-gray-600 hover:border-red-400 shadow-md'}`}
                  >
                    {card.level > 0 && <span className="absolute -top-2 -left-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 py-0.5 rounded-full z-20 shadow">+{card.level}</span>}
                    {isSelected && <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-xl"><span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">선택됨</span></div>}
                    
                    <div className="relative w-full flex-1 flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden border border-gray-700 mt-1 min-h-0">
                      {card.image ? (
                        <Image src={card.image} alt={card.name} fill className="object-contain p-1" />
                      ) : (
                        <span className="text-3xl text-gray-500">❔</span>
                      )}
                    </div>
                    
                    <div className="text-center w-full flex flex-col items-center h-[40px] shrink-0 justify-end mt-1">
                      <span className="text-[8px] bg-gray-700 px-1.5 py-0.5 rounded font-bold text-gray-400 mb-0.5">{card.type ? card.type.split('/')[0] : '❔'}</span>
                      <h3 className="font-black text-[10px] text-gray-300 w-full truncate leading-tight">{card.name}</h3>
                      <div className="flex gap-1 mt-0.5 text-[8px] font-bold text-gray-500 leading-tight">
                        <span>H:{card.hp}</span>
                        <span>A:{card.attack}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {stage === 'RAIDING' && (
          <motion.div key="raid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-between w-full h-full py-6 relative">
            <div className="w-full max-w-3xl flex flex-col items-center z-20">
              <h2 className="text-4xl md:text-6xl font-black text-red-500 mb-4 drop-shadow-[0_0_30px_rgba(239,68,68,1)] tracking-widest uppercase">
                {bossMonster ? bossMonster.name : '미지의 몬스터'}
              </h2>
              
              {/* 보스 체력 바 */}
              <div className="w-full bg-gray-900 h-10 rounded-full border-[6px] border-black overflow-hidden relative shadow-[0_0_50px_rgba(220,38,38,0.8)]">
                <motion.div 
                  className="h-full bg-gradient-to-r from-red-800 via-red-500 to-yellow-500"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
                  transition={{ type: "spring", bounce: 0 }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-xl drop-shadow-lg tracking-wider">
                  {bossHp.toLocaleString()} / {bossMaxHp.toLocaleString()}
                </span>
              </div>
              
              <motion.div 
                animate={
                  hitEffect 
                    ? { x: [-50, 50, -50, 50, 0], y: [30, -30, 30, -30, 0], scale: [1, 1.4, 0.9, 1.2, 1], filter: 'brightness(2.5) contrast(2) sepia(1) hue-rotate(-50deg)' } 
                    : { y: [-20, 20, -20], filter: 'brightness(1) contrast(1) sepia(0) hue-rotate(0deg)' }
                }
                transition={hitEffect ? { duration: 0.35, ease: "linear" } : { repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="relative w-80 h-80 md:w-[32rem] md:h-[32rem] mt-8 flex items-center justify-center z-10"
              >
                <div className={`absolute inset-0 rounded-full blur-[100px] transition-all duration-200 ${hitEffect ? 'bg-white opacity-100 scale-150' : 'bg-red-600 opacity-40 animate-pulse'}`}></div>
                
                {bossMonster?.image ? (
                  <Image src={bossMonster.image} alt={bossMonster.name} fill className="object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.9)] z-10 pointer-events-none" priority />
                ) : (
                  <div className="text-[15rem] text-center drop-shadow-2xl z-10">🐉</div>
                )}
              </motion.div>

              <AnimatePresence>
                {floatingTexts.map((float) => (
                  <motion.div key={float.id} initial={{ scale: 0, y: 0, opacity: 0 }} animate={{ scale: 1, y: -150, opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className={`absolute top-1/2 font-black drop-shadow-[0_10px_10px_rgba(0,0,0,1)] ${float.color} ${float.large ? 'text-7xl md:text-9xl' : 'text-5xl md:text-7xl'} z-50 pointer-events-none`}
                  >
                    {float.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="w-full flex flex-col items-center z-20">
              <div className="text-red-200 font-bold mb-6 bg-black/60 px-6 py-2 rounded-full border border-red-800 text-lg shadow-lg">
                남은 공격: {10 - currentTurn}회 | 누적 데미지: {totalDamage.toLocaleString()}
              </div>
              
              <AnimatePresence mode="popLayout">
                {currentTurn < 10 && (
                  <motion.div
                    key={currentTurn}
                    drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.8}
                    onDragEnd={(e, info) => { if (info.offset.y < -50) handleAttack(); }}
                    whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
                    initial={{ y: 200, opacity: 0, rotateZ: 10 }}
                    animate={{ y: 0, opacity: 1, rotateZ: 0 }}
                    exit={{ y: -500, opacity: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="bg-white rounded-[2rem] p-6 shadow-[0_0_50px_rgba(255,255,255,0.3)] w-56 md:w-64 flex flex-col items-center border-[6px] border-yellow-400 cursor-grab relative z-30 aspect-[3/4]"
                  >
                    <div className="absolute -top-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 font-black px-6 py-2 rounded-full shadow-lg text-lg z-20">출전 대기!</div>
                    <div className="relative w-full flex-1 pointer-events-none mt-4 flex items-center justify-center min-h-0">
                      {selectedCards[currentTurn]?.image ? (
                        <Image src={selectedCards[currentTurn].image} alt="" fill className="object-contain drop-shadow-xl" draggable={false} />
                      ) : (
                        <span className="text-6xl text-gray-300">❔</span>
                      )}
                    </div>
                    <div className="w-full h-[60px] flex flex-col items-center justify-end shrink-0">
                       <h3 className="font-black text-gray-900 text-xl mt-2 bg-gray-100 px-4 py-1 rounded-lg w-full text-center truncate">{selectedCards[currentTurn].name}</h3>
                       <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="mt-3 bg-red-100 text-red-600 font-black text-sm px-4 py-1.5 rounded-full border border-red-300 w-full text-center">
                         👆 튕겨서 발사!
                       </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ scale: 0, y: 50 }} animate={{ scale: 1, y: 0 }} className="text-center bg-gray-900 p-12 rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.5)] relative overflow-hidden border-4 border-red-500 w-full max-w-md z-50">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/50 to-transparent pointer-events-none" />
            
            <h2 className="text-4xl md:text-5xl font-black mb-4 z-10 relative text-yellow-400 drop-shadow-lg">
              {isBossKilled ? '🎉 보스 토벌 성공! 🎉' : '레이드 타격 완료'}
            </h2>
            <p className="text-gray-300 text-lg font-bold mb-2 relative z-10">당신이 입힌 총 데미지</p>
            <div className="text-5xl font-black text-white mb-8 z-10 relative drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              💥 {totalDamage.toLocaleString()}
            </div>
            
            <div className="bg-black/50 p-6 rounded-2xl mb-8 relative z-10 border border-gray-700">
              <p className="text-green-400 font-bold mb-3">🎁 획득 보상 내역</p>
              
              {isBossKilled ? (
                <>
                  <div className="text-xl font-bold text-gray-300 mb-1">기본 참여 보상: 🪙 10</div>
                  {/* ⭐️ 보상 텍스트를 300에서 200으로 변경 */}
                  <div className="text-xl font-bold text-yellow-400 mb-4 animate-pulse">전체 토벌 보상: 🪙 200</div>
                  <div className="h-px w-full bg-gray-600 mb-4"></div>
                  {/* ⭐️ 총 코인을 310에서 210으로 변경 */}
                  <div className="text-4xl font-black text-yellow-300">총 🪙 +210 코인!</div>
                </>
              ) : (
                <div className="text-3xl font-black text-yellow-300">기본 참여 🪙 +10 코인</div>
              )}
            </div>

            <button onClick={() => {
              // ⭐️ 실제 로컬 유저에게 더해지는 코인도 310에서 210으로 변경
              addCoins(isBossKilled ? 210 : 10); 
              onClose();
            }} className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black py-4 rounded-full text-xl hover:scale-105 active:scale-95 transition-all z-10 relative shadow-xl">
              보상 받고 돌아가기
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}