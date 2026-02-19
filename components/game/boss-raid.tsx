// components/game/boss-raid.tsx
'use client';

import { useState, useEffect } from 'react';
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

// 시너지 로직
const calculateSynergy = (deck: DeckMonster[]) => {
  const counts: Record<string, number> = {};
  deck.forEach(m => {
    const type = m.type ? m.type.split('/')[0].trim() : '노말';
    counts[type] = (counts[type] || 0) + 1;
  });

  let buffAtk = 1.0;
  const activeSynergies: string[] = [];

  if ((counts['불꽃'] || 0) >= 3) { buffAtk += 0.2; activeSynergies.push('🔥 공격력 +20%'); }
  if ((counts['물'] || 0) >= 3) { buffAtk += 0.1; activeSynergies.push('💧 공격력 +10%'); }
  if ((counts['풀'] || 0) >= 3) { buffAtk += 0.1; activeSynergies.push('🌿 공격력 +10%'); }
  if ((counts['전기'] || 0) >= 3) { buffAtk += 0.25; activeSynergies.push('⚡ 공격력 +25%'); }
  if ((counts['드래곤'] || 0) >= 2) { buffAtk += 0.15; activeSynergies.push('🐉 공격력 +15%'); }
  if (Object.values(counts).some(c => c >= 5)) { buffAtk += 0.3; activeSynergies.push('🌟 원소 지배 (공격력 +30%)'); }

  return { buffAtk, activeSynergies };
};

// 웹 오디오 사운드 합성기
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
      osc.type = 'square'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.2); gainNode.gain.setValueAtTime(0.6, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'critical') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(200, now + 0.4); gainNode.gain.setValueAtTime(0.5, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4); osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'win') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554.37, now + 0.15); osc.frequency.setValueAtTime(659.25, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.6); osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'click') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'boss_roar') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(50, now); osc.frequency.linearRampToValueAtTime(100, now + 1.5); gainNode.gain.setValueAtTime(0.8, now); gainNode.gain.linearRampToValueAtTime(0, now + 1.5); osc.start(now); osc.stop(now + 1.5);
    }
  } catch (e) {}
};

export default function BossRaid({ onClose }: BossRaidProps) {
  const { currentUser, addCoins } = useGameStore();
  
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [myInventoryCards, setMyInventoryCards] = useState<DeckMonster[]>([]);
  const [selectedCards, setSelectedCards] = useState<DeckMonster[]>([]);
  
  const [stage, setStage] = useState<'DECK_BUILDING' | 'RAIDING' | 'RESULT'>('DECK_BUILDING');
  
  // 보스 상태
  const [bossHp, setBossHp] = useState(1000000);
  const [bossMaxHp, setBossMaxHp] = useState(1000000);
  const [bossShake, setBossShake] = useState(false);
  const [isBossKilled, setIsBossKilled] = useState(false); // ⭐️ 보스 처치 여부
  
  // 레이드 진행 상태
  const [currentTurn, setCurrentTurn] = useState(0);
  const [totalDamage, setTotalDamage] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, text: string, color: string, large?: boolean}[]>([]);
  
  const pSynergy = calculateSynergy(selectedCards);

  // 1. 초기 데이터 로드
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
          myCards.push({ ...fallback, instanceId: `fallback-${Math.random()}`, level: 0 });
        }
        setMyInventoryCards(myCards);
      }
    });

    const fetchBoss = async () => {
      const status = await getBossStatus();
      setBossHp(status.hp);
      setBossMaxHp(status.maxHp);
    };
    fetchBoss();
    const interval = setInterval(fetchBoss, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // 2. 덱 편집 로직
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
  };

  // 3. 공격 로직
  const handleAttack = async () => {
    if (currentTurn >= 10) return;
    
    playSynthSound('swing');
    const attacker = selectedCards[currentTurn];
    
    const isCrit = Math.random() < 0.2; // 20% 크리티컬
    const variance = (Math.random() * 0.4) + 0.8; 
    
    let damage = Math.round((attacker.hp + attacker.attack) * pSynergy.buffAtk * variance * 10);
    if (isCrit) damage = Math.round(damage * 2);

    setBossShake(true);
    setTimeout(() => setBossShake(false), 200);

    if (isCrit) {
      playSynthSound('critical');
      setFloatingTexts([{ id: Date.now(), text: `CRITICAL! ${damage.toLocaleString()}`, color: "text-yellow-400", large: true }]);
    } else {
      playSynthSound('hit');
      setFloatingTexts([{ id: Date.now(), text: `${damage.toLocaleString()} DMG`, color: "text-red-400" }]);
    }

    setTotalDamage(prev => prev + damage);
    
    // 낙관적 UI: 즉시 체력 깎기
    setBossHp(prev => Math.max(0, prev - damage));
    
    // 서버에 데미지 전달
    const newStatus = await attackBoss(damage);
    setBossHp(newStatus.hp);

    // ⭐️ 보스 처치 시 로직
    if (newStatus.hp <= 0) {
      setIsBossKilled(true); // 처치 상태 활성화
      playSynthSound('win');
      confetti({ particleCount: 500, spread: 200, origin: { y: 0.3 }, zIndex: 100 });
      
      // 킬러 본인은 클라이언트에서 310코인을 올리고, 다른 유저들에겐 DB를 통해 300코인 지급
      if (currentUser) {
        distributeBossKillReward(currentUser.id);
      }
      
      // 즉시 보스 부활 대기
      await resetBoss();
      setStage('RESULT');
      return;
    }

    setCurrentTurn(c => c + 1);
    if (currentTurn === 9) {
      setTimeout(() => setStage('RESULT'), 1000);
    }
  };

  return (
    <div className="fixed inset-0 bg-red-950/95 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-xl touch-none overflow-hidden">
      <button onClick={onClose} className="absolute top-6 right-6 text-4xl text-white hover:text-red-400 transition-transform hover:scale-110 z-[60]">
        ✖
      </button>

      <AnimatePresence mode="wait">
        {stage === 'DECK_BUILDING' && (
          <motion.div key="deck" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -50 }} className="flex flex-col h-full w-full max-w-6xl py-10">
            <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] text-center">🔥 월드 보스 레이드 준비</h2>
            <p className="text-gray-300 text-center mb-6 font-bold">전 서버의 유저들과 힘을 합쳐 거대 보스를 처치하세요!</p>
            
            <div className="bg-gray-800 border-2 border-red-500 rounded-2xl p-4 mb-6 shadow-lg text-center">
              <h3 className="text-red-400 font-black text-lg mb-2">✨ 공격 시너지</h3>
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

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 10 }).map((_, i) => {
                const card = selectedCards[i];
                return (
                  <div key={`slot-${i}`} onClick={() => card && toggleCardSelection(card)} className={`min-w-[80px] h-28 md:min-w-[100px] md:h-36 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all ${card ? 'bg-red-950 border-red-500' : 'bg-gray-800/50 border-gray-600 border-dashed'}`}>
                    {card && (
                      <div className="flex flex-col items-center p-1 relative w-full h-full justify-center">
                        {card.level > 0 && <span className="absolute top-1 left-1 text-[8px] bg-yellow-400 text-yellow-900 font-bold px-1 rounded z-10">+{card.level}</span>}
                        <div className="relative w-12 h-12 md:w-16 md:h-16"><Image src={card.image} alt={card.name} fill className="object-contain" /></div>
                        <span className="text-[10px] md:text-xs font-black text-white mt-1 truncate w-16 text-center">{card.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-red-900 w-full my-4"></div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3 overflow-y-auto flex-1 custom-scrollbar pb-10">
              {myInventoryCards.map((card) => {
                const isSelected = selectedCards.some(c => c.instanceId === card.instanceId);
                return (
                  <motion.div key={card.instanceId} whileHover={{ scale: 1.05 }} onClick={() => toggleCardSelection(card)}
                    className={`bg-gray-800 p-2 rounded-xl border-2 cursor-pointer relative transition-all ${isSelected ? 'border-red-700 opacity-30 grayscale' : 'border-gray-600 hover:border-red-400'}`}>
                    {card.level > 0 && <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 rounded z-20">+{card.level}</span>}
                    <div className="relative w-full aspect-square"><Image src={card.image} alt={card.name} fill className="object-contain" /></div>
                    <div className="text-center mt-1"><span className="text-[9px] bg-gray-700 text-gray-300 px-1 rounded font-bold">{card.type ? card.type.split('/')[0] : '❔'}</span></div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {stage === 'RAIDING' && (
          <motion.div key="raid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-between w-full h-full py-10 relative">
            <div className="w-full max-w-3xl flex flex-col items-center">
              <h2 className="text-5xl font-black text-red-500 mb-2 drop-shadow-[0_0_20px_rgba(239,68,68,1)] tracking-widest">무한다이노</h2>
              
              <div className="w-full bg-gray-800 h-8 rounded-full border-4 border-gray-900 overflow-hidden relative shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                <motion.div 
                  className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-500"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(bossHp / bossMaxHp) * 100}%` }}
                  transition={{ type: "spring", bounce: 0 }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm drop-shadow-md">
                  {bossHp.toLocaleString()} / {bossMaxHp.toLocaleString()}
                </span>
              </div>
              
              <motion.div 
                animate={bossShake ? { x: [-20, 20, -20, 20, 0], filter: 'brightness(1.5) sepia(1)' } : { y: [-10, 10, -10] }}
                transition={bossShake ? { duration: 0.2 } : { repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="relative w-64 h-64 md:w-80 md:h-80 mt-10"
              >
                <div className="absolute inset-0 bg-red-600 rounded-full blur-[100px] opacity-30 animate-pulse"></div>
                <div className="text-[12rem] md:text-[15rem] text-center drop-shadow-[0_20px_20px_rgba(0,0,0,0.8)]">🐉</div>
              </motion.div>

              <AnimatePresence>
                {floatingTexts.map((float) => (
                  <motion.div key={float.id} initial={{ scale: 0, y: 0, opacity: 0 }} animate={{ scale: 1, y: -100, opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className={`absolute top-1/2 font-black drop-shadow-[0_5px_5px_rgba(0,0,0,1)] ${float.color} ${float.large ? 'text-6xl md:text-8xl' : 'text-4xl md:text-6xl'} z-50 pointer-events-none`}
                  >
                    {float.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="w-full flex flex-col items-center">
              <div className="text-red-300 font-bold mb-4 bg-red-950/50 px-4 py-2 rounded-full border border-red-800">
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
                    className="bg-white rounded-[2rem] p-6 shadow-[0_0_40px_rgba(255,255,255,0.2)] w-48 md:w-56 flex flex-col items-center border-4 border-yellow-400 cursor-grab relative z-20"
                  >
                    <div className="absolute -top-4 bg-yellow-400 text-yellow-900 font-black px-4 py-1 rounded-full shadow-lg">출전 대기!</div>
                    <div className="relative w-28 h-28 md:w-36 md:h-36 pointer-events-none mt-2">
                      <Image src={selectedCards[currentTurn].image} alt="" fill className="object-contain drop-shadow-xl" draggable={false} />
                    </div>
                    <h3 className="font-black text-gray-800 text-lg mt-2">{selectedCards[currentTurn].name}</h3>
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="mt-4 text-red-500 font-black text-sm">
                      👆 위로 당겨서 발사!
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* --- 스테이지 3: ⭐️ 결과 화면 (참여 10코인 / 토벌 300코인 분리) --- */}
        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ scale: 0, y: 50 }} animate={{ scale: 1, y: 0 }} className="text-center bg-gray-900 p-12 rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.5)] relative overflow-hidden border-4 border-red-500 w-full max-w-md">
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
                  <div className="text-xl font-bold text-yellow-400 mb-4 animate-pulse">전체 토벌 보상: 🪙 300</div>
                  <div className="h-px w-full bg-gray-600 mb-4"></div>
                  <div className="text-4xl font-black text-yellow-300">총 🪙 +310 코인!</div>
                </>
              ) : (
                <div className="text-3xl font-black text-yellow-300">기본 참여 🪙 +10 코인</div>
              )}
            </div>

            <button onClick={() => {
              // 막타 유저는 310, 일반 참여자는 10을 로컬에 지급
              addCoins(isBossKilled ? 310 : 10); 
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