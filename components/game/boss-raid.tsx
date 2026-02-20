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
      // 타격음 더 강하게 수정 (톱니파 + 저음)
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(30, now + 0.3); gainNode.gain.setValueAtTime(0.8, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'critical') {
      // 크리티컬 이펙트 더 화려하게
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
  
  // ⭐️ 서버에서 가져온 실제 보스 데이터
  const [bossMonster, setBossMonster] = useState<Monster | null>(null);
  const [bossHp, setBossHp] = useState(100000);
  const [bossMaxHp, setBossMaxHp] = useState(100000);
  const [hitEffect, setHitEffect] = useState(false); // 강력한 타격 이펙트 트리거
  const [isBossKilled, setIsBossKilled] = useState(false); 
  
  const [currentTurn, setCurrentTurn] = useState(0);
  const [totalDamage, setTotalDamage] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, text: string, color: string, large?: boolean}[]>([]);
  
  const pSynergy = calculateSynergy(selectedCards);
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
      setBossMonster(status.bossMonster); // ⭐️ 실제 몬스터 정보 세팅
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
    
    let damage = Math.round((attacker.hp + attacker.attack) * pSynergy.buffAtk * variance * 10);
    if (isCrit) damage = Math.round(damage * 2);

    // ⭐️ 강력한 화면 흔들림 & 번쩍임 이펙트 트리거
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
    // ⭐️ 화면 전체에 데미지 이펙트 적용 (hitEffect일 때 붉게 번쩍임)
    <div className={`fixed inset-0 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-xl touch-none overflow-hidden transition-colors duration-100 ${hitEffect ? 'bg-red-600/80' : 'bg-red-950/95'}`}>
      <button onClick={onClose} className="absolute top-6 right-6 text-4xl text-white hover:text-red-400 transition-transform hover:scale-110 z-[100]">
        ✖
      </button>

      <AnimatePresence mode="wait">
        {stage === 'DECK_BUILDING' && (
          <motion.div key="deck" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -50 }} className="flex flex-col h-full w-full max-w-6xl py-10 z-50">
            <h2 className="text-4xl font-black text-red-500 mb-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] text-center">🔥 월드 보스 레이드 준비</h2>
            <p className="text-gray-300 text-center mb-6 font-bold">환상의 포켓몬을 쓰러뜨리고 막대한 코인을 얻으세요!</p>
            
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
                        <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                          {card.image ? (
                            <Image src={card.image} alt={card.name} fill className="object-contain" />
                          ) : (
                            <span className="text-2xl text-gray-500">❔</span>
                          )}
                        </div>
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
                    <div className="relative w-full aspect-square flex items-center justify-center bg-gray-900 rounded-lg">
                      {card.image ? (
                        <Image src={card.image} alt={card.name} fill className="object-contain" />
                      ) : (
                        <span className="text-3xl text-gray-500">❔</span>
                      )}
                    </div>
                    <div className="text-center mt-1"><span className="text-[9px] bg-gray-700 text-gray-300 px-1 rounded font-bold">{card.type ? card.type.split('/')[0] : '❔'}</span></div>
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
              
              {/* ⭐️ 보스 몬스터 거대 비주얼 렌더링 & 피격 애니메이션 */}
              <motion.div 
                animate={
                  hitEffect 
                    ? { x: [-50, 50, -50, 50, 0], y: [30, -30, 30, -30, 0], scale: [1, 1.4, 0.9, 1.2, 1], filter: 'brightness(2.5) contrast(2) sepia(1) hue-rotate(-50deg)' } 
                    : { y: [-20, 20, -20], filter: 'brightness(1) contrast(1) sepia(0) hue-rotate(0deg)' }
                }
                transition={hitEffect ? { duration: 0.35, ease: "linear" } : { repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="relative w-80 h-80 md:w-[32rem] md:h-[32rem] mt-8 flex items-center justify-center z-10"
              >
                {/* 보스 뒷배경 후광 이펙트 */}
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
                    // ⭐️ 데미지 텍스트를 훨씬 크게 변경
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
                    className="bg-white rounded-[2rem] p-6 shadow-[0_0_50px_rgba(255,255,255,0.3)] w-56 md:w-64 flex flex-col items-center border-[6px] border-yellow-400 cursor-grab relative z-30"
                  >
                    <div className="absolute -top-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 font-black px-6 py-2 rounded-full shadow-lg text-lg">출전 대기!</div>
                    <div className="relative w-32 h-32 md:w-40 md:h-40 pointer-events-none mt-4 flex items-center justify-center">
                      {selectedCards[currentTurn]?.image ? (
                        <Image src={selectedCards[currentTurn].image} alt="" fill className="object-contain drop-shadow-xl" draggable={false} />
                      ) : (
                        <span className="text-6xl text-gray-300">❔</span>
                      )}
                    </div>
                    <h3 className="font-black text-gray-900 text-xl mt-4 bg-gray-100 px-4 py-1 rounded-lg">{selectedCards[currentTurn].name}</h3>
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="mt-6 bg-red-100 text-red-600 font-black text-base px-6 py-2 rounded-full border border-red-300">
                      👆 위로 튕겨서 발사!
                    </motion.div>
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
                  <div className="text-xl font-bold text-yellow-400 mb-4 animate-pulse">전체 토벌 보상: 🪙 300</div>
                  <div className="h-px w-full bg-gray-600 mb-4"></div>
                  <div className="text-4xl font-black text-yellow-300">총 🪙 +310 코인!</div>
                </>
              ) : (
                <div className="text-3xl font-black text-yellow-300">기본 참여 🪙 +10 코인</div>
              )}
            </div>

            <button onClick={() => {
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