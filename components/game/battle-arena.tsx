// components/game/battle-arena.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster, UserProfile } from '@/types/game';
import { generateDeck } from '@/actions/battle-actions';
import { getMonsters } from '@/actions/game-actions';
import { getUsers } from '@/actions/user-actions';
import { useGameStore } from '@/store/game-store';
import confetti from 'canvas-confetti';

interface BattleArenaProps {
  onClose: () => void;
}

type DeckMonster = Monster & { instanceId: string };

const getTypeMultiplier = (attackerType: string, defenderType: string) => {
  if (!attackerType || !defenderType) return 1.0;
  const atk = attackerType.split('/')[0].trim();
  const def = defenderType.split('/')[0].trim();
  
  const typeChart: Record<string, Record<string, number>> = {
    '불꽃': { '풀': 1.5, '벌레': 1.5, '얼음': 1.5, '물': 0.5, '바위': 0.5 },
    '물': { '불꽃': 1.5, '땅': 1.5, '바위': 1.5, '풀': 0.5, '전기': 0.5 },
    '풀': { '물': 1.5, '땅': 1.5, '바위': 1.5, '불꽃': 0.5, '벌레': 0.5, '비행': 0.5, '독': 0.5 },
    '전기': { '물': 1.5, '비행': 1.5, '풀': 0.5, '땅': 0.5 },
    '에스퍼': { '격투': 1.5, '독': 1.5, '악': 0.5 },
    '드래곤': { '드래곤': 1.5, '페어리': 0.5 },
  };
  return typeChart[atk]?.[def] ?? 1.0;
};

const calculateSynergy = (deck: DeckMonster[]) => {
  const counts: Record<string, number> = {};
  deck.forEach(m => {
    // 🚨 에러 방지: m.type이 비어있을 경우 '노말'로 처리
    const type = m.type ? m.type.split('/')[0].trim() : '노말';
    counts[type] = (counts[type] || 0) + 1;
  });

  let buffHp = 1.0;
  let buffAtk = 1.0;
  const activeSynergies: string[] = [];

  if ((counts['불꽃'] || 0) >= 3) { buffAtk += 0.2; activeSynergies.push('🔥 불꽃의 의지 (공격력 +20%)'); }
  if ((counts['물'] || 0) >= 3) { buffHp += 0.2; activeSynergies.push('💧 바다의 가호 (HP +20%)'); }
  if ((counts['풀'] || 0) >= 3) { buffHp += 0.1; buffAtk += 0.1; activeSynergies.push('🌿 숲의 정령 (HP & 공격력 +10%)'); }
  if ((counts['전기'] || 0) >= 3) { buffAtk += 0.25; activeSynergies.push('⚡ 고압 전류 (공격력 +25%)'); }
  if ((counts['드래곤'] || 0) >= 2) { buffHp += 0.15; buffAtk += 0.15; activeSynergies.push('🐉 드래곤의 피 (HP & 공격력 +15%)'); }
  if ((counts['노말'] || 0) >= 4) { buffHp += 0.3; activeSynergies.push('⚪ 기본의 저력 (HP +30%)'); }
  
  if (Object.values(counts).some(c => c >= 5)) {
    buffHp += 0.2; buffAtk += 0.2; activeSynergies.push('🌟 원소의 지배자 (전체 스탯 +20%)');
  }

  return { buffHp, buffAtk, activeSynergies };
};

const playSynthSound = (type: 'swing' | 'hit' | 'critical' | 'win' | 'lose' | 'click') => {
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
      osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1); gainNode.gain.setValueAtTime(0.4, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'critical') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.3); gainNode.gain.setValueAtTime(0.4, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'win') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554.37, now + 0.15); osc.frequency.setValueAtTime(659.25, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.6); osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'lose') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.linearRampToValueAtTime(100, now + 0.5); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.5); osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'click') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    }
  } catch (e) {}
};

const BattleCard = ({ 
  monster, isOpponent, turnState, isDefeated, onDragAttack, buffHp = 1, buffAtk = 1 
}: { 
  monster: Monster, isOpponent?: boolean, turnState: string, isDefeated: boolean, onDragAttack?: () => void, buffHp?: number, buffAtk?: number 
}) => {
  let animateProps: any = { y: 0, opacity: 1, rotateY: 0, scale: 1, x: 0, filter: 'brightness(1) grayscale(0%)' };
  
  if (turnState === 'CLASHING') {
    animateProps = {
      y: isOpponent ? [0, 100, 0] : [0, -100, 0], 
      scale: [1, 1.2, 1],
      transition: { duration: 0.3, ease: "easeInOut" } 
    };
  }

  if (isDefeated && turnState === 'DONE') {
    animateProps = {
      opacity: 0.3,
      scale: 0.8,
      filter: 'brightness(0.4) grayscale(100%) blur(4px)',
      rotateZ: isOpponent ? 15 : -15,
      y: isOpponent ? -30 : 30,
      transition: { type: "spring", stiffness: 100 }
    };
  }

  const canDrag = !isOpponent && turnState === 'IDLE';
  const finalHp = Math.round((monster?.hp || 0) * buffHp);
  const finalAtk = Math.round((monster?.attack || 0) * buffAtk);

  if (!monster) return null;

  return (
    <motion.div
      drag={canDrag ? "y" : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.8} 
      onDragEnd={(e, info) => {
        if (canDrag && info.offset.y < -50) onDragAttack?.();
      }}
      whileDrag={{ scale: 1.1, zIndex: 50, cursor: 'grabbing', rotateZ: Math.random() * 4 - 2 }}
      initial={{ y: isOpponent ? -100 : 100, opacity: 0, rotateY: 180 }}
      animate={animateProps}
      exit={{ opacity: 0, scale: 0.5 }}
      className={`bg-white rounded-3xl p-4 shadow-2xl w-40 md:w-48 flex flex-col items-center border-4 relative cursor-grab ${
        isOpponent ? 'border-red-500' : 'border-blue-500'
      }`}
    >
      <div className={`absolute -top-3 px-3 py-1 rounded-full text-xs font-black text-white shadow-md ${isOpponent ? 'bg-red-500' : 'bg-blue-500'}`}>
        {isOpponent ? '상대 카드' : '내 카드'}
      </div>

      <div className="absolute top-2 right-2 bg-gray-100 text-[10px] font-black px-2 py-0.5 rounded shadow">
        {/* 🚨 에러 방지 */}
        {monster.type ? monster.type.split('/')[0] : '❔'}
      </div>

      <div className="relative w-24 h-24 md:w-32 md:h-32 mb-2 mt-4 pointer-events-none">
        {monster.image ? (
          <Image src={monster.image} alt={monster.name} fill className="object-contain drop-shadow-xl" draggable={false} />
        ) : (
          <div className="text-4xl text-center mt-8">❔</div>
        )}
      </div>
      <h3 className="font-black text-gray-800 text-sm md:text-base truncate w-full text-center">{monster.name || '알 수 없음'}</h3>
      
      <div className="flex gap-2 mt-2 text-[10px] md:text-xs font-bold w-full justify-center">
        <span className={`px-2 py-1 rounded-md shadow-sm ${buffHp > 1 ? 'bg-green-500 text-white animate-pulse' : 'bg-green-100 text-green-700'}`}>
          HP {finalHp}
        </span>
        <span className={`px-2 py-1 rounded-md shadow-sm ${buffAtk > 1 ? 'bg-red-500 text-white animate-pulse' : 'bg-red-100 text-red-700'}`}>
          ATK {finalAtk}
        </span>
      </div>

      {canDrag && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [10, -5, 10] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="absolute -bottom-10 text-yellow-300 font-bold text-xs bg-black/60 px-3 py-1 rounded-full whitespace-nowrap pointer-events-none"
        >
          👆 위로 시원하게 튕기세요!
        </motion.div>
      )}
    </motion.div>
  );
};

export default function BattleArena({ onClose }: BattleArenaProps) {
  const { currentUser } = useGameStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [opponent, setOpponent] = useState<UserProfile | null>(null);
  
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [myInventoryCards, setMyInventoryCards] = useState<DeckMonster[]>([]);
  const [selectedCards, setSelectedCards] = useState<DeckMonster[]>([]);
  
  const [playerDeck, setPlayerDeck] = useState<DeckMonster[]>([]);
  const [opponentDeck, setOpponentDeck] = useState<DeckMonster[]>([]);
  
  const [stage, setStage] = useState<'SELECT' | 'DECK_BUILDING' | 'READY' | 'BATTLING' | 'RESULT'>('SELECT');
  const [turnState, setTurnState] = useState<'IDLE' | 'CLASHING' | 'DONE'>('IDLE');
  
  const [currentTurn, setCurrentTurn] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  
  const [playerCombo, setPlayerCombo] = useState(0);
  const [turnResult, setTurnResult] = useState<'WIN' | 'LOSE' | 'DRAW' | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, text: string, color: string, large?: boolean}[]>([]);

  const pSynergy = calculateSynergy(playerDeck);
  const oSynergy = calculateSynergy(opponentDeck);

  useEffect(() => {
    getUsers().then(data => setUsers(data.filter(u => u.id !== currentUser?.id)));
    getMonsters().then(setAllMonsters);
  }, [currentUser]);

  const handleSelectOpponent = (selectedUser: UserProfile) => {
    setOpponent(selectedUser);
    
    if (currentUser) {
      const myCards = currentUser.inventory.map((id, index) => {
        const m = allMonsters.find(x => x.id === id);
        return m ? { ...m, instanceId: `my-${id}-${index}` } : null;
      }).filter(Boolean) as DeckMonster[];
      
      // 🚨 에러 방지: allMonsters가 비어있을 경우 대비 더미 데이터 삽입
      while(myCards.length < 10) {
        const fallback = allMonsters.filter(m => m.rarity === 'COMMON')[0] || allMonsters[0];
        if (fallback) {
          myCards.push({ ...fallback, instanceId: `fallback-${Math.random()}` });
        } else {
          myCards.push({
            id: 'dummy', name: '알 수 없음', generation: '1세대', rarity: 'COMMON',
            type: '노말', skills: '', description: '', history: '', image: '',
            hp: 50, attack: 10, instanceId: `dummy-${Math.random()}`
          });
        }
      }
      
      setMyInventoryCards(myCards);
      setSelectedCards([]); 
      setStage('DECK_BUILDING');
    }
  };

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
        alert("이미 10장의 카드를 모두 선택했습니다! 덱을 수정하려면 다른 카드를 빼주세요.");
      }
    }
  };

  const handleDeckSubmit = async () => {
    setPlayerDeck(selectedCards);
    const oDeckRaw = await generateDeck(opponent!.inventory, true);
    setOpponentDeck(oDeckRaw.map((m, i) => ({ ...m, instanceId: `opp-${i}` })));
    setStage('READY');
  };

  const startBattle = () => {
    setStage('BATTLING');
    setCurrentTurn(0);
    setPlayerScore(0);
    setOpponentScore(0);
    setPlayerCombo(0);
    setTurnState('IDLE');
  };

  const handleClash = () => {
    if (turnState !== 'IDLE') return;
    setTurnState('CLASHING');
    
    playSynthSound('swing');
    
    setTimeout(() => {
      const pCard = playerDeck[currentTurn];
      const oCard = opponentDeck[currentTurn];
      
      const pMultiplier = getTypeMultiplier(pCard?.type || '', oCard?.type || '');
      const oMultiplier = getTypeMultiplier(oCard?.type || '', pCard?.type || '');
      const isPCrit = Math.random() < 0.15;
      const isOCrit = Math.random() < 0.15;

      const pBaseHp = (pCard?.hp || 0) * pSynergy.buffHp;
      const pBaseAtk = (pCard?.attack || 0) * pSynergy.buffAtk;
      const oBaseHp = (oCard?.hp || 0) * oSynergy.buffHp;
      const oBaseAtk = (oCard?.attack || 0) * oSynergy.buffAtk;

      const pPower = Math.round((pBaseHp + pBaseAtk) * pMultiplier * (isPCrit ? 1.5 : 1));
      const oPower = Math.round((oBaseHp + oBaseAtk) * oMultiplier * (isOCrit ? 1.5 : 1));

      const newFloats = [];
      if (pMultiplier > 1) newFloats.push({ id: 1, text: "상성 우위!", color: "text-green-400" });
      if (isPCrit) {
        newFloats.push({ id: 2, text: "크리티컬!!", color: "text-yellow-400", large: true });
        playSynthSound('critical');
      } else {
        playSynthSound('hit');
      }
      
      newFloats.push({ id: 3, text: `${pPower} DMG`, color: "text-red-500", large: true });
      setFloatingTexts(newFloats);

      if (pPower > oPower) {
        setTurnResult('WIN');
        setPlayerScore(s => s + 1);
        setPlayerCombo(c => c + 1);
      } else if (pPower < oPower) {
        setTurnResult('LOSE');
        setOpponentScore(s => s + 1);
        setPlayerCombo(0);
      } else {
        setTurnResult('DRAW');
        setPlayerCombo(0);
      }
      
      setTurnState('DONE');
    }, 300);
  };

  const handleNextTurn = () => {
    setFloatingTexts([]);
    if (currentTurn >= 9) {
      setStage('RESULT');
      if (playerScore > opponentScore) {
        playSynthSound('win');
        confetti({ particleCount: 300, spread: 150, origin: { y: 0.5 }, zIndex: 100 });
      } else {
        playSynthSound('lose');
      }
    } else {
      setCurrentTurn(c => c + 1);
      setTurnResult(null);
      setTurnState('IDLE');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-hidden touch-none">
      <button onClick={onClose} className="absolute top-6 right-6 text-4xl text-white hover:text-red-400 transition-transform hover:scale-110 z-[60]">
        ✖
      </button>

      <AnimatePresence mode="wait">
        {(stage === 'BATTLING' || stage === 'RESULT') && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="absolute top-8 flex gap-8 items-center bg-black/60 px-8 py-3 rounded-full border border-gray-600 shadow-2xl z-20">
            <div className="text-center">
              <div className="text-blue-400 font-black text-xs mb-1">YOU</div>
              <div className="text-4xl font-black text-white drop-shadow-md">{playerScore}</div>
            </div>
            <div className="text-2xl font-bold text-gray-500">VS</div>
            <div className="text-center">
              <div className="text-red-400 font-black text-xs mb-1">{opponent?.name || 'ENEMY'}</div>
              <div className="text-4xl font-black text-white drop-shadow-md">{opponentScore}</div>
            </div>
          </motion.div>
        )}

        {stage === 'SELECT' && (
          <motion.div key="select" exit={{ opacity: 0 }} className="text-center w-full max-w-4xl">
            <h2 className="text-4xl font-black text-white mb-8 drop-shadow-lg">⚔️ 대결할 상대를 선택하세요!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {users.map((user) => (
                <motion.button key={user.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleSelectOpponent(user)}
                  className="bg-gray-800/80 p-6 rounded-3xl shadow-xl flex flex-col items-center border-4 border-transparent hover:border-red-400 transition-colors backdrop-blur-sm"
                >
                  <div className="text-5xl mb-4">{user.id === 'user3' ? '👑' : '👦'}</div>
                  <h3 className="text-2xl font-bold text-white">{user.name}</h3>
                  <p className="text-yellow-400 font-bold mt-2">보유 몬스터: {user.inventory.length}장</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {stage === 'DECK_BUILDING' && (
          <motion.div key="deck-building" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full w-full max-w-6xl py-10">
            
            <div className="bg-gray-800 border-2 border-yellow-500 rounded-2xl p-4 mb-6 shadow-lg text-center flex flex-col items-center">
              <h3 className="text-yellow-400 font-black text-lg mb-2">✨ 발동 중인 시너지</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {calculateSynergy(selectedCards).activeSynergies.length > 0 ? (
                  calculateSynergy(selectedCards).activeSynergies.map((syn, idx) => (
                    <span key={idx} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-3 py-1 rounded-full text-sm shadow-md animate-pulse">
                      {syn}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">같은 속성 몬스터를 배치해 시너지를 발동하세요!</span>
                )}
              </div>
            </div>

            <div className="mb-6 flex justify-between items-end">
              <h3 className="text-white font-black text-2xl">내 덱 편성 ({selectedCards.length}/10)</h3>
              <button 
                onClick={handleDeckSubmit} 
                disabled={selectedCards.length !== 10}
                className={`font-black py-3 px-8 rounded-full transition-all shadow-lg ${selectedCards.length === 10 ? 'bg-blue-500 hover:bg-blue-400 text-white hover:scale-105' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
              >
                배틀 출전! ⚔️
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {Array.from({ length: 10 }).map((_, i) => {
                const card = selectedCards[i];
                return (
                  <div key={`slot-${i}`} onClick={() => card && toggleCardSelection(card)} className={`min-w-[80px] h-28 md:min-w-[100px] md:h-36 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all ${card ? 'bg-blue-100 border-blue-400 hover:bg-red-100' : 'bg-gray-800/50 border-gray-600 border-dashed'}`}>
                    {card ? (
                      <div className="flex flex-col items-center p-1">
                        <div className="relative w-12 h-12 md:w-16 md:h-16"><Image src={card.image} alt={card.name} fill className="object-contain drop-shadow-md" /></div>
                        <span className="text-[10px] md:text-xs font-black text-gray-800 mt-1 truncate w-16 text-center">{card.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm font-bold">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-gray-700 w-full my-4"></div>

            <h3 className="text-gray-400 font-bold mb-4">보유 몬스터 (클릭하여 추가/제거)</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3 overflow-y-auto flex-1 custom-scrollbar pb-10">
              {myInventoryCards.map((card) => {
                const isSelected = selectedCards.some(c => c.instanceId === card.instanceId);
                return (
                  <motion.div 
                    key={card.instanceId} 
                    whileHover={{ scale: 1.05 }}
                    onClick={() => toggleCardSelection(card)}
                    className={`bg-white p-2 rounded-xl border-2 cursor-pointer relative transition-all ${isSelected ? 'border-red-500 opacity-50 grayscale' : 'border-gray-200 hover:border-blue-400 shadow-md'}`}
                  >
                    {isSelected && <div className="absolute inset-0 flex items-center justify-center z-10"><span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">선택됨</span></div>}
                    <div className="relative w-full aspect-square"><Image src={card.image} alt={card.name} fill className="object-contain" /></div>
                    <div className="text-center mt-1">
                      {/* 🚨 에러 방지 */}
                      <span className="text-[9px] bg-gray-100 px-1 rounded font-bold text-gray-500">{card.type ? card.type.split('/')[0] : '❔'}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

          </motion.div>
        )}

        {stage === 'READY' && (
          <motion.div key="ready" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-center">
            <div className="text-6xl mb-6">🃏</div>
            <h2 className="text-4xl font-black text-white mb-8">준비 완료! 카드를 위로 튕길 준비를 하세요.</h2>
            <button onClick={startBattle} className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-2xl py-4 px-12 rounded-full shadow-[0_0_40px_rgba(239,68,68,0.8)] hover:scale-105 active:scale-95 transition-all">
              아레나 입장 🔥
            </button>
          </motion.div>
        )}

        {stage === 'BATTLING' && (
          <motion.div 
            key="battle" 
            className="flex flex-col items-center justify-center gap-12 w-full h-full relative"
            animate={turnState === 'DONE' && turnResult === 'LOSE' ? { x: [-20, 20, -20, 20, 0] } : {}}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence>
              {playerCombo >= 2 && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0, rotate: -20 }}
                  animate={{ scale: [1.5, 1], opacity: 1, rotate: -15 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute left-4 md:left-20 top-1/3 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 font-black text-5xl md:text-7xl italic drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] z-0 pointer-events-none"
                >
                  {playerCombo} COMBO! 🔥
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/5 font-black text-8xl md:text-[10rem] z-0 pointer-events-none">
              T{currentTurn + 1}
            </div>

            {opponentDeck[currentTurn] && (
              <BattleCard 
                monster={opponentDeck[currentTurn]} 
                isOpponent 
                turnState={turnState}
                isDefeated={turnResult === 'WIN'} 
                buffHp={oSynergy.buffHp}
                buffAtk={oSynergy.buffAtk}
              />
            )}

            <div className="h-20 flex items-center justify-center z-10 relative w-full">
              <AnimatePresence>
                {floatingTexts.map((float, index) => (
                  <motion.div
                    key={float.id}
                    initial={{ scale: 0, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: -20 - (index * 30), opacity: 1 }}
                    exit={{ opacity: 0, y: -100 }}
                    transition={{ type: "spring", bounce: 0.5, delay: index * 0.1 }}
                    className={`absolute font-black drop-shadow-[0_5px_5px_rgba(0,0,0,1)] ${float.color} ${float.large ? 'text-5xl md:text-6xl' : 'text-2xl md:text-3xl'}`}
                  >
                    {float.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {turnState === 'DONE' && turnResult && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }} 
                    animate={{ scale: 1.2, opacity: 1 }} 
                    exit={{ scale: 0, opacity: 0 }} 
                    className={`absolute font-black text-7xl italic drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] whitespace-nowrap z-20 ${
                      turnResult === 'WIN' ? 'text-blue-400' : turnResult === 'LOSE' ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {turnResult === 'WIN' ? '격파!' : turnResult === 'LOSE' ? '패배' : '무승부'}
                  </motion.div>
                )}
              </AnimatePresence>

              {turnState === 'DONE' && (
                <motion.button 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  onClick={handleNextTurn} 
                  className="absolute right-4 bg-white/20 hover:bg-white/30 text-white font-bold text-lg py-3 px-6 rounded-full backdrop-blur-sm active:scale-95 transition-all z-30 ring-2 ring-white/50"
                >
                  {currentTurn >= 9 ? '결과 보기 👉' : '다음 턴 ⏭️'}
                </motion.button>
              )}
            </div>

            {playerDeck[currentTurn] && (
              <BattleCard 
                monster={playerDeck[currentTurn]} 
                turnState={turnState}
                isDefeated={turnResult === 'LOSE'}
                onDragAttack={handleClash}
                buffHp={pSynergy.buffHp}
                buffAtk={pSynergy.buffAtk}
              />
            )}
          </motion.div>
        )}

        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ scale: 0, y: 50 }} animate={{ scale: 1, y: 0 }} className="text-center bg-gray-800 p-12 rounded-[3rem] shadow-2xl relative overflow-hidden border-4 border-gray-600">
            <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${playerScore >= opponentScore ? 'from-yellow-500/30' : 'from-red-500/30'} to-transparent pointer-events-none`} />
            <h2 className="text-5xl font-black mb-4 z-10 relative text-white">
              {playerScore > opponentScore ? '🏆 완벽한 승리! 🏆' : playerScore < opponentScore ? '💀 뼈아픈 패배' : '🤝 치열한 무승부'}
            </h2>
            <div className="text-3xl font-bold text-gray-300 mb-8 z-10 relative">
              내 점수 <span className={playerScore > opponentScore ? "text-yellow-400" : ""}>{playerScore}</span> : <span className={opponentScore > playerScore ? "text-red-400" : ""}>{opponentScore}</span> 상대 점수
            </div>
            <button onClick={onClose} className="bg-white text-gray-900 font-black py-4 px-12 rounded-full text-xl hover:bg-gray-200 active:scale-95 transition-all z-10 relative shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              마을로 돌아가기
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}