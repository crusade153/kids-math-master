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
import { supabase } from '@/lib/supabase';

interface BattleArenaProps {
  onClose: () => void;
  onlineUsers?: string[];
  initialOpponentId?: string;
  isHost?: boolean;
  roomId?: string;
}

type DeckMonster = Monster & { instanceId: string; level: number };

// 속성 상성 계산 (상성 시 데미지 1.5배, 역상성 시 0.5배)
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
    const type = m?.type ? m.type.split('/')[0].trim() : '노말';
    counts[type] = (counts[type] || 0) + 1;
  });

  let buffHp = 1.0;
  let buffAtk = 1.0;
  if ((counts['불꽃'] || 0) >= 3) { buffAtk += 0.2; }
  if ((counts['물'] || 0) >= 3) { buffHp += 0.2; }
  if ((counts['풀'] || 0) >= 3) { buffHp += 0.1; buffAtk += 0.1; }
  if ((counts['전기'] || 0) >= 3) { buffAtk += 0.25; }
  if ((counts['드래곤'] || 0) >= 2) { buffHp += 0.15; buffAtk += 0.15; }
  if ((counts['노말'] || 0) >= 4) { buffHp += 0.3; }
  if (Object.keys(counts).length >= 5) { buffHp += 0.2; buffAtk += 0.2; }

  return { buffHp, buffAtk };
};

// 배열 파싱 안전 함수 (에러 원천 차단)
const parseInventory = (inv: any): string[] => {
  if (!inv) return [];
  if (Array.isArray(inv)) return inv.map(item => String(item).trim());
  if (typeof inv === 'string') return inv.replace(/[{}[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const playSynthSound = (type: 'hit' | 'magic' | 'win' | 'lose') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'magic') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.3); gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'hit') {
      osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1); gainNode.gain.setValueAtTime(0.4, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'win') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554, now + 0.15); osc.frequency.setValueAtTime(659, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.6); osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'lose') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.linearRampToValueAtTime(100, now + 0.5); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.5); osc.start(now); osc.stop(now + 0.5);
    }
  } catch (e) {}
};

const BattleCard = ({ monster, isOpponent, isSelectable, onClick, scale = 1, isHidden = false }: any) => {
  if (!monster) return null;
  return (
    <motion.div
      onClick={isSelectable ? onClick : undefined}
      whileHover={isSelectable ? { scale: scale * 1.05, y: -10 } : {}}
      initial={{ opacity: 0, rotateY: 180 }}
      animate={{ opacity: 1, rotateY: 0, scale: scale }}
      className={`bg-white rounded-3xl p-3 md:p-4 shadow-xl flex flex-col items-center border-[3px] aspect-[3/4] relative overflow-hidden ${isSelectable ? 'cursor-pointer hover:border-yellow-400' : ''} ${isOpponent ? 'border-red-500 w-28 md:w-36' : 'border-blue-500 w-28 md:w-36'}`}
    >
      {isHidden ? (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center z-20">
          <span className="text-5xl animate-pulse">❓</span>
        </div>
      ) : (
        <>
          <div className="absolute top-2 right-2 bg-gray-100 text-[9px] font-black px-2 py-0.5 rounded shadow z-10">{monster.type ? monster.type.split('/')[0] : '❔'}</div>
          {monster.level > 0 && <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded-full shadow z-10">+{monster.level}</div>}
          <div className="relative w-full flex-1 flex items-center justify-center mt-3 pointer-events-none">
            {monster.image ? <Image src={monster.image} alt={monster.name || 'monster'} fill className="object-contain drop-shadow-lg" /> : <div className="text-3xl">❔</div>}
          </div>
          <div className="w-full text-center mt-2 h-10 flex flex-col justify-end">
            <h3 className="font-black text-gray-800 text-xs md:text-sm truncate w-full">{monster.name}</h3>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default function BattleArena({ onClose, onlineUsers = [], initialOpponentId, isHost = true, roomId }: BattleArenaProps) {
  const { currentUser } = useGameStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [battleMode, setBattleMode] = useState<'BOT' | 'PVP' | null>(null);
  const [pvpChannel, setPvpChannel] = useState<any>(null);

  const [opponent, setOpponent] = useState<UserProfile | null>(null);
  const [myInventoryCards, setMyInventoryCards] = useState<DeckMonster[]>([]);
  const [selectedCards, setSelectedCards] = useState<DeckMonster[]>([]);
  
  const [playerDeck, setPlayerDeck] = useState<DeckMonster[]>([]);
  const [playerHand, setPlayerHand] = useState<DeckMonster[]>([]);
  const [opponentDeck, setOpponentDeck] = useState<DeckMonster[]>([]);
  
  const [stage, setStage] = useState<'SELECT' | 'WAITING_ACCEPT' | 'DECK_BUILDING' | 'WAITING_OPP_DECK' | 'BATTLING' | 'RESULT'>('SELECT');
  const [turnState, setTurnState] = useState<'CARD_SELECT' | 'DIFFICULTY_SELECT' | 'MATH_SOLVE' | 'WAITING_OPP_MATH' | 'CLASHING' | 'DONE'>('CARD_SELECT');
  
  const [activePlayerCard, setActivePlayerCard] = useState<DeckMonster | null>(null);
  const [activeOpponentCard, setActiveOpponentCard] = useState<DeckMonster | null>(null);
  
  const [spellMultiplier, setSpellMultiplier] = useState(1);
  const [attackProblem, setAttackProblem] = useState<MathProblem | null>(null);
  const [attackInput, setAttackInput] = useState('');

  const [myBasePower, setMyBasePower] = useState<number | null>(null);
  const [oppBasePower, setOppBasePower] = useState<number | null>(null);
  
  const [currentTurn, setCurrentTurn] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  
  const [floatingTexts, setFloatingTexts] = useState<{id: number, text: string, color: string, large?: boolean}[]>([]);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const pActiveSynergy = calculateSynergy(playerDeck.concat(playerHand)); 
  const oSynergy = calculateSynergy(opponentDeck);

  useEffect(() => {
    bgmRef.current = new Audio('/sounds/battle-bgm.mp3'); 
    bgmRef.current.loop = true; 
    bgmRef.current.volume = 0.4;
    return () => {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.currentTime = 0; }
      if (pvpChannel) supabase.removeChannel(pvpChannel);
    };
  }, []);

  useEffect(() => {
    Promise.all([getUsers(), getMonsters()]).then(([usersData, monstersData]) => {
      setUsers(usersData.filter(u => u.id !== currentUser?.id));
      setAllMonsters(monstersData);
      setIsDataLoaded(true);
    });
  }, [currentUser]);

  // 초대 받고 들어온 경우
  useEffect(() => {
    if (isDataLoaded && initialOpponentId && roomId && !isHost && users.length > 0) {
      const opp = users.find(u => u.id === initialOpponentId);
      if (opp) {
        setOpponent(opp);
        setBattleMode('PVP');
        initPvpChannel(roomId);
        setStage('DECK_BUILDING');
      }
    }
  }, [isDataLoaded, initialOpponentId, roomId, users, isHost]);

  // ⭐️ 덱 빌딩 진입 시 내 인벤토리 파싱 (에러 방어)
  useEffect(() => {
    if (stage === 'DECK_BUILDING' && currentUser && allMonsters.length > 0) {
      const invArray = parseInventory(currentUser.inventory);
      const myCards = invArray.map((invId, index) => {
        const [baseId, lvlStr] = String(invId).split('_'); 
        const level = parseInt(lvlStr || '0', 10);
        const m = allMonsters.find(x => x.id === baseId);
        if (!m) return null;
        const buff = 1 + (0.2 * level);
        return { ...m, hp: Math.round(m.hp * buff), attack: Math.round(m.attack * buff), name: level > 0 ? `${m.name} +${level}` : m.name, instanceId: `my-${invId}-${index}`, level };
      }).filter(Boolean) as DeckMonster[];
      
      while(myCards.length < 10) {
        const fallback = allMonsters[0] || { id: 'fallback', name: '더미', rarity: 'COMMON', type: '노말', hp: 100, attack: 10 };
        myCards.push({ ...fallback, instanceId: `fallback-${Math.random()}`, level: 0 });
      }
      setMyInventoryCards(myCards);
    }
  }, [stage, currentUser, allMonsters]);

  // 양쪽 카드 선택 및 수학 풀이가 끝났을 때 승패 판정
  useEffect(() => {
    if (turnState === 'WAITING_OPP_MATH' && myBasePower !== null && oppBasePower !== null && activeOpponentCard !== null) {
      executeClash();
    }
  }, [turnState, myBasePower, oppBasePower, activeOpponentCard]);

  const handleSelectOpponent = (selectedUser: UserProfile) => {
    setOpponent(selectedUser);
    if (onlineUsers.includes(selectedUser.id)) {
      setBattleMode('PVP');
      const newRoomId = `${currentUser?.id}_${selectedUser.id}`;
      initPvpChannel(newRoomId);
      setStage('WAITING_ACCEPT');
      supabase.channel('global_lobby').send({
        type: 'broadcast', event: 'battle_invite',
        payload: { hostId: currentUser?.id, hostName: currentUser?.name, targetId: selectedUser.id }
      });
    } else {
      setBattleMode('BOT');
      setStage('DECK_BUILDING');
    }
  };

  const initPvpChannel = (room: string) => {
    const chan = supabase.channel(`battle_${room}`, { config: { presence: { key: currentUser?.id } } });

    chan.on('presence', { event: 'sync' }, () => {
      const state = chan.presenceState();
      if (Object.keys(state).length >= 2 && isHost) setStage('DECK_BUILDING');
    });

    chan.on('broadcast', { event: 'deck_ready' }, (p) => {
      setOpponentDeck(p.payload.deck);
      setStage((prev) => prev === 'WAITING_OPP_DECK' ? 'BATTLING' : prev);
    });

    chan.on('broadcast', { event: 'turn_ready' }, (p) => {
      setActiveOpponentCard(p.payload.card);
      setOppBasePower(p.payload.basePower);
    });

    chan.on('presence', { event: 'leave' }, () => {
       if (stage === 'BATTLING' || stage === 'WAITING_OPP_MATH') {
          alert("상대방이 접속을 종료했습니다! 자동 승리 🏆");
          setPlayerScore(99999);
          showResultScreen();
       }
    });

    chan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await chan.track({ ready: true });
    });

    setPvpChannel(chan);
  };

  const toggleCardSelection = (card: DeckMonster) => {
    if (selectedCards.find(c => c.instanceId === card.instanceId)) {
      setSelectedCards(prev => prev.filter(c => c.instanceId !== card.instanceId));
    } else {
      if (selectedCards.length < 10) setSelectedCards(prev => [...prev, card]);
    }
  };

  const handleDeckSubmit = () => {
    const shuffled = [...selectedCards].sort(() => Math.random() - 0.5);
    setPlayerHand(shuffled.slice(0, 3));
    setPlayerDeck(shuffled.slice(3));

    if (battleMode === 'PVP') {
      pvpChannel?.send({ type: 'broadcast', event: 'deck_ready', payload: { deck: shuffled } });
      if (opponentDeck.length === 10) startBattle();
      else setStage('WAITING_OPP_DECK');
    } else {
      const oppInv = parseInventory(opponent?.inventory);
      const oppCards = oppInv.map(invId => {
        const [baseId, lvlStr] = String(invId).split('_');
        const m = allMonsters.find(x => x.id === baseId);
        if (!m) return null;
        return { ...m, hp: m.hp * (1 + 0.2 * parseInt(lvlStr||'0')), attack: m.attack * (1 + 0.2 * parseInt(lvlStr||'0')), level: parseInt(lvlStr||'0') };
      }).filter(Boolean) as DeckMonster[];
      
      const pool = oppCards.length > 0 ? oppCards : allMonsters;
      const finalOppDeck = Array.from({ length: 10 }).map((_, i) => ({ ...pool[Math.floor(Math.random() * pool.length)], instanceId: `opp-${i}` }));
      setOpponentDeck(finalOppDeck);
      startBattle();
    }
  };

  const startBattle = () => {
    setStage('BATTLING');
    setTurnState('CARD_SELECT');
    if (bgmRef.current) bgmRef.current.play().catch(() => {});
  };

  const handleMathSolved = (isCorrect: boolean) => {
    if (!activePlayerCard) return;
    setAttackProblem(null);
    setAttackInput('');

    const basePower = Math.round((activePlayerCard.hp * pActiveSynergy.buffHp + activePlayerCard.attack * pActiveSynergy.buffAtk) * (isCorrect ? spellMultiplier : 0.5));
    setMyBasePower(basePower);

    if (isCorrect) playSynthSound('magic'); else playSynthSound('hit');

    if (battleMode === 'PVP') {
      setTurnState('WAITING_OPP_MATH');
      pvpChannel?.send({ type: 'broadcast', event: 'turn_ready', payload: { card: activePlayerCard, basePower } });
    } else {
      // 봇 대결 시 상대 카드 1장 비공개로 꺼냄 (실제론 바로 연산)
      const botCard = opponentDeck[currentTurn];
      const botBasePower = Math.round((botCard.hp * oSynergy.buffHp + botCard.attack * oSynergy.buffAtk) * (Math.random() < 0.3 ? 2.0 : 1));
      setActiveOpponentCard(botCard);
      setOppBasePower(botBasePower);
      setTurnState('WAITING_OPP_MATH'); 
    }
  };

  const executeClash = () => {
    setTurnState('CLASHING');
    playSynthSound('hit');
    
    const pMulti = getTypeMultiplier(activePlayerCard!.type || '', activeOpponentCard!.type || '');
    const oMulti = getTypeMultiplier(activeOpponentCard!.type || '', activePlayerCard!.type || '');

    const finalMyDmg = Math.round(myBasePower! * pMulti);
    const finalOppDmg = Math.round(oppBasePower! * oMulti);

    const floats = [];
    if (pMulti > 1) floats.push({ id: 1, text: "🔥 내 상성 우위!", color: "text-blue-400" });
    if (oMulti > 1) floats.push({ id: 2, text: "💀 적 상성 우위!", color: "text-red-400" });
    
    if (finalMyDmg > finalOppDmg) floats.push({ id: 3, text: "⚔️ 턴 승리!", color: "text-yellow-400", large: true });
    else if (finalMyDmg < finalOppDmg) floats.push({ id: 4, text: "🛡️ 턴 패배", color: "text-gray-400", large: true });
    else floats.push({ id: 5, text: "🤝 무승부", color: "text-white", large: true });

    setFloatingTexts(floats);
    setPlayerScore(p => p + finalMyDmg);
    setOpponentScore(p => p + finalOppDmg);

    setTimeout(() => { setTurnState('DONE'); }, 2000); 
  };

  const advanceNextTurn = () => {
    setFloatingTexts([]);
    setMyBasePower(null);
    setOppBasePower(null);
    setActiveOpponentCard(null);

    const newHand = playerHand.filter(c => c.instanceId !== activePlayerCard?.instanceId);
    if (playerDeck.length > 0) { newHand.push(playerDeck[0]); setPlayerDeck(playerDeck.slice(1)); }
    setPlayerHand(newHand);
    setActivePlayerCard(null);

    if (currentTurn >= 9) {
      showResultScreen();
    } else {
      setCurrentTurn(c => c + 1);
      setTurnState('CARD_SELECT');
    }
  };

  const showResultScreen = () => {
    if (bgmRef.current) bgmRef.current.pause();
    setStage('RESULT');
    if (playerScore >= opponentScore) {
      playSynthSound('win');
      confetti({ particleCount: 300, spread: 150, origin: { y: 0.5 }, zIndex: 100 });
    } else {
      playSynthSound('lose');
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="fixed inset-0 bg-gray-900/95 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-md">
        <div className="text-6xl animate-spin mb-6">📡</div>
        <h2 className="text-2xl font-black text-white animate-pulse">데이터 로딩 중...</h2>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-hidden touch-none">
      
      {/* ⭐️ 절대 씹히지 않는 최상단 X 버튼 */}
      <button 
        onClick={onClose} 
        className="fixed top-6 right-6 text-5xl text-white hover:text-red-500 transition-transform z-[99999] cursor-pointer drop-shadow-md bg-black/20 rounded-full w-14 h-14 flex items-center justify-center"
      >
        ✖
      </button>

      <AnimatePresence mode="wait">
        
        {stage === 'SELECT' && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full max-w-4xl h-full py-12 overflow-y-auto custom-scrollbar pt-20">
            <h2 className="text-4xl font-black text-white mb-8 drop-shadow-lg">⚔️ 대결할 상대를 선택하세요!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pb-20">
              {users.map((user) => {
                const isOnline = onlineUsers.includes(user.id);
                return (
                  <motion.button key={user.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleSelectOpponent(user)}
                    className={`bg-gray-800 p-6 rounded-3xl shadow-xl flex flex-col items-center border-4 transition-colors ${isOnline ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'border-gray-600 hover:border-blue-400'}`}
                  >
                    <div className="text-5xl mb-4">{user.id === 'user3' ? '👑' : '👦'}</div>
                    <h3 className="text-2xl font-bold text-white">{user.name}</h3>
                    {isOnline ? (
                      <span className="bg-green-100 text-green-700 font-black mt-3 px-3 py-1 rounded-full flex items-center gap-2 animate-pulse text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span> 온라인 (실시간)
                      </span>
                    ) : (
                      <span className="bg-gray-700 text-gray-400 font-bold mt-3 px-3 py-1 rounded-full text-sm">오프라인 (봇 전투)</span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}

        {stage === 'WAITING_ACCEPT' && (
          <motion.div key="wait-accept" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <div className="text-7xl mb-6 animate-bounce">📨</div>
            <h2 className="text-4xl font-black text-white mb-4 leading-tight">{opponent?.name}님에게<br/>초대장을 보냈습니다!</h2>
            <p className="text-yellow-300 font-bold mb-8">상대방이 수락할 때까지 기다려주세요...</p>
          </motion.div>
        )}

        {stage === 'DECK_BUILDING' && (
          <motion.div key="deck" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col h-full w-full max-w-6xl py-10 pt-16">
            <div className="mb-4 flex justify-between items-end">
              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-black text-white mb-2 inline-block ${battleMode === 'PVP' ? 'bg-red-500' : 'bg-gray-600'}`}>
                  {battleMode === 'PVP' ? '🔥 실시간 멀티플레이' : '🤖 봇(AI) 대결'}
                </span>
                <h3 className="text-white font-black text-2xl">내 덱 편성 ({selectedCards.length}/10)</h3>
              </div>
              <button onClick={handleDeckSubmit} disabled={selectedCards.length !== 10} className={`font-black py-3 px-8 rounded-full transition-all shadow-lg ${selectedCards.length === 10 ? 'bg-blue-500 text-white hover:scale-105' : 'bg-gray-700 text-gray-500'}`}>
                배틀 출전! ⚔️
              </button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide items-center">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={`slot-${i}`} onClick={() => selectedCards[i] && toggleCardSelection(selectedCards[i])} 
                  className={`min-w-[70px] h-24 md:min-w-[90px] md:h-32 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${selectedCards[i] ? 'bg-blue-50 border-blue-400' : 'bg-gray-800/50 border-gray-600 border-dashed'}`}>
                  {selectedCards[i] ? (
                    <span className="text-[10px] font-black text-gray-800 w-[90%] truncate text-center">{selectedCards[i].name}</span>
                  ) : (
                    <span className="text-gray-500 text-xs">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="h-px bg-gray-700 w-full my-4"></div>
            
            <h3 className="text-gray-400 font-bold mb-4">보유 몬스터 (클릭하여 추가/제거)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 overflow-y-auto flex-1 custom-scrollbar pb-10 content-start">
              {myInventoryCards && myInventoryCards.map((card) => {
                if (!card) return null; // 빈 데이터 방어
                const isSelected = selectedCards.some(c => c.instanceId === card.instanceId);
                return (
                  <motion.div key={card.instanceId} whileHover={{ scale: 1.05 }} onClick={() => toggleCardSelection(card)}
                    className={`bg-white p-2 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center aspect-[3/4] ${isSelected ? 'border-red-500 opacity-50' : 'border-gray-200'}`}>
                    <div className="relative w-full flex-1 mb-1">
                      {card.image ? <Image src={card.image} alt={card.name || 'card'} fill className="object-contain" /> : <div className="text-3xl text-center">❔</div>}
                    </div>
                    <span className="font-black text-[10px] truncate w-full text-center">{card.name}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {stage === 'WAITING_OPP_DECK' && (
          <motion.div key="wait-deck" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white">
            <div className="text-6xl mb-4 animate-spin">⏳</div>
            <h2 className="text-3xl font-black mb-2">상대방이 카드를 고르고 있습니다...</h2>
          </motion.div>
        )}

        {/* 메인 전투 무대 */}
        {stage === 'BATTLING' && (
          <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-between w-full h-full pt-16 pb-4 relative">
            
            <div className="w-full px-6 flex justify-between items-center z-40 max-w-4xl mb-4">
              <div className="bg-blue-600/80 px-6 py-3 rounded-2xl shadow-xl border-2 border-blue-400">
                <p className="text-blue-200 font-bold text-xs">내 누적 점수</p>
                <p className="text-white font-black text-3xl">{playerScore.toLocaleString()}</p>
              </div>
              <div className="text-yellow-300 font-black text-xl bg-black/40 px-6 py-2 rounded-full border border-yellow-600">
                라운드 {currentTurn + 1} / 10
              </div>
              <div className="bg-red-600/80 px-6 py-3 rounded-2xl shadow-xl border-2 border-red-400 text-right">
                <p className="text-red-200 font-bold text-xs">{opponent?.name} 누적 점수</p>
                <p className="text-white font-black text-3xl">{opponentScore.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center items-center w-full relative">
              <div className="flex gap-10 items-center justify-center w-full">
                
                <div className="flex flex-col items-center flex-1">
                  <span className="text-blue-400 font-bold mb-2">내 몬스터</span>
                  {activePlayerCard ? (
                    <motion.div animate={turnState === 'CLASHING' ? { x: [0, 50, 0] } : {}}>
                      <BattleCard monster={activePlayerCard} scale={1.2} />
                    </motion.div>
                  ) : (
                    <div className="w-28 h-36 border-4 border-dashed border-gray-600 rounded-3xl flex items-center justify-center text-gray-500 font-bold">선택 대기중</div>
                  )}
                </div>

                <div className="text-4xl font-black text-gray-600 italic px-4">VS</div>

                <div className="flex flex-col items-center flex-1">
                  <span className="text-red-400 font-bold mb-2">적 몬스터</span>
                  {activeOpponentCard || battleMode === 'BOT' ? (
                    <motion.div animate={turnState === 'CLASHING' ? { x: [0, -50, 0] } : {}}>
                      <BattleCard monster={activeOpponentCard || opponentDeck[currentTurn]} isOpponent scale={1.2} isHidden={turnState !== 'DONE' && turnState !== 'CLASHING'} />
                    </motion.div>
                  ) : (
                    <div className="w-28 h-36 border-4 border-dashed border-gray-600 rounded-3xl flex items-center justify-center">
                       <span className="animate-pulse text-gray-500 text-sm font-bold">카드 선택중...</span>
                    </div>
                  )}
                </div>

              </div>

              <AnimatePresence>
                {floatingTexts.map((float, index) => (
                  <motion.div key={float.id} initial={{ y: 50, opacity: 0 }} animate={{ y: -50 - (index * 30), opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring' }} className={`absolute font-black drop-shadow-[0_5px_5px_rgba(0,0,0,1)] z-50 ${float.color} ${float.large ? 'text-4xl md:text-5xl' : 'text-xl'}`}>
                    {float.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              {turnState === 'DONE' && (
                <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onClick={advanceNextTurn} 
                  className="absolute bottom-0 z-30 bg-white text-gray-900 font-black text-xl py-3 px-8 rounded-full shadow-[0_5px_0_rgba(209,213,219,1)] active:translate-y-1 active:shadow-none"
                >
                  {currentTurn >= 9 ? '최종 결과 확인 🏆' : '다음 라운드 ⏭️'}
                </motion.button>
              )}
            </div>

            {/* 내 패 */}
            <div className="w-full flex flex-col items-center justify-end z-20 min-h-[12rem] bg-gray-800/80 rounded-t-3xl pt-4 pb-2 border-t-4 border-gray-600">
              {turnState === 'CARD_SELECT' ? (
                <>
                  <div className="text-yellow-300 font-black mb-2 animate-pulse">출전할 카드를 고르세요! (블라인드)</div>
                  <div className="flex justify-center gap-2 md:gap-4 px-2">
                    {playerHand.map((card) => (
                       <BattleCard key={card.instanceId} monster={card} isSelectable onClick={() => { setActivePlayerCard(card); setTurnState('DIFFICULTY_SELECT'); }} scale={0.9} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-gray-400 font-bold">
                  {turnState === 'WAITING_OPP_MATH' ? '상대방이 마법을 시전할 때까지 기다리는 중...' : turnState === 'DONE' ? '결과 확인 완료!' : '마법 시전 중...'}
                </div>
              )}
            </div>

            {/* 마법 선택 모달 */}
            <AnimatePresence>
              {turnState === 'DIFFICULTY_SELECT' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <h2 className="text-3xl font-black text-white mb-8 text-center drop-shadow-lg">어떤 마법을 사용할까? 🔮</h2>
                  <div className="flex flex-col gap-4 w-full max-w-sm">
                    <button onClick={() => { setSpellMultiplier(1.5); setAttackProblem(generateProblem('ADD', 'LEVEL_1')); setTurnState('MATH_SOLVE'); }} className="bg-green-500 text-white font-black py-4 px-6 rounded-2xl">🟢 1단계 (데미지 1.5배)</button>
                    <button onClick={() => { setSpellMultiplier(2.0); setAttackProblem(generateProblem('ADD', 'LEVEL_2')); setTurnState('MATH_SOLVE'); }} className="bg-yellow-500 text-white font-black py-4 px-6 rounded-2xl">🟡 2단계 (데미지 2.0배)</button>
                    <button onClick={() => { setSpellMultiplier(3.0); setAttackProblem(generateProblem('MUL', 'LEVEL_1')); setTurnState('MATH_SOLVE'); }} className="bg-red-500 text-white font-black py-4 px-6 rounded-2xl">🔴 구구단 (데미지 3.0배)</button>
                    <button onClick={() => { setActivePlayerCard(null); setTurnState('CARD_SELECT'); }} className="mt-2 text-gray-400 font-bold underline">취소</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 수학 문제 풀이 */}
            {turnState === 'MATH_SOLVE' && attackProblem && (
              <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4">
                <div className="text-5xl font-mono font-black text-white mb-6 border-4 border-yellow-400 bg-indigo-700/80 p-6 rounded-3xl text-center">
                  {attackProblem.operandA} {attackProblem.type === 'ADD' ? '+' : attackProblem.type === 'SUB' ? '-' : 'x'} {attackProblem.operandB} = <span className="text-yellow-300">{attackInput || '?'}</span>
                </div>
                <NumberPad onInput={(num) => setAttackInput(p => p.length < 3 ? p + num : p)} onDelete={() => setAttackInput(p => p.slice(0, -1))} onEnter={() => { if (attackInput) handleMathSolved(parseInt(attackInput) === attackProblem.answer); }} />
              </div>
            )}
          </motion.div>
        )}

        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="text-center bg-gray-800 p-12 rounded-[3rem] shadow-2xl relative border-4 border-gray-600 z-50">
            <h2 className="text-5xl font-black mb-4 z-10 relative text-white">
              {playerScore > opponentScore ? '🏆 승리! 🏆' : playerScore < opponentScore ? '💀 패배' : '🤝 무승부'}
            </h2>
            <div className="text-3xl font-bold text-gray-300 mb-8">
              내 최종 점수 <span className={playerScore >= opponentScore ? "text-blue-400" : ""}>{playerScore.toLocaleString()}</span><br/>
              적 최종 점수 <span className={opponentScore >= playerScore ? "text-red-400" : ""}>{opponentScore.toLocaleString()}</span>
            </div>
            <button onClick={onClose} className="bg-white text-gray-900 font-black py-4 px-12 rounded-full text-xl hover:scale-105 transition-transform pointer-events-auto">마을로 돌아가기</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}