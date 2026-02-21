// components/game/bomb-arena.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster, BombGameState, BombPlayer, BombCard, BombCardType } from '@/types/game';
import { useGameStore } from '@/store/game-store';
import { getUsers } from '@/actions/user-actions';
import { supabase } from '@/lib/supabase';
import confetti from 'canvas-confetti';

interface BombArenaProps {
  allMonsters: Monster[];
  onClose: () => void;
  onlineUsers: string[];
  initialOpponentId?: string;
  isHost: boolean;
  roomId?: string;
}

// 미취학 아동을 위한 한글 패치
const getCardLabel = (type: BombCardType) => {
  switch (type) {
    case 'PLUS': return '더하기';
    case 'MINUS': return '빼기';
    case 'PASS': return '차례 넘기기';
    case 'REVERSE': return '순서 반대';
    case 'RESET': return '50으로!';
    case 'BLIND': return '숫자 가리기';
  }
};

const getCardValueStr = (card: BombCard) => {
  if (card.cardType === 'PLUS') return `+${card.value}`;
  if (card.cardType === 'MINUS') return `${card.value}`;
  if (card.cardType === 'PASS') return `0`;
  return '';
};

// 덱에서 카드를 뽑는 로직
const drawCard = (monsters: Monster[]): BombCard => {
  const m = monsters[Math.floor(Math.random() * monsters.length)];
  const type = m.type ? m.type.split('/')[0].trim() : '노말';
  const rarity = m.rarity;

  let cardType: BombCardType = 'PLUS';
  let value = Math.floor(Math.random() * 10) + 1;

  if (rarity === 'LEGENDARY' || rarity === 'MYTHICAL') {
    const specials: BombCardType[] = ['RESET', 'REVERSE', 'BLIND'];
    cardType = specials[Math.floor(Math.random() * specials.length)];
    value = cardType === 'RESET' ? 50 : 0;
  } else if (['물', '풀', '얼음', '독', '에스퍼'].includes(type)) {
    cardType = 'MINUS';
    value = -(Math.floor(Math.random() * 10) + 1);
  } else if (['바위', '강철', '땅'].includes(type)) {
    cardType = 'PASS';
    value = 0;
  } else {
    cardType = 'PLUS';
    value = Math.floor(Math.random() * 10) + 1;
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    monsterId: m.id,
    name: m.name,
    image: m.image,
    cardType,
    value,
    element: type
  };
};

export default function BombArena({ allMonsters, onClose, onlineUsers, initialOpponentId, isHost, roomId }: BombArenaProps) {
  const { currentUser } = useGameStore();
  const [users, setUsers] = useState<{id:string, name:string}[]>([]);
  
  const [gameState, setGameState] = useState<BombGameState>({
    step: 'LOBBY', maxPlayers: 4, players: [], turnIndex: 0, direction: 1, gauge: 0, isBlind: false, boss: null, winnerName: null,
    rpsQueue: [], rankedPlayers: [], rpsMsg: '가위바위보를 선택하세요!', lastActionMsg: ''
  });
  
  const [channel, setChannel] = useState<any>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const stateRef = useRef(gameState); 
  stateRef.current = gameState;

  // BGM 연동 (90 이상일 때 재생)
  useEffect(() => {
    bgmRef.current = new Audio('/sounds/tension-bgm.mp3'); 
    bgmRef.current.loop = true;
    return () => {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.currentTime = 0; }
      if (channel) supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  useEffect(() => {
    if (gameState.step === 'PLAYING') {
      if (gameState.gauge >= 90) {
        bgmRef.current?.play().catch(() => {}); 
      } else {
        bgmRef.current?.pause();
      }
    }
  }, [gameState.gauge, gameState.step]);

  // 유저 정보 가져오기
  useEffect(() => { getUsers().then(setUsers); }, []);

  // 멀티플레이 채널 세팅
  useEffect(() => {
    if (!currentUser) return;
    const roomName = roomId || `bomb_${currentUser.id}_${Math.random().toString(36).substring(7)}`;
    const chan = supabase.channel(roomName, { config: { presence: { key: currentUser.id } } });

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
          const hostPlayer: BombPlayer = {
            id: currentUser.id, name: currentUser.name, isBot: false, hand: Array.from({length: 5}).map(() => drawCard(allMonsters)), isEliminated: false
          };
          updateState({ players: [hostPlayer] });
        } else if (initialOpponentId) {
          chan.send({ type: 'broadcast', event: 'PLAYER_ACTION', payload: { actionType: 'JOIN', data: { id: currentUser.id, name: currentUser.name } } });
        }
      }
    });
    setChannel(chan);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateState = (updates: Partial<BombGameState>) => {
    const newState = { ...stateRef.current, ...updates };
    setGameState(newState);
    if (channel && isHost) {
      channel.send({ type: 'broadcast', event: 'SYNC_STATE', payload: { state: newState } });
    }
  };

  const handlePlayerAction = (type: string, data: any) => {
    const state = stateRef.current;
    if (type === 'JOIN' && state.step === 'LOBBY' && state.players.length < state.maxPlayers) {
      const newPlayer: BombPlayer = { id: data.id, name: data.name, isBot: false, hand: Array.from({length: 5}).map(() => drawCard(allMonsters)), isEliminated: false };
      if (!state.players.find(p => p.id === data.id)) updateState({ players: [...state.players, newPlayer] });
    } else if (type === 'RPS' && state.step === 'RPS') {
      const updatedPlayers = state.players.map(p => p.id === data.id ? { ...p, rpsChoice: data.choice as any } : p);
      updateState({ players: updatedPlayers });
      checkAllRPSReady(updatedPlayers);
    } else if (type === 'PLAY_CARD' && state.step === 'PLAYING') {
      processCardPlay(data.playerId, data.cardId);
    }
  };

  const invitePlayer = (uId: string) => {
    supabase.channel('global_lobby').send({
      type: 'broadcast', event: 'battle_invite',
      payload: { hostId: currentUser?.id, hostName: currentUser?.name, targetId: uId, gameType: 'BOMB' }
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
    updateState({ 
      players: currentPlayers, 
      step: 'RPS', 
      rpsQueue: [currentPlayers.map(p => p.id)], 
      rankedPlayers: [],
      rpsMsg: '가위바위보를 선택하세요!' 
    });
  };

  // ================= 가위바위보 로직 (무한 리트라이 적용) =================
  const submitRPS = (choice: 'ROCK' | 'PAPER' | 'SCISSORS') => {
    if (isHost) {
      const updated = stateRef.current.players.map(p => p.id === currentUser?.id ? { ...p, rpsChoice: choice } : p);
      updateState({ players: updated });
      checkAllRPSReady(updated);
    } else {
      channel?.send({ type: 'broadcast', event: 'PLAYER_ACTION', payload: { actionType: 'RPS', data: { id: currentUser?.id, choice } } });
    }
  };

  const checkAllRPSReady = (players: BombPlayer[]) => {
    const state = stateRef.current;
    const currentGroup = state.rpsQueue[0];
    if (!currentGroup) return;

    let updatedPlayers = [...players];
    
    // 봇들 자동 내기
    currentGroup.forEach(id => {
      const p = updatedPlayers.find(x => x.id === id);
      if (p && p.isBot && !p.rpsChoice) {
        const choices = ['ROCK', 'PAPER', 'SCISSORS'] as const;
        p.rpsChoice = choices[Math.floor(Math.random() * 3)];
      }
    });

    const allReady = currentGroup.every(id => updatedPlayers.find(p => p.id === id)?.rpsChoice);
    if (!allReady) {
      updateState({ players: updatedPlayers });
      return;
    }

    const choices = new Set(currentGroup.map(id => updatedPlayers.find(p => p.id === id)!.rpsChoice));
    
    if (choices.size === 1 || choices.size === 3) {
      // 무승부 -> 해당 그룹 다시
      currentGroup.forEach(id => { updatedPlayers.find(x => x.id === id)!.rpsChoice = undefined; });
      updateState({ players: updatedPlayers, rpsMsg: '비겼습니다! 최후의 승자가 나올 때까지 다시 냅니다!' });
    } else {
      // 승패 결정
      const hasRock = choices.has('ROCK');
      const hasPaper = choices.has('PAPER');
      const hasScissors = choices.has('SCISSORS');
      let winChoice = '';
      if (hasRock && hasScissors) winChoice = 'ROCK';
      else if (hasScissors && hasPaper) winChoice = 'SCISSORS';
      else if (hasPaper && hasRock) winChoice = 'PAPER';

      const winners = currentGroup.filter(id => updatedPlayers.find(p => p.id === id)!.rpsChoice === winChoice);
      const losers = currentGroup.filter(id => updatedPlayers.find(p => p.id === id)!.rpsChoice !== winChoice);

      let newQueue = state.rpsQueue.slice(1);
      if (losers.length > 0) newQueue.unshift(losers);
      if (winners.length > 0) newQueue.unshift(winners);

      let newRanked = [...state.rankedPlayers];
      while (newQueue.length > 0 && newQueue[0].length === 1) {
        newRanked.push(newQueue.shift()![0]);
      }

      updatedPlayers.forEach(p => p.rpsChoice = undefined);

      if (newQueue.length === 0) {
        updatedPlayers.sort((a, b) => newRanked.indexOf(a.id) - newRanked.indexOf(b.id));
        const boss = allMonsters.filter(m => m.rarity === 'MYTHICAL' || m.rarity === 'LEGENDARY')[0] || allMonsters[0];
        
        updateState({ players: updatedPlayers, rpsQueue: [], rankedPlayers: newRanked, step: 'RPS_RESULT', boss });
        setTimeout(() => { updateState({ step: 'PLAYING', turnIndex: 0 }); }, 4000);
      } else {
        updateState({ players: updatedPlayers, rpsQueue: newQueue, rankedPlayers: newRanked, rpsMsg: '승패가 갈렸습니다! 다음 순위를 결정합니다.' });
      }
    }
  };

  // ================= 99 폭탄 게임 로직 =================
  const playMyCard = (cardId: string) => {
    if (isHost) processCardPlay(currentUser!.id, cardId);
    else channel?.send({ type: 'broadcast', event: 'PLAYER_ACTION', payload: { actionType: 'PLAY_CARD', data: { playerId: currentUser!.id, cardId } } });
  };

  const processCardPlay = (playerId: string, cardId: string) => {
    const state = stateRef.current;
    if (state.players[state.turnIndex].id !== playerId) return;

    let newDirection = state.direction;
    let newGauge = state.gauge;
    let newBlind = false;

    const playerIndex = state.turnIndex;
    const player = state.players[playerIndex];
    const playedCard = player.hand.find(c => c.id === cardId);
    if (!playedCard) return;

    const actionMsg = `가랏! ${playedCard.name}! (${getCardLabel(playedCard.cardType)} ${getCardValueStr(playedCard)})`;

    if (playedCard.cardType === 'RESET') newGauge = 50;
    else if (playedCard.cardType === 'REVERSE') newDirection = (state.direction * -1) as 1 | -1;
    else if (playedCard.cardType === 'BLIND') { newBlind = true; newGauge += playedCard.value; }
    else newGauge += playedCard.value; 

    const newHand = player.hand.filter(c => c.id !== cardId);
    newHand.push(drawCard(allMonsters));

    const updatedPlayers = [...state.players];
    let finalActionMsg = actionMsg;
    
    // 💣 폭발 로직: 99 이상이면 탈락
    if (newGauge >= 99) {
      updatedPlayers[playerIndex] = { ...player, isEliminated: true, hand: newHand };
      finalActionMsg = `💥 ${player.name} 폭발! (게이지 99 이상)`;
      newGauge = 50; // 남은 사람들을 위해 게이지 초기화
    } else {
      updatedPlayers[playerIndex] = { ...player, hand: newHand };
    }

    let nextTurn = state.turnIndex;
    let aliveCount = updatedPlayers.filter(p => !p.isEliminated).length;
    
    if (aliveCount <= 1) {
      const winner = updatedPlayers.find(p => !p.isEliminated);
      updateState({ players: updatedPlayers, gauge: newGauge, step: 'RESULT', winnerName: winner?.name || '무승부', lastActionMsg: finalActionMsg });
      if (bgmRef.current) bgmRef.current.pause();
      return;
    }

    do {
      nextTurn = (nextTurn + newDirection + updatedPlayers.length) % updatedPlayers.length;
    } while (updatedPlayers[nextTurn].isEliminated);

    updateState({ players: updatedPlayers, gauge: newGauge, direction: newDirection, turnIndex: nextTurn, isBlind: newBlind, lastActionMsg: finalActionMsg });
  };

  // 🤖 봇 AI (생존 우선)
  useEffect(() => {
    if (!isHost || gameState.step !== 'PLAYING') return;

    const currentP = gameState.players[gameState.turnIndex];
    if (currentP && currentP.isBot && !currentP.isEliminated) {
      const timer = setTimeout(() => {
        const safeCards = currentP.hand.filter(c => {
          if (c.cardType === 'RESET' || c.cardType === 'REVERSE' || c.cardType === 'PASS') return true;
          return gameState.gauge + c.value < 99;
        });

        if (safeCards.length > 0) {
          const cardToPlay = safeCards[Math.floor(Math.random() * safeCards.length)];
          processCardPlay(currentP.id, cardToPlay.id);
        } else {
          // 살 길이 없으면 제일 작은 수를 내고 터짐
          const sorted = [...currentP.hand].sort((a,b) => a.value - b.value);
          processCardPlay(currentP.id, sorted[0].id);
        }
      }, 2000); 
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.turnIndex, gameState.step, isHost]);

  // ================= 렌더링 =================
  const myPlayerInfo = gameState.players.find(p => p.id === currentUser?.id);
  const isMyTurn = gameState.step === 'PLAYING' && gameState.players[gameState.turnIndex]?.id === currentUser?.id;
  const isRPSActive = gameState.rpsQueue[0]?.includes(currentUser?.id || '');

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center p-4 bg-gray-900/95 backdrop-blur-xl touch-none overflow-hidden text-white font-sans">
      
      {/* 폭발해서 패배한 유저용 모달 (나가기 전용) */}
      <AnimatePresence>
        {myPlayerInfo?.isEliminated && gameState.step === 'PLAYING' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-6 text-center">
            <div className="text-9xl mb-6 animate-bounce">💥</div>
            <h2 className="text-5xl font-black text-red-500 mb-4">펑! 폭발했습니다!</h2>
            <p className="text-gray-300 text-xl font-bold mb-12">99를 초과하여 게임에서 패배했습니다.</p>
            <button onClick={onClose} className="px-10 py-5 bg-gray-700 hover:bg-gray-600 text-white rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all">
              게임 나가기 🚪
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={onClose} className="absolute top-6 right-6 text-4xl hover:text-red-400 transition-transform z-[100]">✖</button>

      <AnimatePresence mode="wait">
        
        {/* 대기방 */}
        {gameState.step === 'LOBBY' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl bg-gray-800 p-8 rounded-3xl border-4 border-red-500 shadow-2xl">
            <h2 className="text-4xl font-black mb-2 text-center text-red-400">💣 몬스터 폭탄 돌리기</h2>
            <p className="text-center text-gray-400 mb-8 font-bold">99 이상이 되면 폭발합니다! 끝까지 살아남으세요.</p>
            
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
                  <h3 className="font-bold text-yellow-400 mb-3">접속 중인 유저 초대</h3>
                  <div className="flex gap-2 overflow-x-auto">
                    {onlineUsers.filter(uid => uid !== currentUser?.id).map(uid => {
                      const u = users.find(x => x.id === uid);
                      return u ? (
                        <button key={uid} onClick={() => invitePlayer(uid)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold shadow whitespace-nowrap">
                          {u.name} 초대
                        </button>
                      ) : null;
                    })}
                    {onlineUsers.length <= 1 && <span className="text-gray-500 text-sm">현재 접속 중인 다른 유저가 없습니다.</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mb-8">
                  <h3 className="font-bold text-green-400">참가 대기 명단 ({gameState.players.length}/{gameState.maxPlayers})</h3>
                  {gameState.players.map(p => <div key={p.id} className="bg-gray-700 p-3 rounded-lg font-bold">✅ {p.name} {p.id===currentUser?.id && '(나)'}</div>)}
                </div>
                <button onClick={fillWithBotsAndStart} className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">
                  빈자리 로봇 채우고 시작 🚀
                </button>
              </>
            ) : (
               <div className="text-center py-20">
                 <div className="text-6xl animate-spin mb-4">⏳</div>
                 <h2 className="text-2xl font-bold text-yellow-300">방장이 게임을 설정 중입니다...</h2>
               </div>
            )}
          </motion.div>
        )}

        {/* 가위바위보 */}
        {gameState.step === 'RPS' && (
          <motion.div key="rps" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center w-full max-w-xl bg-gray-800 p-10 rounded-3xl border-4 border-yellow-400 shadow-2xl">
            <h2 className="text-5xl font-black mb-6 text-yellow-400">✌️ ✊ 🖐</h2>
            <p className="text-2xl text-white mb-2 font-black">{gameState.rpsMsg}</p>
            <p className="text-gray-400 mb-10 font-bold">이긴 순서대로 카드를 냅니다.</p>
            
            {isRPSActive && !myPlayerInfo?.rpsChoice ? (
              <div className="flex justify-center gap-6">
                {[
                  { id: 'SCISSORS', emoji: '✌️', color: 'bg-pink-500' },
                  { id: 'ROCK', emoji: '✊', color: 'bg-blue-500' },
                  { id: 'PAPER', emoji: '🖐', color: 'bg-green-500' }
                ].map(opt => (
                  <button key={opt.id} onClick={() => submitRPS(opt.id as any)} className={`${opt.color} hover:scale-110 active:scale-95 transition-all w-28 h-28 rounded-3xl text-6xl shadow-xl flex items-center justify-center border-4 border-white`}>
                    {opt.emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-400 animate-pulse mt-10">다른 친구들이 내기를 기다리는 중...</div>
            )}
          </motion.div>
        )}

        {/* 가위바위보 결과 */}
        {gameState.step === 'RPS_RESULT' && (
          <motion.div key="rps_result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-full max-w-2xl bg-gray-800 p-8 rounded-3xl border-4 border-yellow-400 shadow-2xl">
            <h2 className="text-3xl font-black mb-6 text-white">최종 턴 순서</h2>
            <div className="flex flex-col gap-3">
              {gameState.players.map((p, idx) => (
                <div key={p.id} className={`flex justify-between items-center p-4 rounded-xl text-xl font-bold ${p.id === currentUser?.id ? 'bg-blue-600 text-white' : 'bg-gray-700'}`}>
                  <span className="flex items-center gap-4">
                    <span className="bg-yellow-500 text-yellow-900 w-8 h-8 rounded-full flex items-center justify-center text-sm">{idx + 1}</span>
                    {p.name} {p.isBot && '🤖'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-red-400 font-black text-xl animate-pulse">곧 본 게임이 시작됩니다!</p>
          </motion.div>
        )}

        {/* 본 게임 */}
        {gameState.step === 'PLAYING' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full h-full max-w-5xl justify-between pt-10 pb-4 relative">
            
            {/* 내 순서 알림 배너 */}
            <AnimatePresence>
              {isMyTurn && !myPlayerInfo?.isEliminated && (
                <motion.div initial={{y: -50, opacity: 0}} animate={{y: 0, opacity: 1}} exit={{opacity: 0}} className="absolute top-24 left-0 right-0 z-[100] flex justify-center pointer-events-none">
                  <div className="bg-yellow-400 text-yellow-900 font-black text-2xl md:text-4xl px-8 py-3 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-pulse border-4 border-white">
                    나의 차례입니다! 카드를 내주세요!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 상단 플레이어 리스트 */}
            <div className="flex justify-center gap-4 md:gap-8 mb-4">
              {gameState.players.map((p) => (
                <div key={p.id} className={`flex flex-col items-center bg-gray-800 px-4 py-2 rounded-2xl border-4 transition-colors ${gameState.players[gameState.turnIndex].id === p.id ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]' : 'border-transparent'} ${p.isEliminated ? 'opacity-30 grayscale' : ''}`}>
                  <div className="text-2xl mb-1">{p.isBot ? '🤖' : (p.id === currentUser?.id ? '👦' : '🧑')}</div>
                  <span className={`text-sm font-bold w-20 truncate text-center ${p.id === currentUser?.id ? 'text-yellow-300' : 'text-white'}`}>{p.name}</span>
                  {p.isEliminated ? (
                    <span className="text-xs text-red-500 font-black mt-1">펑! 💣</span>
                  ) : (
                    <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded mt-1">카드 {p.hand.length}장</span>
                  )}
                </div>
              ))}
            </div>

            {/* 중앙 폭탄 & 메시지 */}
            <div className="flex-1 flex flex-col items-center justify-center relative my-4">
              {/* 카드 제출 액션 메시지 */}
              <div className="absolute top-0 text-xl md:text-3xl font-black text-white bg-black/50 px-6 py-2 rounded-full border border-gray-600 shadow-lg text-center min-w-[250px]">
                {gameState.lastActionMsg || '게임을 시작합니다!'}
              </div>

              <div className={`relative w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center transition-all duration-300 mt-12 ${gameState.gauge >= 90 ? 'animate-pulse scale-110 drop-shadow-[0_0_50px_rgba(239,68,68,1)]' : 'drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]'}`}>
                {gameState.boss?.image && (
                  <Image src={gameState.boss.image} alt="Boss" fill className="object-contain z-10 pointer-events-none" />
                )}
                {/* 턴 방향 표시 UI */}
                <div className="absolute inset-0 border-8 border-dashed border-gray-500 rounded-full animate-[spin_6s_linear_infinite]" style={{ animationDirection: gameState.direction === 1 ? 'normal' : 'reverse' }} />
              </div>

              {/* 💣 숫자 판 */}
              <div className="mt-8 relative z-20">
                {gameState.isBlind ? (
                  <div className="text-7xl font-black text-gray-500 bg-gray-800 border-8 border-gray-600 px-10 py-4 rounded-[3rem] shadow-2xl">
                    ???
                  </div>
                ) : (
                  <div className={`text-8xl md:text-[8rem] font-black px-12 py-4 rounded-[3rem] shadow-2xl border-8 transition-colors ${gameState.gauge >= 90 ? 'bg-red-600 text-white border-yellow-400' : 'bg-gray-800 text-yellow-400 border-gray-600'}`}>
                    {gameState.gauge}
                  </div>
                )}
                <div className="absolute -top-6 -right-6 bg-red-500 text-white font-black px-4 py-2 rounded-full text-lg transform rotate-12 shadow-lg border-2 border-white">
                  99 이상 펑!
                </div>
              </div>
            </div>

            {/* 하단 내 핸드 */}
            {myPlayerInfo && !myPlayerInfo.isEliminated && (
              <div className={`w-full flex flex-col items-center p-4 rounded-t-[3rem] border-t-4 transition-colors ${isMyTurn ? 'bg-blue-900/50 border-blue-400 shadow-[0_-10px_30px_rgba(59,130,246,0.3)]' : 'bg-gray-800/80 border-gray-700'}`}>
                <div className="flex justify-between w-full max-w-3xl mb-4 px-4 items-end">
                  <span className="font-bold text-gray-400">내 카드 (항상 5장 유지)</span>
                  {isMyTurn ? (
                    <span className="bg-yellow-400 text-yellow-900 font-black px-4 py-1.5 rounded-full shadow-md">위로 터치해서 내기 👉</span>
                  ) : (
                    <span className="text-gray-500 font-bold">다른 사람을 기다리는 중...</span>
                  )}
                </div>

                <div className="flex gap-2 md:gap-4 overflow-x-auto w-full max-w-4xl px-2 pb-4 scrollbar-hide items-center justify-center">
                  <AnimatePresence>
                    {myPlayerInfo.hand.map(card => {
                      return (
                        <motion.div 
                          key={card.id}
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -200, scale: 1.5, opacity: 0 }}
                          whileHover={isMyTurn ? { y: -15, scale: 1.05 } : {}}
                          onClick={() => {
                            if (isMyTurn) playMyCard(card.id);
                          }}
                          className={`w-20 md:w-28 aspect-[3/4] rounded-2xl border-[3px] flex flex-col items-center justify-between p-2 shadow-lg relative bg-white transition-all ${isMyTurn ? 'cursor-pointer border-gray-200 hover:border-blue-500' : 'border-gray-400 grayscale opacity-80'}`}
                        >
                          <div className="w-full flex justify-between items-start z-10">
                            <span className="text-[8px] bg-gray-200 text-gray-600 px-1.5 rounded font-black">{card.element}</span>
                            <span className={`text-[10px] font-black px-1.5 rounded text-white ${
                              card.cardType === 'PLUS' ? 'bg-red-500' : card.cardType === 'MINUS' ? 'bg-blue-500' : card.cardType === 'PASS' ? 'bg-gray-500' : 'bg-purple-600'
                            }`}>
                              {getCardLabel(card.cardType)}
                            </span>
                          </div>

                          <div className="relative w-full flex-1 mt-1 mb-1 pointer-events-none">
                            <Image src={card.image} alt={card.name} fill className="object-contain drop-shadow-md" />
                          </div>

                          <div className={`w-full text-center rounded-lg py-1 border-2 font-black text-sm md:text-base z-10 ${
                            card.cardType === 'PLUS' ? 'bg-red-100 text-red-700 border-red-200' :
                            card.cardType === 'MINUS' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            card.cardType === 'PASS' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                            'bg-purple-100 text-purple-700 border-purple-200 text-[10px] md:text-xs tracking-tighter'
                          }`}>
                            {getCardValueStr(card) || getCardLabel(card.cardType)}
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

        {/* 결과창 */}
        {gameState.step === 'RESULT' && (
          <motion.div key="result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center bg-gray-800 p-12 rounded-[3rem] border-4 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.5)] z-50">
            <h2 className="text-6xl mb-4">🏆</h2>
            <h3 className="text-4xl font-black text-white mb-2">최후의 생존자</h3>
            <div className="text-5xl font-black text-yellow-300 mb-10 drop-shadow-lg p-4 bg-gray-900 rounded-2xl">
              {gameState.winnerName}
            </div>
            <button onClick={onClose} className="w-full bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-black py-4 px-10 rounded-2xl shadow-xl active:scale-95 transition-all text-2xl">
              마을로 돌아가기
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}