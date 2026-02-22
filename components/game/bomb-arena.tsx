// components/game/bomb-arena.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster, BombGameState, BombPlayer, BombCard, BombCardType, RpsRoundResult } from '@/types/game';
import { useGameStore } from '@/store/game-store';
import { getUsers } from '@/actions/user-actions';
import { supabase } from '@/lib/supabase';

interface BombArenaProps {
  allMonsters: Monster[];
  onClose: () => void;
  onlineUsers: string[];
  initialOpponentId?: string;
  isHost: boolean;
  roomId?: string;
}

// 🔊 효과음 생성기 (Web Audio API)
const playSynth = (type: 'draw' | 'play' | 'warn70' | 'warn80' | 'warn90' | 'bomb' | 'win' | 'lose') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;

    switch (type) {
      case 'play': 
        osc.type = 'square'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1); break;
      case 'warn70': 
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.3, now); gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2); break;
      case 'warn80': 
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now); osc.stop(now + 0.15); break;
      case 'warn90': 
        osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1000, now + 0.1);
        gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now); osc.stop(now + 0.3); break;
      case 'bomb': 
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(20, now + 0.8);
        gain.gain.setValueAtTime(1, now); gain.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now); osc.stop(now + 0.8); break;
      case 'win': 
        osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(554, now+0.1); osc.frequency.setValueAtTime(659, now+0.2);
        gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5); break;
    }
  } catch(e) {}
};

// 미취학 아동용 한글 라벨
const getCardLabel = (type: BombCardType) => {
  switch (type) {
    case 'PLUS': return '더하기 (+)';
    case 'MINUS': return '빼기 (-)';
    case 'PASS': return '넘기기 (0)';
    case 'REVERSE': return '순서 반대';
    case 'JOKER': return '조커 (숫자바꾸기)';
    default: return '';
  }
};

// ⭐️ 최종 확률 적용된 카드 뽑기
const drawCard = (monsters: Monster[]): BombCard => {
  const rand = Math.floor(Math.random() * 100) + 1;
  let targetEffect: 'PLUS' | 'MINUS' | 'PASS' | 'REVERSE' | 'JOKER' = 'PLUS';

  if (rand <= 75) targetEffect = 'PLUS';         // 75%
  else if (rand <= 85) targetEffect = 'MINUS';   // 10%
  else if (rand <= 92) targetEffect = 'REVERSE'; // 7%
  else if (rand <= 97) targetEffect = 'PASS';    // 5%
  else targetEffect = 'JOKER';                   // 3%

  let pool = monsters;
  if (targetEffect === 'JOKER' || targetEffect === 'REVERSE') {
    pool = monsters.filter(m => m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL');
  } else if (targetEffect === 'MINUS') {
    pool = monsters.filter(m => ['물', '풀', '얼음', '독', '에스퍼'].includes(m.type?.split('/')[0].trim()));
  } else if (targetEffect === 'PASS') {
    pool = monsters.filter(m => ['바위', '강철', '땅'].includes(m.type?.split('/')[0].trim()));
  } else {
    pool = monsters.filter(m => !['물', '풀', '얼음', '독', '에스퍼', '바위', '강철', '땅'].includes(m.type?.split('/')[0].trim()) && m.rarity !== 'LEGENDARY' && m.rarity !== 'MYTHICAL');
  }

  // 예외 방지
  if (pool.length === 0) pool = monsters;

  const m = pool[Math.floor(Math.random() * pool.length)];
  let cardType = targetEffect;
  let value = 0;

  if (cardType === 'PLUS') {
    value = Math.floor(Math.random() * 10) + 1; // 1~10 랜덤
  } else if (cardType === 'MINUS') {
    value = Math.random() < 0.5 ? -9 : -10; // -9 또는 -10 만 등장
  }

  return { id: Math.random().toString(36).substr(2, 9), monsterId: m.id, name: m.name, image: m.image, cardType, value, element: m.type ? m.type.split('/')[0].trim() : '노말' };
};

export default function BombArena({ allMonsters, onClose, onlineUsers, initialOpponentId, isHost, roomId }: BombArenaProps) {
  const { currentUser } = useGameStore();
  const [users, setUsers] = useState<{id:string, name:string}[]>([]);
  
  const [activeRoomId] = useState(() => roomId || `bomb_${currentUser?.id}_${Math.random().toString(36).substring(7)}`);
  
  const [gameState, setGameState] = useState<BombGameState>({
    step: 'LOBBY', maxPlayers: 4, players: [], turnIndex: 0, direction: 1, gauge: 0, boss: null, winnerName: null,
    rpsQueue: [], rankedPlayers: [], rpsRoundResults: [], rpsMsg: '가위바위보를 선택하세요!', lastActionMsg: ''
  });
  
  const [channel, setChannel] = useState<any>(null);
  const channelRef = useRef<any>(null); 
  const [shakeIntensity, setShakeIntensity] = useState(0); 
  
  const [jokerSelection, setJokerSelection] = useState<{ active: boolean, cardId: string } | null>(null);
  const [jokerInput, setJokerInput] = useState<number>(75);

  const [isSpectating, setIsSpectating] = useState(false); // ⭐️ 관전 모드 상태 추가

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const stateRef = useRef(gameState); 
  stateRef.current = gameState;

  // 🎵 90이상 시 재생할 긴장감 BGM 세팅
  useEffect(() => {
    bgmRef.current = new Audio('/sounds/tension-bgm.mp3'); 
    bgmRef.current.loop = true;
    return () => {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.currentTime = 0; }
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // 🎵 BGM 자동 On/Off 및 게이지별 화면색상/사운드 처리
  useEffect(() => {
    if (gameState.step === 'PLAYING') {
      if (gameState.gauge >= 90) {
        if (bgmRef.current?.paused) bgmRef.current.play().catch(()=>{});
        playSynth('warn90');
      } else {
        if (!bgmRef.current?.paused) bgmRef.current?.pause();
        if (gameState.gauge >= 80) playSynth('warn80');
        else if (gameState.gauge >= 70) playSynth('warn70');
      }
    }
  }, [gameState.gauge, gameState.step]);

  useEffect(() => { getUsers().then(setUsers); }, []);

  // ⭐️ 멀티플레이 네트워크 연결
  useEffect(() => {
    if (!currentUser) return;
    const chan = supabase.channel(activeRoomId, { config: { presence: { key: currentUser.id } } });

    chan.on('broadcast', { event: 'SYNC_STATE' }, (payload) => {
      if (!isHost) setGameState(payload.payload.state);
    });

    chan.on('broadcast', { event: 'PLAYER_ACTION' }, (payload) => {
      if (isHost) handlePlayerAction(payload.payload.actionType, payload.payload.data);
    });

    chan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await chan.track({ name: currentUser.name });
        if (isHost) {
          const hostPlayer: BombPlayer = { id: currentUser.id, name: currentUser.name, isBot: false, hand: Array.from({length: 5}).map(() => drawCard(allMonsters)), isEliminated: false };
          updateState({ players: [hostPlayer] });
        } else if (initialOpponentId) {
          channelRef.current?.send({ type: 'broadcast', event: 'PLAYER_ACTION', payload: { actionType: 'JOIN', data: { id: currentUser.id, name: currentUser.name } } });
        }
      }
    });

    setChannel(chan);
    channelRef.current = chan;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateState = (updates: Partial<BombGameState>) => {
    const newState = { ...stateRef.current, ...updates };
    setGameState(newState);
    if (channelRef.current && isHost) {
      channelRef.current.send({ type: 'broadcast', event: 'SYNC_STATE', payload: { state: newState } });
    }
  };

  const handlePlayerAction = (type: string, data: any) => {
    const state = stateRef.current;
    if (type === 'JOIN' && state.step === 'LOBBY' && state.players.length < state.maxPlayers) {
      const newPlayer: BombPlayer = { id: data.id, name: data.name, isBot: false, hand: Array.from({length: 5}).map(() => drawCard(allMonsters)), isEliminated: false };
      if (!state.players.find(p => p.id === data.id)) {
        updateState({ players: [...state.players, newPlayer] });
      } else {
        channelRef.current?.send({ type: 'broadcast', event: 'SYNC_STATE', payload: { state: stateRef.current } });
      }
    } else if (type === 'RPS' && state.step === 'RPS') {
      const updatedPlayers = state.players.map(p => p.id === data.id ? { ...p, rpsChoice: data.choice as any } : p);
      updateState({ players: updatedPlayers });
      checkAllRPSReady(updatedPlayers);
    } else if (type === 'PLAY_CARD' && state.step === 'PLAYING') {
      processCardPlay(data.playerId, data.cardId, data.jokerValue);
    }
  };

  const invitePlayer = (uId: string) => {
    supabase.channel('global_lobby').send({
      type: 'broadcast', event: 'battle_invite',
      payload: { hostId: currentUser?.id, hostName: currentUser?.name, targetId: uId, gameType: 'BOMB', roomId: activeRoomId }
    });
    alert('초대장을 보냈습니다!');
  };

  const fillWithBotsAndStart = () => {
    let currentPlayers = [...stateRef.current.players];
    let botCount = 1;
    while (currentPlayers.length < stateRef.current.maxPlayers) {
      currentPlayers.push({ id: `bot_${botCount}`, name: `로봇 ${botCount}호`, isBot: true, hand: Array.from({length: 5}).map(() => drawCard(allMonsters)), isEliminated: false });
      botCount++;
    }
    updateState({ players: currentPlayers, step: 'RPS', rpsQueue: [currentPlayers.map(p => p.id)], rankedPlayers: [], rpsMsg: '가위바위보를 선택하세요!' });
  };

  // ================= ✌️✊🖐 가위바위보 로직 =================
  useEffect(() => {
    if (!isHost || gameState.step !== 'RPS') return;
    const currentGroup = gameState.rpsQueue[0];
    if (!currentGroup) return;

    const allBots = currentGroup.every(id => gameState.players.find(p => p.id === id)?.isBot);
    
    if (allBots) {
      const timer = setTimeout(() => { checkAllRPSReady(gameState.players); }, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.step, gameState.rpsQueue, isHost]);

  const submitRPS = (choice: 'ROCK' | 'PAPER' | 'SCISSORS') => {
    if (isHost) {
      const updated = stateRef.current.players.map(p => p.id === currentUser?.id ? { ...p, rpsChoice: choice } : p);
      updateState({ players: updated });
      checkAllRPSReady(updated);
    } else {
      channelRef.current?.send({ type: 'broadcast', event: 'PLAYER_ACTION', payload: { actionType: 'RPS', data: { id: currentUser?.id, choice } } });
    }
  };

  const checkAllRPSReady = (players: BombPlayer[]) => {
    const state = stateRef.current;
    const currentGroup = state.rpsQueue[0];
    if (!currentGroup) return;

    let updatedPlayers = [...players];
    
    currentGroup.forEach(id => {
      const p = updatedPlayers.find(x => x.id === id);
      if (p && p.isBot && !p.rpsChoice) {
        const choices = ['ROCK', 'PAPER', 'SCISSORS'] as const;
        p.rpsChoice = choices[Math.floor(Math.random() * 3)];
      }
    });

    if (!currentGroup.every(id => updatedPlayers.find(p => p.id === id)?.rpsChoice)) {
      updateState({ players: updatedPlayers }); return;
    }

    const choices = new Set(currentGroup.map(id => updatedPlayers.find(p => p.id === id)!.rpsChoice));
    const hasR = choices.has('ROCK'); const hasP = choices.has('PAPER'); const hasS = choices.has('SCISSORS');
    
    let isDraw = choices.size === 1 || choices.size === 3;
    let winChoice = '';
    if (!isDraw) {
      if (hasR && hasS) winChoice = 'ROCK';
      if (hasS && hasP) winChoice = 'SCISSORS';
      if (hasP && hasR) winChoice = 'PAPER';
    }

    const roundResults: RpsRoundResult[] = currentGroup.map(id => {
      const p = updatedPlayers.find(x => x.id === id)!;
      let status: 'WIN'|'LOSE'|'DRAW' = 'DRAW';
      if (!isDraw) status = p.rpsChoice === winChoice ? 'WIN' : 'LOSE';
      return { id: p.id, name: p.name, isBot: p.isBot, choice: p.rpsChoice!, status };
    });

    updateState({ players: updatedPlayers, step: 'RPS_SHOW', rpsRoundResults: roundResults, rpsMsg: isDraw ? '앗, 비겼습니다!' : '승패가 갈렸습니다!' });

    setTimeout(() => {
      const currentState = stateRef.current;
      let newQueue = currentState.rpsQueue.slice(1);
      let newRanked = [...currentState.rankedPlayers];

      if (isDraw) {
        newQueue.unshift(currentGroup); 
      } else {
        const winners = currentGroup.filter(id => updatedPlayers.find(p=>p.id===id)!.rpsChoice === winChoice);
        const losers = currentGroup.filter(id => updatedPlayers.find(p=>p.id===id)!.rpsChoice !== winChoice);
        if (losers.length > 0) newQueue.unshift(losers);
        if (winners.length > 0) newQueue.unshift(winners);
      }

      while (newQueue.length > 0 && newQueue[0].length === 1) {
        newRanked.push(newQueue.shift()![0]);
      }

      updatedPlayers.forEach(p => p.rpsChoice = undefined);

      if (newQueue.length === 0) {
        updatedPlayers.sort((a, b) => newRanked.indexOf(a.id) - newRanked.indexOf(b.id));
        const boss = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY')[0] || allMonsters[0];
        updateState({ players: updatedPlayers, rpsQueue: [], rankedPlayers: newRanked, step: 'RPS_RESULT', boss });
        setTimeout(() => updateState({ step: 'PLAYING', turnIndex: 0, lastActionMsg: '폭탄 돌리기 시작!' }), 4000);
      } else {
        updateState({ players: updatedPlayers, rpsQueue: newQueue, rankedPlayers: newRanked, step: 'RPS', rpsMsg: isDraw ? '다시 내주세요!' : '남은 사람끼리 다시 냅니다!' });
      }
    }, 3500);
  };

  // ================= 💣 폭탄 게임 로직 =================
  const initiateCardPlay = (card: BombCard) => {
    if (card.cardType === 'JOKER') {
      setJokerSelection({ active: true, cardId: card.id });
    } else {
      executePlay(card.id);
    }
  };

  const executePlay = (cardId: string, jokerValue?: number) => {
    setJokerSelection(null);
    if (isHost) processCardPlay(currentUser!.id, cardId, jokerValue);
    else channelRef.current?.send({ type: 'broadcast', event: 'PLAYER_ACTION', payload: { actionType: 'PLAY_CARD', data: { playerId: currentUser!.id, cardId, jokerValue } } });
  };

  const processCardPlay = (playerId: string, cardId: string, jokerValue?: number) => {
    const state = stateRef.current;
    if (state.players[state.turnIndex].id !== playerId) return;

    let newDirection = state.direction;
    let newGauge = state.gauge;

    const playerIndex = state.turnIndex;
    const player = state.players[playerIndex];
    const playedCard = player.hand.find(c => c.id === cardId);
    if (!playedCard) return;

    playSynth('play');

    let actionStr = '';
    if (playedCard.cardType === 'PLUS') actionStr = `+${playedCard.value}`;
    else if (playedCard.cardType === 'MINUS') actionStr = `${playedCard.value}`;
    else if (playedCard.cardType === 'PASS') actionStr = '패스';
    else if (playedCard.cardType === 'REVERSE') actionStr = '순서 반대';
    else if (playedCard.cardType === 'JOKER') actionStr = `조커 ${jokerValue}`;

    let actionMsg = `가랏! ${playedCard.name}! (${actionStr})`;

    if (playedCard.cardType === 'JOKER') newGauge = jokerValue || 75;
    else if (playedCard.cardType === 'REVERSE') newDirection = (state.direction * -1) as 1 | -1;
    else newGauge += playedCard.value;

    if (newGauge >= 90) setShakeIntensity(20);
    else if (newGauge >= 80) setShakeIntensity(10);
    else if (newGauge >= 70) setShakeIntensity(5);
    else setShakeIntensity(2);
    setTimeout(() => setShakeIntensity(0), 400);

    const newHand = player.hand.filter(c => c.id !== cardId);
    newHand.push(drawCard(allMonsters));

    const updatedPlayers = [...state.players];
    let finalActionMsg = actionMsg;
    
    // ⭐️ 99 초과 (100 이상) 시 패배 처리 및 99 연속 진행 로직 적용
    if (newGauge > 99) {
      updatedPlayers[playerIndex] = { ...player, isEliminated: true, hand: newHand };
      finalActionMsg = `💥 ${player.name} 폭발! (100 초과)`;
      newGauge = 99; // 50으로 리셋하지 않고 99부터 극한의 긴장감으로 연속 진행
      playSynth('bomb');
    } else {
      updatedPlayers[playerIndex] = { ...player, hand: newHand };
    }

    let nextTurn = state.turnIndex;
    let aliveCount = updatedPlayers.filter(p => !p.isEliminated).length;
    
    if (aliveCount <= 1) {
      const winner = updatedPlayers.find(p => !p.isEliminated);
      updateState({ players: updatedPlayers, gauge: newGauge, step: 'RESULT', winnerName: winner?.name || '무승부', lastActionMsg: finalActionMsg });
      playSynth('win');
      if (bgmRef.current) bgmRef.current.pause();
      return;
    }

    do {
      nextTurn = (nextTurn + newDirection + updatedPlayers.length) % updatedPlayers.length;
    } while (updatedPlayers[nextTurn].isEliminated);

    updateState({ players: updatedPlayers, gauge: newGauge, direction: newDirection, turnIndex: nextTurn, lastActionMsg: finalActionMsg });
  };

  // 🤖 봇 AI 로직
  useEffect(() => {
    if (!isHost || gameState.step !== 'PLAYING') return;

    const currentP = gameState.players[gameState.turnIndex];
    if (currentP && currentP.isBot && !currentP.isEliminated) {
      const timer = setTimeout(() => {
        const safeCards = currentP.hand.filter(c => {
          if (c.cardType === 'JOKER' || c.cardType === 'REVERSE' || c.cardType === 'PASS') return true;
          return gameState.gauge + c.value <= 99;
        });

        if (safeCards.length > 0) {
          const card = safeCards[Math.floor(Math.random() * safeCards.length)];
          const jokerVal = card.cardType === 'JOKER' ? Math.floor(Math.random() * 31) + 60 : undefined;
          processCardPlay(currentP.id, card.id, jokerVal);
        } else {
          const sorted = [...currentP.hand].sort((a,b) => a.value - b.value);
          processCardPlay(currentP.id, sorted[0].id);
        }
      }, 2500); 
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnIndex, gameState.step, isHost]);

  // 🧑 ⭐️ 실제 유저(나) 자동 패배 로직 (alert 통신 블로킹 완벽 해결)
  useEffect(() => {
    if (gameState.step !== 'PLAYING') return;

    const currentP = gameState.players[gameState.turnIndex];
    if (currentP && !currentP.isBot && currentP.id === currentUser?.id && !currentP.isEliminated) {
      const safeCards = currentP.hand.filter(c => {
        if (c.cardType === 'JOKER' || c.cardType === 'REVERSE' || c.cardType === 'PASS') return true;
        return gameState.gauge + c.value <= 99;
      });

      if (safeCards.length === 0) {
        // 브라우저를 멈추게 하는 alert 제거 -> 자연스러운 2초 후 자동 폭발 연출로 변경
        const timer = setTimeout(() => {
          const sorted = [...currentP.hand].sort((a,b) => a.value - b.value);
          executePlay(sorted[0].id);
        }, 2000); 
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnIndex, gameState.step, gameState.gauge]);

  const getBgClass = () => {
    if (gameState.step !== 'PLAYING') return 'bg-gray-900/95';
    if (gameState.gauge >= 90) return 'bg-red-800/95';
    if (gameState.gauge >= 80) return 'bg-orange-800/90';
    if (gameState.gauge >= 70) return 'bg-yellow-900/90';
    return 'bg-gray-900/95';
  };

  const isRoomFull = gameState.players.length >= gameState.maxPlayers;
  const myPlayerInfo = gameState.players.find(p => p.id === currentUser?.id);
  const isMyTurn = gameState.step === 'PLAYING' && gameState.players[gameState.turnIndex]?.id === currentUser?.id;
  const isRPSActive = gameState.rpsQueue[0]?.includes(currentUser?.id || '');

  return (
    <motion.div 
      animate={shakeIntensity > 0 ? { x: [-shakeIntensity, shakeIntensity, -shakeIntensity, shakeIntensity, 0], y: [-shakeIntensity, shakeIntensity, -shakeIntensity, shakeIntensity, 0] } : {}}
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-xl touch-none overflow-hidden text-white font-sans transition-colors duration-300 ${getBgClass()}`}
    >
      
      {/* 💥 패배자 관전 전환 모달 (⭐️ 관전모드 상태 반영하여 정상적으로 닫히도록 수정) */}
      <AnimatePresence>
        {myPlayerInfo?.isEliminated && gameState.step === 'PLAYING' && !isSpectating && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-9xl mb-6 animate-bounce">💥</div>
            <h2 className="text-5xl font-black text-red-500 mb-4">앗! 폭발해버렸어요!</h2>
            <p className="text-gray-300 text-xl font-bold mb-12">99를 초과하여 게임에서 패배했습니다.</p>
            <div className="flex gap-4">
              <button onClick={() => setIsSpectating(true)} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all">
                👀 남은 게임 관전하기
              </button>
              <button onClick={onClose} className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all">
                🚪 게임 방 나가기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🃏 조커 카드 사용 모달 */}
      <AnimatePresence>
        {jokerSelection?.active && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[150] bg-black/80 flex flex-col items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-purple-900 border-4 border-purple-400 p-8 rounded-[3rem] text-center max-w-sm w-full shadow-[0_0_50px_rgba(168,85,247,0.6)]">
              <div className="text-6xl mb-4">🃏</div>
              <h2 className="text-3xl font-black text-white mb-2">조커 발동!</h2>
              <p className="text-purple-200 font-bold mb-8">숫자를 60에서 90 사이로<br/>마음대로 조작하세요!</p>
              
              <div className="text-7xl font-black text-yellow-300 mb-6 border-b-4 border-purple-500 pb-4">
                {jokerInput}
              </div>
              
              <input type="range" min="60" max="90" value={jokerInput} onChange={(e) => setJokerInput(parseInt(e.target.value))} className="w-full h-4 bg-purple-700 rounded-lg appearance-none cursor-pointer mb-8" />
              
              <div className="flex gap-3">
                <button onClick={() => executePlay(jokerSelection.cardId, jokerInput)} className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black py-4 rounded-2xl text-xl shadow-lg active:scale-95 transition-all">
                  확인
                </button>
                <button onClick={() => setJokerSelection(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-all">
                  취소
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={onClose} className="absolute top-6 right-6 text-4xl hover:text-red-400 transition-transform z-[100]">✖</button>

      <AnimatePresence mode="wait">
        
        {/* 단계 1: 대기방 */}
        {gameState.step === 'LOBBY' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl bg-gray-800 p-8 rounded-3xl border-4 border-red-500 shadow-2xl">
            <h2 className="text-4xl font-black mb-2 text-center text-red-400">💣 몬스터 폭탄 돌리기</h2>
            <p className="text-center text-gray-400 mb-8 font-bold">100이 되면 펑! 끝까지 살아남으세요.</p>
            
            {isHost ? (
              <>
                <div className="flex justify-center gap-4 mb-8">
                  {[2,3,4].map(num => (
                    <button key={num} onClick={() => updateState({ maxPlayers: num })} className={`px-6 py-2 rounded-xl font-black text-xl border-2 transition-all ${gameState.maxPlayers === num ? 'bg-red-500 border-red-300 shadow-lg scale-110' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                      {num}인 플레이
                    </button>
                  ))}
                </div>
                <div className="mb-6 p-4 bg-gray-900 rounded-2xl">
                  <h3 className="font-bold text-yellow-400 mb-3">접속 중인 친구 초대</h3>
                  <div className="flex gap-2 overflow-x-auto">
                    {onlineUsers.filter(uid => uid !== currentUser?.id).map(uid => {
                      const u = users.find(x => x.id === uid);
                      return u ? <button key={uid} onClick={() => invitePlayer(uid)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold shadow whitespace-nowrap">{u.name} 초대</button> : null;
                    })}
                    {onlineUsers.length <= 1 && <span className="text-gray-500 text-sm">현재 접속 중인 다른 유저가 없습니다.</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mb-8">
                  <h3 className="font-bold text-green-400">참가 명단 ({gameState.players.length}/{gameState.maxPlayers})</h3>
                  {gameState.players.map(p => <div key={p.id} className="bg-gray-700 p-3 rounded-lg font-bold">✅ {p.name} {p.id===currentUser?.id && '(나)'}</div>)}
                </div>
                <button onClick={fillWithBotsAndStart} className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">
                  {isRoomFull ? '게임 시작 🚀' : '빈자리 로봇 채우고 시작 🚀'}
                </button>
              </>
            ) : (
               <div className="text-center py-20"><div className="text-6xl animate-spin mb-4">⏳</div><h2 className="text-2xl font-bold text-yellow-300">방장이 게임을 설정 중입니다...</h2></div>
            )}
          </motion.div>
        )}

        {/* 단계 2: 가위바위보 선택 */}
        {gameState.step === 'RPS' && (
          <motion.div key="rps" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center w-full max-w-xl bg-gray-800 p-10 rounded-3xl border-4 border-yellow-400 shadow-2xl">
            <h2 className="text-5xl font-black mb-6 text-yellow-400">✌️ ✊ 🖐</h2>
            <p className="text-2xl text-white mb-2 font-black">{gameState.rpsMsg}</p>
            <p className="text-gray-400 mb-10 font-bold">이긴 순서대로 카드를 냅니다.</p>
            
            {isRPSActive && !myPlayerInfo?.rpsChoice ? (
              <div className="flex justify-center gap-6">
                {[{ id: 'SCISSORS', emoji: '✌️', color: 'bg-pink-500' }, { id: 'ROCK', emoji: '✊', color: 'bg-blue-500' }, { id: 'PAPER', emoji: '🖐', color: 'bg-green-500' }].map(opt => (
                  <button key={opt.id} onClick={() => submitRPS(opt.id as any)} className={`${opt.color} hover:scale-110 active:scale-95 transition-all w-28 h-28 rounded-3xl text-6xl shadow-xl flex items-center justify-center border-4 border-white`}>{opt.emoji}</button>
                ))}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-400 animate-pulse mt-10">다른 친구들이 내기를 기다리는 중...</div>
            )}
          </motion.div>
        )}

        {/* 단계 3: 가위바위보 중간 결과 공개 */}
        {gameState.step === 'RPS_SHOW' && (
          <motion.div key="rps_show" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center w-full max-w-3xl bg-gray-800 p-10 rounded-3xl border-4 border-white shadow-2xl">
            <h2 className="text-4xl font-black mb-8 text-white">{gameState.rpsMsg}</h2>
            <div className="flex justify-center gap-6 flex-wrap">
              {gameState.rpsRoundResults.map(r => (
                <div key={r.id} className={`flex flex-col items-center p-4 rounded-2xl border-4 ${r.status === 'WIN' ? 'bg-yellow-100 border-yellow-400' : r.status === 'LOSE' ? 'bg-gray-700 border-gray-600 grayscale' : 'bg-blue-100 border-blue-400'}`}>
                  <div className="text-6xl mb-2">{r.choice === 'ROCK' ? '✊' : r.choice === 'PAPER' ? '🖐' : '✌️'}</div>
                  <span className={`font-black text-lg ${r.status === 'WIN' ? 'text-yellow-700' : r.status === 'LOSE' ? 'text-gray-400' : 'text-blue-700'}`}>{r.name}</span>
                  <span className="text-sm font-bold text-gray-500">{r.status}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 단계 4: 최종 턴 순서 발표 */}
        {gameState.step === 'RPS_RESULT' && (
          <motion.div key="rps_result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-full max-w-2xl bg-gray-800 p-8 rounded-3xl border-4 border-yellow-400 shadow-2xl">
            <h2 className="text-3xl font-black mb-6 text-white">최종 턴 순서 확정!</h2>
            <div className="flex flex-col gap-3">
              {gameState.players.map((p, idx) => (
                <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl text-xl font-bold ${p.id === currentUser?.id ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>
                  <span className="flex items-center gap-4">
                    <span className="bg-yellow-500 text-yellow-900 w-10 h-10 rounded-full flex items-center justify-center text-lg">{idx + 1}등</span>
                    {p.name} {p.isBot && '🤖'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-red-400 font-black text-xl animate-pulse">곧 게임이 시작됩니다!</p>
          </motion.div>
        )}

        {/* 단계 5: 본 게임 루프 */}
        {gameState.step === 'PLAYING' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full h-full max-w-5xl justify-between pt-10 pb-4 relative z-10">
            
            {/* 📢 내 턴 대형 알림 */}
            <AnimatePresence>
              {isMyTurn && !myPlayerInfo?.isEliminated && (
                <motion.div initial={{y: -100, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{opacity: 0}} className="absolute top-20 left-0 right-0 z-[100] flex justify-center pointer-events-none">
                  <div className="bg-yellow-400 text-yellow-900 font-black text-3xl md:text-5xl px-10 py-4 rounded-full shadow-[0_0_50px_rgba(250,204,21,1)] animate-bounce border-4 border-white">
                    나의 차례입니다! 카드를 내주세요!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 상단 플레이어 리스트 */}
            <div className="flex justify-center gap-4 md:gap-8 mb-4">
              {gameState.players.map((p) => (
                <div key={p.id} className={`flex flex-col items-center bg-gray-800 px-4 py-2 rounded-2xl border-4 transition-colors ${gameState.players[gameState.turnIndex].id === p.id ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : 'border-transparent'} ${p.isEliminated ? 'opacity-30 grayscale' : ''}`}>
                  <div className="text-3xl mb-1">{p.isBot ? '🤖' : (p.id === currentUser?.id ? '👦' : '🧑')}</div>
                  <span className={`text-sm font-bold w-20 truncate text-center ${p.id === currentUser?.id ? 'text-yellow-300' : 'text-white'}`}>{p.name}</span>
                  {p.isEliminated ? <span className="text-xs text-red-500 font-black mt-1">탈락 💣</span> : <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded mt-1">생존</span>}
                </div>
              ))}
            </div>

            {/* 중앙 보스 및 게이지 */}
            <div className="flex-1 flex flex-col items-center justify-center relative my-4">
              <div className="absolute top-0 text-xl md:text-3xl font-black text-white px-8 py-3 rounded-full border border-white shadow-2xl text-center min-w-[300px] z-50 bg-black/60">
                {gameState.lastActionMsg || '게임을 시작합니다!'}
              </div>

              <div className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center transition-all duration-300 mt-16 ${gameState.gauge >= 90 ? 'scale-125 drop-shadow-[0_0_80px_rgba(239,68,68,1)]' : gameState.gauge >= 70 ? 'scale-110 drop-shadow-[0_0_40px_rgba(250,204,21,0.8)]' : 'drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]'}`}>
                {gameState.boss?.image && (
                  <img 
                    src={gameState.boss.image} 
                    alt="Boss" 
                    className="absolute inset-0 w-full h-full object-contain z-10 pointer-events-none" 
                  />
                )}
                <div className="absolute inset-0 border-[10px] border-dashed border-white/50 rounded-full animate-[spin_6s_linear_infinite]" style={{ animationDirection: gameState.direction === 1 ? 'normal' : 'reverse' }} />
              </div>

              {/* 💣 숫자 판 */}
              <div className="mt-10 relative z-20">
                <div className={`text-8xl md:text-[9rem] font-black px-12 py-2 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-8 transition-colors ${gameState.gauge >= 90 ? 'bg-red-600 text-white border-yellow-400' : gameState.gauge >= 80 ? 'bg-orange-600 text-white border-white' : gameState.gauge >= 70 ? 'bg-yellow-500 text-red-900 border-white' : 'bg-gray-800 text-yellow-400 border-gray-600'}`}>
                  {gameState.gauge}
                </div>
                <div className="absolute -top-6 -right-6 bg-red-500 text-white font-black px-6 py-2 rounded-full text-xl transform rotate-12 shadow-xl border-4 border-white animate-bounce">
                  100 이상 폭발!
                </div>
              </div>
            </div>

            {/* 하단 내 핸드 */}
            {myPlayerInfo && !myPlayerInfo.isEliminated && (
              <div className={`w-full flex flex-col items-center p-4 rounded-t-[3rem] border-t-4 transition-colors ${isMyTurn ? 'bg-blue-900/80 border-blue-400 shadow-[0_-10px_50px_rgba(59,130,246,0.5)]' : 'bg-gray-800/80 border-gray-700'}`}>
                <div className="flex justify-between w-full max-w-3xl mb-4 px-4 items-end">
                  <span className="font-bold text-gray-400">내 카드 (항상 5장 유지)</span>
                  {isMyTurn ? (
                    <span className="bg-yellow-400 text-yellow-900 font-black px-4 py-1.5 rounded-full shadow-md">위로 터치해서 내기 👉</span>
                  ) : (
                    <span className="text-gray-500 font-bold">다른 사람을 기다리는 중...</span>
                  )}
                </div>

                <div className="flex gap-2 md:gap-4 overflow-x-auto w-full max-w-4xl px-2 pb-4 scrollbar-hide items-center justify-center pt-4">
                  <AnimatePresence>
                    {myPlayerInfo.hand.map(card => {
                      let isPlayable = true;
                      if (card.cardType !== 'RESET' && card.cardType !== 'REVERSE' && card.cardType !== 'PASS' && card.cardType !== 'JOKER') {
                        isPlayable = gameState.gauge + card.value <= 99;
                      }

                      return (
                        <motion.div 
                          key={card.id}
                          initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -300, scale: 2, opacity: 0 }}
                          whileHover={isMyTurn && isPlayable ? { y: -20, scale: 1.1 } : {}}
                          onClick={() => {
                            if (isMyTurn && isPlayable) initiateCardPlay(card);
                            else if (isMyTurn && !isPlayable) alert('100이 넘는 카드는 낼 수 없어요! 다른 카드를 찾아보세요.');
                          }}
                          className={`w-24 md:w-32 aspect-[3/4] rounded-3xl border-4 flex flex-col items-center justify-between p-2 shadow-2xl relative bg-white transition-all ${!isPlayable ? 'opacity-40 grayscale border-gray-400' : isMyTurn ? 'cursor-pointer border-gray-200 hover:border-blue-500' : 'border-gray-400 grayscale opacity-80'}`}
                        >
                          <div className="w-full flex justify-between items-start z-10">
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded font-black">{card.element}</span>
                            <span className={`text-[10px] font-black px-1.5 rounded text-white ${card.cardType === 'PLUS' ? 'bg-red-500' : card.cardType === 'MINUS' ? 'bg-blue-500' : card.cardType === 'PASS' ? 'bg-gray-500' : 'bg-purple-600'}`}>
                              {getCardLabel(card.cardType)}
                            </span>
                          </div>

                          <div className="relative w-full flex-1 mt-1 mb-1 pointer-events-none flex justify-center items-center">
                            <img 
                              src={card.image} 
                              alt={card.name} 
                              className="w-full h-full object-contain drop-shadow-md" 
                            />
                          </div>

                          <div className={`w-full text-center rounded-xl py-1.5 border-2 font-black text-sm md:text-base z-10 ${
                            card.cardType === 'PLUS' ? 'bg-red-100 text-red-700 border-red-200' :
                            card.cardType === 'MINUS' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            card.cardType === 'PASS' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                            'bg-purple-100 text-purple-700 border-purple-200 text-[10px] md:text-xs tracking-tighter'
                          }`}>
                            {card.value !== 0 && card.cardType !== 'JOKER' ? (card.value > 0 ? `+${card.value}` : card.value) : ''}
                            {card.cardType === 'JOKER' || card.cardType === 'PASS' || card.cardType === 'REVERSE' ? getCardLabel(card.cardType) : ''}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* 단계 6: 게임 결과 */}
        {gameState.step === 'RESULT' && (
          <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center bg-gray-800 p-12 rounded-[3rem] border-8 border-yellow-400 shadow-[0_0_80px_rgba(250,204,21,0.8)] z-50">
            <h2 className="text-8xl mb-6">👑</h2>
            <h3 className="text-4xl font-black text-white mb-2">최후의 생존자</h3>
            <div className="text-6xl font-black text-yellow-300 mb-12 drop-shadow-xl p-6 bg-gray-900 rounded-3xl">
              {gameState.winnerName}
            </div>
            <button onClick={onClose} className="w-full bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-black py-5 px-10 rounded-2xl shadow-xl active:scale-95 transition-all text-2xl">
              마을로 돌아가기
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}