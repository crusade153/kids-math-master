// components/game/battle-arena.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster, UserProfile } from '@/types/game';
import { MathProblem, Difficulty } from '@/types/math';
import { getMonsters } from '@/actions/game-actions';
import { getUsers } from '@/actions/user-actions';
import { useGameStore } from '@/store/game-store';
import { generateProblem } from '@/lib/generator';
import NumberPad from '@/components/ui/number-pad';
import confetti from 'canvas-confetti';

interface BattleArenaProps {
  onClose: () => void;
}

type DeckMonster = Monster & { instanceId: string; level: number };

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
  
  if (Object.keys(counts).length >= 5) {
    buffHp += 0.2; buffAtk += 0.2; activeSynergies.push('🌟 원소의 지배자 (전체 스탯 +20%)');
  }

  return { buffHp, buffAtk, activeSynergies };
};

const playSynthSound = (type: 'swing' | 'hit' | 'critical' | 'win' | 'lose' | 'click' | 'magic') => {
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
    } else if (type === 'magic') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(600, now + 1.0); gainNode.gain.setValueAtTime(0, now); gainNode.gain.linearRampToValueAtTime(0.3, now + 0.5); gainNode.gain.linearRampToValueAtTime(0, now + 1.0); osc.start(now); osc.stop(now + 1.0);
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
  monster, isOpponent, turnState, isDefeated, onClick, isSelectable, buffHp = 1, buffAtk = 1, scale = 1
}: { 
  monster: Monster & { level?: number }, isOpponent?: boolean, turnState: string, isDefeated?: boolean, onClick?: () => void, isSelectable?: boolean, buffHp?: number, buffAtk?: number, scale?: number
}) => {
  let animateProps: any = { y: 0, opacity: 1, rotateY: 0, scale: scale, x: 0, filter: 'brightness(1) grayscale(0%)' };
  
  if (turnState === 'CLASHING') {
    animateProps = {
      y: isOpponent ? [0, 80, 0] : [0, -80, 0], 
      scale: [scale, scale * 1.2, scale],
      transition: { duration: 0.3, ease: "easeInOut" } 
    };
  }

  if (isDefeated && turnState === 'DONE') {
    animateProps = {
      opacity: 0.3,
      scale: scale * 0.8,
      filter: 'brightness(0.4) grayscale(100%) blur(4px)',
      rotateZ: isOpponent ? 15 : -15,
      y: isOpponent ? -30 : 30,
      transition: { type: "spring", stiffness: 100 }
    };
  }

  const finalHp = Math.round((monster?.hp || 0) * buffHp);
  const finalAtk = Math.round((monster?.attack || 0) * buffAtk);

  if (!monster) return null;

  return (
    <motion.div
      onClick={isSelectable ? onClick : undefined}
      whileHover={isSelectable ? { scale: scale * 1.05, y: -10 } : {}}
      initial={{ y: isOpponent ? -100 : 100, opacity: 0, rotateY: 180 }}
      animate={animateProps}
      exit={{ opacity: 0, scale: 0.5 }}
      className={`bg-white rounded-3xl p-3 md:p-4 shadow-xl flex flex-col items-center border-[3px] relative aspect-[3/4] ${isSelectable ? 'cursor-pointer hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(250,204,21,0.6)]' : ''} ${
        isOpponent ? 'border-red-500 w-36 md:w-48' : 'border-blue-500 w-28 md:w-44'
      }`}
    >
      <div className={`absolute -top-3 px-3 py-0.5 rounded-full text-[10px] md:text-xs font-black text-white shadow-md z-20 ${isOpponent ? 'bg-red-500' : 'bg-blue-500'}`}>
        {isOpponent ? '상대 카드' : '내 카드'}
      </div>

      <div className="absolute top-2 right-2 bg-gray-100 text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded shadow z-20">
        {monster.type ? monster.type.split('/')[0] : '❔'}
      </div>

      {monster.level && monster.level > 0 ? (
        <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-full shadow z-20">
          +{monster.level}
        </div>
      ) : null}

      <div className="relative w-full flex-1 flex items-center justify-center mt-3 min-h-0 pointer-events-none">
        {monster.image ? (
          <Image src={monster.image} alt={monster.name} fill className="object-contain drop-shadow-lg" draggable={false} />
        ) : (
          <div className="text-3xl text-gray-300">❔</div>
        )}
      </div>
      
      <div className="w-full flex flex-col items-center justify-end h-[50px] shrink-0 mt-1">
        <h3 className="font-black text-gray-800 text-[11px] md:text-sm truncate w-full text-center">{monster.name || '알 수 없음'}</h3>
        <div className="flex gap-1 md:gap-2 mt-1 text-[9px] md:text-[10px] font-bold w-full justify-center">
          <span className={`px-1.5 py-0.5 rounded-md shadow-sm ${buffHp > 1 ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>
            HP {finalHp}
          </span>
          <span className={`px-1.5 py-0.5 rounded-md shadow-sm ${buffAtk > 1 ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`}>
            ATK {finalAtk}
          </span>
        </div>
      </div>
      
      {isSelectable && (
        <div className="absolute -bottom-4 bg-yellow-400 text-yellow-900 text-[10px] font-black px-3 py-1 rounded-full shadow-md animate-pulse z-20">
          출전! 👆
        </div>
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
  const [playerHand, setPlayerHand] = useState<DeckMonster[]>([]);
  const [activePlayerCard, setActivePlayerCard] = useState<DeckMonster | null>(null);
  const [opponentDeck, setOpponentDeck] = useState<DeckMonster[]>([]);
  
  const [spellMultiplier, setSpellMultiplier] = useState(1);
  const [attackProblem, setAttackProblem] = useState<MathProblem | null>(null);
  const [attackInput, setAttackInput] = useState('');

  const [stage, setStage] = useState<'SELECT' | 'DECK_BUILDING' | 'READY' | 'BATTLING' | 'RESULT'>('SELECT');
  const [turnState, setTurnState] = useState<'IDLE' | 'DIFFICULTY_SELECT' | 'CHARGING' | 'CLASHING' | 'DONE'>('IDLE');
  
  const [currentTurn, setCurrentTurn] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  
  const [playerCombo, setPlayerCombo] = useState(0);
  const [turnResult, setTurnResult] = useState<'WIN' | 'LOSE' | 'DRAW' | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, text: string, color: string, large?: boolean}[]>([]);

  const [showSynergyHint, setShowSynergyHint] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false); 

  // ⭐️ BGM을 위한 Audio Ref 추가
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const pSynergy = calculateSynergy(selectedCards); 
  const pActiveSynergy = calculateSynergy(playerDeck.concat(playerHand)); 
  const oSynergy = calculateSynergy(opponentDeck);

  // ⭐️ BGM 초기화 및 클린업
  useEffect(() => {
    bgmRef.current = new Audio('/sounds/battle-bgm.mp3'); 
    bgmRef.current.loop = true; 
    bgmRef.current.volume = 0.4; // 웅장하게 깔리도록 설정

    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    Promise.all([getUsers(), getMonsters()]).then(([usersData, monstersData]) => {
      setUsers(usersData.filter(u => u.id !== currentUser?.id));
      setAllMonsters(monstersData);
      setIsDataLoaded(true); 
    });
  }, [currentUser]);

  const handleSelectOpponent = (selectedUser: UserProfile) => {
    setOpponent(selectedUser);
    if (currentUser) {
      const myCards = currentUser.inventory.map((invId, index) => {
        const [baseId, lvlStr] = invId.split('_');
        const level = parseInt(lvlStr || '0', 10);
        const m = allMonsters.find(x => x.id === baseId);
        
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
        const fallback = allMonsters.filter(m => m.rarity === 'COMMON')[0] || allMonsters[0];
        myCards.push({ ...fallback, instanceId: `fallback-${Math.random()}`, level: 0 });
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
        alert("이미 10장의 카드를 모두 선택했습니다!");
      }
    }
  };

  const handleDeckSubmit = () => {
    const shuffledPlayerDeck = [...selectedCards].sort(() => Math.random() - 0.5);
    setPlayerHand(shuffledPlayerDeck.slice(0, 3));
    setPlayerDeck(shuffledPlayerDeck.slice(3)); 

    const oppCards = opponent!.inventory.map((invId, index) => {
      const [baseId, lvlStr] = invId.split('_');
      const level = parseInt(lvlStr || '0', 10);
      const m = allMonsters.find(x => x.id === baseId);
      if (!m) return null;
      const buff = 1 + (0.2 * level);
      return {
        ...m,
        hp: Math.round(m.hp * buff),
        attack: Math.round(m.attack * buff),
        name: level > 0 ? `${m.name} +${level}` : m.name,
        level: level
      };
    }).filter(Boolean) as DeckMonster[];

    const pool = oppCards.length > 0 ? oppCards : allMonsters;
    const finalOpponentDeck: DeckMonster[] = [];
    for(let i = 0; i < 10; i++) {
      const randomCard = pool[Math.floor(Math.random() * pool.length)];
      finalOpponentDeck.push({ ...randomCard, instanceId: `opp-${i}`, level: randomCard.level || 0 });
    }
    
    setOpponentDeck(finalOpponentDeck);
    setStage('READY');
  };

  const startBattle = () => {
    setStage('BATTLING');
    setCurrentTurn(0);
    setPlayerScore(0);
    setOpponentScore(0);
    setPlayerCombo(0);
    setTurnState('IDLE');
    setActivePlayerCard(null);

    // ⭐️ 전투 시작 시 웅장한 BGM 재생
    if (bgmRef.current) {
      bgmRef.current.play().catch((e) => console.log('BGM 재생 차단됨:', e)); 
    }
  };

  const selectCardFromHand = (card: DeckMonster) => {
    if (turnState !== 'IDLE') return;
    setActivePlayerCard(card);
    setTurnState('DIFFICULTY_SELECT');
    playSynthSound('click');
  };

  const selectDifficulty = (level: Difficulty, multiplier: number) => {
    setSpellMultiplier(multiplier);
    const types: ('ADD' | 'SUB' | 'MUL')[] = level === 'LEVEL_3' ? ['MUL'] : ['ADD', 'SUB'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    setAttackProblem(generateProblem(randomType, level));
    setAttackInput('');
    setTurnState('CHARGING');
    playSynthSound('magic'); 
  };

  const handleClash = (isCrit: boolean) => {
    setTurnState('CLASHING');
    playSynthSound('swing');
    
    setTimeout(() => {
      const pCard = activePlayerCard;
      const oCard = opponentDeck[currentTurn];
      if(!pCard || !oCard) {
        setTurnState('IDLE');
        return;
      }
      
      const pMultiplier = getTypeMultiplier(pCard.type || '', oCard.type || '');
      const oMultiplier = getTypeMultiplier(oCard.type || '', pCard.type || '');
      const isOCrit = Math.random() < 0.15; 

      const pBaseHp = pCard.hp * pActiveSynergy.buffHp;
      const pBaseAtk = pCard.attack * pActiveSynergy.buffAtk;
      const oBaseHp = oCard.hp * oSynergy.buffHp;
      const oBaseAtk = oCard.attack * oSynergy.buffAtk;

      const pCritMult = isCrit ? spellMultiplier : 0.5;
      const pPower = Math.round((pBaseHp + pBaseAtk) * pMultiplier * pCritMult);
      const oPower = Math.round((oBaseHp + oBaseAtk) * oMultiplier * (isOCrit ? 1.5 : 1));

      const newFloats = [];
      if (pMultiplier > 1) newFloats.push({ id: 1, text: "🔥 상성 우위!", color: "text-green-400" });
      
      if (isCrit) {
        newFloats.push({ id: 2, text: `마법 발동! (${spellMultiplier}배)`, color: "text-yellow-400", large: true });
        playSynthSound('critical');
      } else {
        newFloats.push({ id: 2, text: "마법 실패... (0.5배)", color: "text-gray-400" });
        playSynthSound('hit');
      }
      
      newFloats.push({ id: 3, text: `${pPower} DMG`, color: "text-blue-400", large: true });
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
      
      // ⭐️ 결과창 진입 시 BGM 정지
      if (bgmRef.current) {
        bgmRef.current.pause();
      }

      if (playerScore > opponentScore) {
        playSynthSound('win');
        confetti({ particleCount: 300, spread: 150, origin: { y: 0.5 }, zIndex: 100 });
      } else {
        playSynthSound('lose');
      }
    } else {
      const newHand = playerHand.filter(c => c.instanceId !== activePlayerCard?.instanceId);
      if (playerDeck.length > 0) {
        newHand.push(playerDeck[0]);
        setPlayerDeck(playerDeck.slice(1));
      }
      setPlayerHand(newHand);
      setActivePlayerCard(null);

      setCurrentTurn(c => c + 1);
      setTurnResult(null);
      setTurnState('IDLE');
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md">
        <div className="text-6xl animate-spin mb-6">📡</div>
        <h2 className="text-2xl font-black text-white animate-pulse">통신 위성 연결 중...</h2>
        <p className="text-gray-400 mt-2">몬스터 데이터를 불러오고 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-hidden touch-none">
      <button onClick={onClose} className="absolute top-6 right-6 text-4xl text-white hover:text-red-400 transition-transform hover:scale-110 z-[60]">
        ✖
      </button>

      <AnimatePresence>
        {showSynergyHint && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute z-[100] top-24 bg-gray-800 border-2 border-yellow-400 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-white">
            <div className="flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
              <h3 className="text-xl font-black text-yellow-300">⚔️ 배틀 시너지 가이드</h3>
              <button onClick={() => setShowSynergyHint(false)} className="text-gray-400 hover:text-white text-2xl font-bold">✖</button>
            </div>
            <ul className="space-y-3 text-sm font-bold">
              <li className="flex justify-between"><span>🔥 불꽃 타입 3마리</span> <span className="text-red-400">공격력 +20%</span></li>
              <li className="flex justify-between"><span>💧 물 타입 3마리</span> <span className="text-blue-400">HP +20%</span></li>
              <li className="flex justify-between"><span>🌿 풀 타입 3마리</span> <span className="text-green-400">HP & 공격력 +10%</span></li>
              <li className="flex justify-between"><span>⚡ 전기 타입 3마리</span> <span className="text-yellow-400">공격력 +25%</span></li>
              <li className="flex justify-between"><span>🐉 드래곤 타입 2마리</span> <span className="text-purple-400">HP & 공격력 +15%</span></li>
              <li className="flex justify-between"><span>⚪ 노말 타입 4마리</span> <span className="text-gray-300">HP +30%</span></li>
              <li className="flex justify-between border-t border-gray-600 pt-2 mt-2"><span>🌟 원소 지배 (5종류 이상)</span> <span className="text-yellow-300">전체 스탯 +20%</span></li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {turnState === 'DIFFICULTY_SELECT' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <h2 className="text-3xl font-black text-white mb-8 text-center drop-shadow-lg">
              어떤 마법을 사용할까? 🔮<br/><span className="text-lg text-gray-300 font-bold mt-2 block">어려운 마법일수록 데미지가 강력해져!</span>
            </h2>
            <div className="flex flex-col gap-4 w-full max-w-sm">
              <button onClick={() => selectDifficulty('LEVEL_1', 1.5)} className="bg-green-500 hover:bg-green-400 text-white font-black py-4 px-6 rounded-2xl shadow-[0_5px_0_rgba(21,128,61,1)] active:translate-y-1 active:shadow-none flex justify-between items-center transition-all">
                <span>🟢 일반 마법 (1단계)</span><span className="bg-green-700 px-3 py-1 rounded-lg text-sm">데미지 1.5배</span>
              </button>
              <button onClick={() => selectDifficulty('LEVEL_2', 2.0)} className="bg-yellow-500 hover:bg-yellow-400 text-white font-black py-4 px-6 rounded-2xl shadow-[0_5px_0_rgba(161,98,7,1)] active:translate-y-1 active:shadow-none flex justify-between items-center transition-all">
                <span>🟡 강력 마법 (2단계)</span><span className="bg-yellow-700 px-3 py-1 rounded-lg text-sm">데미지 2.0배</span>
              </button>
              <button onClick={() => selectDifficulty('LEVEL_3', 3.0)} className="bg-red-500 hover:bg-red-400 text-white font-black py-4 px-6 rounded-2xl shadow-[0_5px_0_rgba(153,27,27,1)] active:translate-y-1 active:shadow-none flex justify-between items-center transition-all">
                <span>🔴 초필살기 (구구단)</span><span className="bg-red-700 px-3 py-1 rounded-lg text-sm">데미지 3.0배!</span>
              </button>
              <button onClick={() => { setActivePlayerCard(null); setTurnState('IDLE'); }} className="mt-4 text-gray-400 font-bold underline">← 다시 카드 고르기</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {turnState === 'CHARGING' && attackProblem && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <h2 className="text-3xl font-black text-yellow-400 mb-6 animate-pulse drop-shadow-lg text-center">
            마법 주문 충전 중...! ✨
          </h2>
          <div className="text-6xl font-mono font-black text-white mb-8 border-4 border-yellow-400 bg-indigo-700/80 p-6 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.5)]">
            {attackProblem.operandA} {attackProblem.type === 'ADD' ? '+' : attackProblem.type === 'SUB' ? '-' : 'x'} {attackProblem.operandB} = <span className="text-yellow-300">{attackInput || '?'}</span>
          </div>
          <NumberPad
            onInput={(num) => setAttackInput(p => (p.length < 3 ? p + num : p))}
            onDelete={() => setAttackInput(p => p.slice(0, -1))}
            onEnter={() => {
              if (!attackInput) return;
              const isCorrect = parseInt(attackInput) === attackProblem.answer;
              setAttackProblem(null); 
              handleClash(isCorrect); 
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {(stage === 'BATTLING' || stage === 'RESULT') && (
          <motion.div initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="absolute top-6 flex gap-6 items-center bg-black/60 px-6 py-2 rounded-full border border-gray-600 shadow-2xl z-40">
            <div className="text-center">
              <div className="text-blue-400 font-black text-xs mb-1">YOU</div>
              <div className="text-3xl font-black text-white drop-shadow-md">{playerScore}</div>
            </div>
            <div className="text-xl font-bold text-gray-500">VS</div>
            <div className="text-center">
              <div className="text-red-400 font-black text-xs mb-1">{opponent?.name || 'ENEMY'}</div>
              <div className="text-3xl font-black text-white drop-shadow-md">{opponentScore}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {stage === 'SELECT' && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full max-w-4xl">
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
          <motion.div key="deck-building" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col h-full w-full max-w-6xl py-10">
            <div className="bg-gray-800 border-2 border-yellow-500 rounded-2xl p-4 mb-6 shadow-lg text-center flex flex-col items-center relative">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-yellow-400 font-black text-lg">✨ 발동 중인 시너지</h3>
                <button onClick={() => setShowSynergyHint(true)} className="bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-yellow-500 transition-colors">ℹ️</button>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {pSynergy.activeSynergies.length > 0 ? (
                  pSynergy.activeSynergies.map((syn, idx) => (
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

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide items-center">
              {Array.from({ length: 10 }).map((_, i) => {
                const card = selectedCards[i];
                return (
                  <div key={`slot-${i}`} onClick={() => card && toggleCardSelection(card)} 
                    className={`relative min-w-[70px] h-24 md:min-w-[90px] md:h-32 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${card ? 'bg-blue-50 border-blue-400 shadow-inner hover:border-red-400' : 'bg-gray-800/50 border-gray-600 border-dashed'}`}>
                    {card ? (
                      <>
                        {card.level > 0 && <span className="absolute -top-2 -left-2 text-[9px] bg-yellow-400 text-yellow-900 font-black px-1.5 py-0.5 rounded-full z-10 shadow">+{card.level}</span>}
                        <div className="relative w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white rounded-full shadow-sm mb-1">
                          {card.image ? <Image src={card.image} alt={card.name} fill className="object-contain p-1 drop-shadow-md" /> : <span className="text-xl text-gray-400">❔</span>}
                        </div>
                        <span className="text-[9px] md:text-[10px] font-black text-gray-800 truncate w-[90%] text-center">{card.name}</span>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs font-bold">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-gray-700 w-full my-4"></div>

            <h3 className="text-gray-400 font-bold mb-4">보유 몬스터 (클릭하여 추가/제거)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 overflow-y-auto flex-1 custom-scrollbar pb-10 content-start">
              {myInventoryCards.map((card) => {
                const isSelected = selectedCards.some(c => c.instanceId === card.instanceId);
                return (
                  <motion.div 
                    key={card.instanceId} 
                    whileHover={{ scale: 1.05 }}
                    onClick={() => toggleCardSelection(card)}
                    className={`bg-white p-2 rounded-xl border-2 cursor-pointer relative transition-all flex flex-col items-center justify-between aspect-[3/4] ${isSelected ? 'border-red-500 opacity-50 grayscale' : 'border-gray-200 hover:border-blue-400 shadow-md'}`}
                  >
                    {card.level > 0 && <span className="absolute -top-2 -left-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-1.5 py-0.5 rounded-full z-20 shadow">+{card.level}</span>}
                    {isSelected && <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/10 rounded-xl"><span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">선택됨</span></div>}
                    
                    <div className="relative w-full flex-1 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden mt-1 min-h-0">
                      {card.image ? (
                        <Image src={card.image} alt={card.name} fill className="object-contain p-1" />
                      ) : (
                        <span className="text-3xl text-gray-300">❔</span>
                      )}
                    </div>
                    
                    <div className="text-center w-full flex flex-col items-center h-[40px] shrink-0 justify-end mt-1">
                      <span className="text-[8px] bg-gray-100 px-1 py-0.5 rounded font-bold text-gray-500 mb-0.5">{card.type ? card.type.split('/')[0] : '❔'}</span>
                      <h3 className="font-black text-[10px] text-gray-800 w-full truncate leading-tight">{card.name}</h3>
                      <div className="flex gap-1 mt-0.5 text-[8px] font-bold text-gray-400 leading-tight">
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

        {stage === 'READY' && (
          <motion.div key="ready" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} className="text-center">
            <div className="text-6xl mb-6">🃏</div>
            <h2 className="text-4xl font-black text-white mb-4 leading-tight">상대의 속성을 파악하고<br/>유리한 카드를 내세요!</h2>
            <button onClick={startBattle} className="mt-8 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-2xl py-4 px-12 rounded-full shadow-[0_0_40px_rgba(59,130,246,0.8)] hover:scale-105 active:scale-95 transition-all">
              아레나 입장 🔥
            </button>
          </motion.div>
        )}

        {stage === 'BATTLING' && (
          <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-between w-full h-full relative pt-20 pb-4">
            
            {opponentDeck[currentTurn] && (
              <div className="flex flex-col items-center w-full z-10">
                <div className="bg-red-950/80 text-red-300 font-bold px-4 py-1 rounded-full mb-2 text-sm border border-red-800 flex items-center gap-2">
                  <span className="animate-pulse">🔥</span> 상대의 {currentTurn + 1}번째 몬스터
                </div>
                <BattleCard 
                  monster={opponentDeck[currentTurn]} 
                  isOpponent 
                  turnState={turnState}
                  isDefeated={turnResult === 'WIN'} 
                  buffHp={oSynergy.buffHp}
                  buffAtk={oSynergy.buffAtk}
                />
              </div>
            )}

            <div className="flex-1 flex items-center justify-center relative w-full h-32 my-4">
              <AnimatePresence>
                {floatingTexts.map((float, index) => (
                  <motion.div key={float.id} initial={{ scale: 0, y: 50, opacity: 0 }} animate={{ scale: 1, y: -20 - (index * 30), opacity: 1 }} exit={{ opacity: 0, y: -100 }} transition={{ type: "spring", bounce: 0.5, delay: index * 0.1 }}
                    className={`absolute font-black drop-shadow-[0_5px_5px_rgba(0,0,0,1)] ${float.color} ${float.large ? 'text-4xl md:text-5xl' : 'text-xl md:text-2xl'}`}
                  >
                    {float.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {turnState === 'DONE' && turnResult && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.2, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} 
                    className={`absolute font-black text-6xl md:text-7xl italic drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] whitespace-nowrap z-20 ${turnResult === 'WIN' ? 'text-blue-400' : turnResult === 'LOSE' ? 'text-red-500' : 'text-gray-400'}`}
                  >
                    {turnResult === 'WIN' ? '격파!' : turnResult === 'LOSE' ? '패배' : '무승부'}
                  </motion.div>
                )}
              </AnimatePresence>

              {turnState === 'DONE' && (
                <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onClick={handleNextTurn} 
                  className="absolute z-30 bg-white text-blue-600 font-black text-xl py-4 px-8 rounded-full shadow-[0_5px_0_rgba(147,197,253,1)] active:translate-y-1 active:shadow-none transition-all ring-4 ring-blue-200 mt-20"
                >
                  {currentTurn >= 9 ? '최종 결과 보기 🏆' : '다음 라운드 ⏭️'}
                </motion.button>
              )}
            </div>

            <div className="w-full flex flex-col items-center justify-end z-20 min-h-[16rem]">
              <AnimatePresence mode="popLayout">
                {activePlayerCard ? (
                  <motion.div key="active-card" initial={{ y: 100, scale: 0.5, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 200, opacity: 0 }} transition={{ type: "spring", stiffness: 200 }} className="mb-4">
                    <BattleCard 
                      monster={activePlayerCard} 
                      turnState={turnState}
                      isDefeated={turnResult === 'LOSE'}
                      buffHp={pActiveSynergy.buffHp}
                      buffAtk={pActiveSynergy.buffAtk}
                      scale={1.2}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="hand" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="w-full">
                    <div className="text-center text-yellow-300 font-black mb-3 drop-shadow-md text-sm md:text-base animate-pulse bg-black/40 inline-block px-4 py-1 rounded-full mx-auto flex w-fit">
                      상성을 보고 카드를 선택하세요! (남은 카드: {playerDeck.length}장)
                    </div>
                    <div className="flex justify-center gap-2 md:gap-4 w-full px-2">
                      {playerHand.map((card) => (
                         <BattleCard 
                           key={card.instanceId} 
                           monster={card} 
                           turnState="IDLE" 
                           isDefeated={false} 
                           onClick={() => selectCardFromHand(card)}
                           isSelectable={true}
                           buffHp={pActiveSynergy.buffHp}
                           buffAtk={pActiveSynergy.buffAtk}
                           scale={0.9}
                         />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="text-center bg-gray-800 p-12 rounded-[3rem] shadow-2xl relative overflow-hidden border-4 border-gray-600 z-50">
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