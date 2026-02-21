// components/game/battle-arena.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster, UserProfile } from '@/types/game';
import { MathProblem, Difficulty } from '@/types/math';
import { getUsers } from '@/actions/user-actions';
import { useGameStore } from '@/store/game-store';
import { generateProblem } from '@/lib/generator';
import NumberPad from '@/components/ui/number-pad';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';

interface BattleArenaProps {
  allMonsters: Monster[];
  onClose: () => void;
  onlineUsers?: string[];
  initialOpponentId?: string;
  isHost?: boolean;
  roomId?: string;
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

const parseInventory = (inv: any): string[] => {
  if (!inv) return [];
  if (Array.isArray(inv)) return inv.map(item => String(item).trim());
  if (typeof inv === 'string') return inv.replace(/[{}[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const playSynthSound = (type: 'hit' | 'magic' | 'win' | 'lose' | 'clash') => {
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
    } else if (type === 'clash') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now + 0.3); gainNode.gain.setValueAtTime(1.0, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'win') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554, now + 0.15); osc.frequency.setValueAtTime(659, now + 0.3); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.6); osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'lose') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.linearRampToValueAtTime(100, now + 0.5); gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.5); osc.start(now); osc.stop(now + 0.5);
    }
  } catch (e) {}
};

const FallbackImage = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800/20 rounded-lg inset-0 absolute">
    <span className="text-5xl drop-shadow-md opacity-60">❓</span>
    <span className="text-[10px] text-gray-500 font-black mt-2 bg-white/80 px-2 rounded">NO DATA</span>
  </div>
);

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
            {monster.image ? <Image src={monster.image} alt={monster.name} fill className="object-contain drop-shadow-lg" /> : <FallbackImage />}
          </div>
          <div className="w-full text-center mt-2 h-10 flex flex-col justify-end relative z-10">
            <h3 className="font-black text-gray-800 text-xs md:text-sm truncate w-full">{monster.name}</h3>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default function BattleArena({ allMonsters, onClose, onlineUsers = [], initialOpponentId, isHost = true, roomId }: BattleArenaProps) {
  const { currentUser } = useGameStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const [battleMode, setBattleMode] = useState<'BOT' | 'PVP' | null>(null);
  const [pvpChannel, setPvpChannel] = useState<any>(null);

  const [opponent, setOpponent] = useState<UserProfile | null>(null);
  const [myInventoryCards, setMyInventoryCards] = useState<DeckMonster[]>([]);
  const [selectedCards, setSelectedCards] = useState<DeckMonster[]>([]);
  
  // ⭐️ 덱 구성용 필터 상태
  const [filterRarity, setFilterRarity] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

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
  const [hitFlash, setHitFlash] = useState(false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvpChannel]);

  useEffect(() => {
    getUsers().then(data => setUsers(data.filter(u => u.id !== currentUser?.id)));
  }, [currentUser]);

  useEffect(() => {
    if (initialOpponentId && roomId && !isHost && users.length > 0) {
      const opp = users.find(u => u.id === initialOpponentId);
      if (opp) {
        setOpponent(opp);
        setBattleMode('PVP');
        initPvpChannel(roomId);
        setStage('WAITING_ACCEPT'); 
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpponentId, roomId, users, isHost]);

  useEffect(() => {
    if ((stage === 'DECK_BUILDING' || stage === 'SELECT') && currentUser && allMonsters.length > 0) {
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

  useEffect(() => {
    if (turnState === 'WAITING_OPP_MATH' && myBasePower !== null && oppBasePower !== null && activeOpponentCard !== null) {
      executeClash();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ⭐️ 버그 수정: 방 안의 인원수를 실시간으로 감지하는 Presence 방식으로 변경
  const initPvpChannel = (room: string) => {
    const chan = supabase.channel(`battle_${room}`, {
      config: { presence: { key: currentUser?.id } }
    });

    chan.on('presence', { event: 'sync' }, () => {
      const state = chan.presenceState();
      // 두 명 다 채널에 접속(Track)했다면 즉시 덱 빌딩으로 넘어갑니다.
      if (Object.keys(state).length >= 2) {
        setStage(prev => (prev === 'WAITING_ACCEPT' || prev === 'SELECT' ? 'DECK_BUILDING' : prev));
      }
    });

    chan.on('broadcast', { event: 'deck_ready' }, (p) => {
      setOpponentDeck(p.payload.deck);
      setStage((prev) => prev === 'WAITING_OPP_DECK' ? 'BATTLING' : prev);
    });

    chan.on('broadcast', { event: 'turn_ready' }, (p) => {
      setActiveOpponentCard(p.payload.card);
      setOppBasePower(p.payload.basePower);
    });

    chan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // 접속 성공 시 내 존재를 방에 알립니다.
        await chan.track({ online: true });
      }
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
      const botCard = opponentDeck[currentTurn];
      const botBasePower = Math.round((botCard.hp * oSynergy.buffHp + botCard.attack * oSynergy.buffAtk) * (Math.random() < 0.3 ? 2.0 : 1));
      setActiveOpponentCard(botCard);
      setOppBasePower(botBasePower);
      setTurnState('WAITING_OPP_MATH'); 
    }
  };

  const executeClash = () => {
    setTurnState('CLASHING');
    
    setTimeout(() => {
      setHitFlash(true);
      playSynthSound('clash');
      
      const pMulti = getTypeMultiplier(activePlayerCard!.type || '', activeOpponentCard!.type || '');
      const oMulti = getTypeMultiplier(activeOpponentCard!.type || '', activePlayerCard!.type || '');

      const finalMyDmg = Math.round(myBasePower! * pMulti);
      const finalOppDmg = Math.round(oppBasePower! * oMulti);

      const floats = [];
      if (pMulti > 1) floats.push({ id: 1, text: "🔥 내 상성 우위!", color: "text-blue-400" });
      if (oMulti > 1) floats.push({ id: 2, text: "💀 적 상성 우위!", color: "text-red-400" });
      
      if (finalMyDmg > finalOppDmg) {
        floats.push({ id: 3, text: "⚔️ 턴 승리!", color: "text-yellow-400", large: true });
        confetti({ particleCount: 50, spread: 60, origin: { x: 0.2, y: 0.4 }, colors: ['#fbbf24', '#f87171'] });
      }
      else if (finalMyDmg < finalOppDmg) floats.push({ id: 4, text: "🛡️ 턴 패배", color: "text-gray-400", large: true });
      else floats.push({ id: 5, text: "🤝 무승부", color: "text-white", large: true });

      setFloatingTexts(floats);
      setPlayerScore(p => p + finalMyDmg);
      setOpponentScore(p => p + finalOppDmg);

    }, 400); 

    setTimeout(() => setHitFlash(false), 600);
    setTimeout(() => setTurnState('DONE'), 2500); 
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

  // ⭐️ 덱 구성 시 필터링 처리
  const rarities = [
    { id: 'ALL', label: '전체 등급' },
    { id: 'COMMON', label: '일반' },
    { id: 'RARE', label: '희귀' },
    { id: 'LEGENDARY', label: '전설' },
    { id: 'MYTHICAL', label: '환상' }
  ];

  const availableTypes = ['ALL', ...Array.from(new Set(myInventoryCards.filter(c => filterRarity === 'ALL' || c.rarity === filterRarity).map(c => c.type ? c.type.split('/')[0] : '노말')))];

  const filteredCards = myInventoryCards.filter(c => {
    const cType = c.type ? c.type.split('/')[0] : '노말';
    const matchRarity = filterRarity === 'ALL' || c.rarity === filterRarity;
    const matchType = filterType === 'ALL' || cType === filterType;
    return matchRarity && matchType;
  });

  return (
    <motion.div 
      animate={hitFlash ? { x: [-10, 10, -10, 10, 0], y: [-10, 10, -10, 10, 0] } : {}} 
      transition={{ duration: 0.3 }}
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-hidden touch-none transition-colors duration-100 ${hitFlash ? 'bg-red-600/90' : 'bg-gray-900/95'}`}
    >
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
            <h2 className="text-4xl font-black text-white mb-4 leading-tight">
              {isHost ? `${opponent?.name}님의 수락 대기중...` : '배틀 방 입장 준비 중...'}
            </h2>
            <p className="text-yellow-300 font-bold mb-8">잠시만 기다려주세요 🚀</p>
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
            
            {/* ⭐️ 필터 영역 추가 */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {rarities.map(r => (
                  <button key={r.id} onClick={() => { setFilterRarity(r.id); setFilterType('ALL'); }} className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all shadow-md ${filterRarity === r.id ? 'bg-blue-500 text-white border-2 border-blue-300' : 'bg-gray-800 text-gray-300 border-2 border-transparent hover:bg-gray-700'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {availableTypes.map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border border-gray-600 ${filterType === t ? 'bg-green-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'}`}>
                    {t === 'ALL' ? '모든 속성' : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 overflow-y-auto flex-1 custom-scrollbar pb-10 content-start">
              {filteredCards.map((card) => {
                if (!card) return null; 
                const isSelected = selectedCards.some(c => c.instanceId === card.instanceId);
                return (
                  <motion.div key={card.instanceId} whileHover={{ scale: 1.05 }} onClick={() => toggleCardSelection(card)}
                    className={`bg-white p-2 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center aspect-[3/4] relative ${isSelected ? 'border-red-500 opacity-50' : 'border-gray-200 hover:border-blue-400'}`}>
                    {isSelected && <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 rounded-lg"><span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">선택됨</span></div>}
                    <div className="relative w-full flex-1 mb-1 pointer-events-none">
                      {card.image ? <Image src={card.image} alt={card.name} fill className="object-contain" /> : <FallbackImage />}
                    </div>
                    <div className="w-full text-center shrink-0">
                      <h3 className="font-black text-[10px] text-gray-800 truncate leading-tight w-full relative z-10">{card.name}</h3>
                    </div>
                  </motion.div>
                );
              })}
              {filteredCards.length === 0 && (
                <div className="col-span-full text-center text-gray-500 font-bold py-10">조건에 맞는 포켓몬이 없습니다 😢</div>
              )}
            </div>
          </motion.div>
        )}

        {stage === 'WAITING_OPP_DECK' && (
          <motion.div key="wait-deck" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-white">
            <div className="text-6xl mb-4 animate-spin">⏳</div>
            <h2 className="text-3xl font-black mb-2">상대방이 카드를 고르고 있습니다...</h2>
          </motion.div>
        )}

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
                
                <div className="flex flex-col items-center flex-1 z-20">
                  <span className="text-blue-400 font-bold mb-2">내 몬스터</span>
                  {activePlayerCard ? (
                    <motion.div animate={turnState === 'CLASHING' ? { 
                      x: [0, 80, -20, 0], 
                      y: [0, -40, 10, 0], 
                      scale: [1, 1.4, 0.9, 1], 
                      rotate: [0, 15, -10, 0] 
                    } : {}}
                    transition={{ duration: 0.8, times: [0, 0.4, 0.6, 1], ease: "easeInOut" }}>
                      <BattleCard monster={activePlayerCard} scale={1.2} />
                    </motion.div>
                  ) : (
                    <div className="w-28 h-36 border-4 border-dashed border-gray-600 rounded-3xl flex items-center justify-center text-gray-500 font-bold bg-gray-800/50">선택 대기중</div>
                  )}
                </div>

                {hitFlash ? (
                  <div className="text-7xl font-black text-yellow-300 italic px-4 drop-shadow-[0_0_30px_rgba(253,224,71,1)] z-10 animate-ping">💥</div>
                ) : (
                  <div className="text-4xl font-black text-gray-600 italic px-4 z-10">VS</div>
                )}

                <div className="flex flex-col items-center flex-1 z-20">
                  <span className="text-red-400 font-bold mb-2">적 몬스터</span>
                  {activeOpponentCard || battleMode === 'BOT' ? (
                    <motion.div animate={turnState === 'CLASHING' ? { 
                      x: [0, -80, 20, 0], 
                      y: [0, 40, -10, 0], 
                      scale: [1, 1.4, 0.9, 1], 
                      rotate: [0, -15, 10, 0] 
                    } : {}}
                    transition={{ duration: 0.8, times: [0, 0.4, 0.6, 1], ease: "easeInOut" }}>
                      <BattleCard monster={activeOpponentCard || opponentDeck[currentTurn]} isOpponent scale={1.2} isHidden={turnState !== 'DONE' && turnState !== 'CLASHING'} />
                    </motion.div>
                  ) : (
                    <div className="w-28 h-36 border-4 border-dashed border-gray-600 rounded-3xl flex items-center justify-center bg-gray-800/50">
                       <span className="animate-pulse text-gray-500 text-sm font-bold">카드 선택중...</span>
                    </div>
                  )}
                </div>

              </div>

              <AnimatePresence>
                {floatingTexts.map((float, index) => (
                  <motion.div key={float.id} initial={{ y: 50, opacity: 0, scale: 0.5 }} animate={{ y: -60 - (index * 40), opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 200 }} className={`absolute font-black drop-shadow-[0_5px_10px_rgba(0,0,0,1)] z-50 ${float.color} ${float.large ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`}>
                    {float.text}
                  </motion.div>
                ))}
              </AnimatePresence>

              {turnState === 'DONE' && (
                <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onClick={advanceNextTurn} 
                  className="absolute bottom-10 z-50 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-xl py-4 px-10 rounded-full shadow-[0_5px_0_rgba(30,58,138,1)] active:translate-y-1 active:shadow-none hover:brightness-110"
                >
                  {currentTurn >= 9 ? '최종 결과 확인 🏆' : '다음 라운드 ⏭️'}
                </motion.button>
              )}
            </div>

            <div className="w-full flex flex-col items-center justify-end z-20 min-h-[12rem] bg-gray-800/80 rounded-t-3xl pt-4 pb-2 border-t-4 border-gray-600 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
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

            <AnimatePresence>
              {turnState === 'DIFFICULTY_SELECT' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <h2 className="text-3xl font-black text-white mb-8 text-center drop-shadow-lg">어떤 마법을 사용할까? 🔮</h2>
                  <div className="flex flex-col gap-4 w-full max-w-sm">
                    <button onClick={() => { setSpellMultiplier(1.5); setAttackProblem(generateProblem('ADD', 'LEVEL_1')); setTurnState('MATH_SOLVE'); }} className="bg-green-500 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-transform">🟢 1단계 (데미지 1.5배)</button>
                    <button onClick={() => { setSpellMultiplier(2.0); setAttackProblem(generateProblem('ADD', 'LEVEL_2')); setTurnState('MATH_SOLVE'); }} className="bg-yellow-500 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-transform">🟡 2단계 (데미지 2.0배)</button>
                    <button onClick={() => { setSpellMultiplier(3.0); setAttackProblem(generateProblem('MUL', 'LEVEL_1')); setTurnState('MATH_SOLVE'); }} className="bg-red-500 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-transform">🔴 구구단 (데미지 3.0배)</button>
                    <button onClick={() => { setActivePlayerCard(null); setTurnState('CARD_SELECT'); }} className="mt-4 text-gray-400 font-bold underline px-4 py-2">← 다른 카드 선택하기</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {turnState === 'MATH_SOLVE' && attackProblem && (
              <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4">
                <div className="text-5xl font-mono font-black text-white mb-6 border-4 border-yellow-400 bg-indigo-700/80 p-6 rounded-3xl text-center shadow-[0_0_30px_rgba(99,102,241,0.8)]">
                  {attackProblem.operandA} {attackProblem.type === 'ADD' ? '+' : attackProblem.type === 'SUB' ? '-' : 'x'} {attackProblem.operandB} = <span className="text-yellow-300 animate-pulse">{attackInput || '?'}</span>
                </div>
                <NumberPad onInput={(num) => setAttackInput(p => p.length < 3 ? p + num : p)} onDelete={() => setAttackInput(p => p.slice(0, -1))} onEnter={() => { if (attackInput) handleMathSolved(parseInt(attackInput) === attackProblem.answer); }} />
              </div>
            )}
          </motion.div>
        )}

        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="text-center bg-gray-800 p-12 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] relative border-4 border-gray-600 z-50 w-full max-w-lg">
            <h2 className="text-5xl font-black mb-6 z-10 relative text-white drop-shadow-xl">
              {playerScore > opponentScore ? '🏆 완벽한 승리! 🏆' : playerScore < opponentScore ? '💀 아쉬운 패배' : '🤝 치열한 무승부'}
            </h2>
            <div className="bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400 font-bold">내 최종 점수</span>
                <span className={`text-4xl font-black ${playerScore >= opponentScore ? "text-blue-400" : "text-white"}`}>{playerScore.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-bold">적 최종 점수</span>
                <span className={`text-4xl font-black ${opponentScore >= playerScore ? "text-red-400" : "text-white"}`}>{opponentScore.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={onClose} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-900 font-black py-4 px-12 rounded-full text-xl hover:scale-105 active:scale-95 transition-transform shadow-xl">
              마을로 금의환향
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}