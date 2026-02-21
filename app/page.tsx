// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { MathProblem, MathOperation, Difficulty } from '@/types/math';
import { Monster } from '@/types/game';
import NumberPad from '@/components/ui/number-pad';
import VisualBoard from '@/components/ui/visual-board';
import MotionCard from '@/components/ui/motion-card';
import BrainGauge from '@/components/ui/brain-gauge';
import EggHatch from '@/components/game/egg-hatch';
import CollectionBook from '@/components/game/collection-book';
import UserSelector from '@/components/game/user-selector';
import BattleArena from '@/components/game/battle-arena'; 
import GachaShop from '@/components/game/gacha-shop';
import MergeLab from '@/components/game/merge-lab';
import BossRaid from '@/components/game/boss-raid';
import { useGameStore } from '@/store/game-store';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { generateProblem } from '@/lib/generator';
import { getMonsters } from '@/actions/game-actions';
import { supabase } from '@/lib/supabase';

const DAILY_MISSIONS = [
  { step: 20, reward: 10 },
  { step: 30, reward: 20 },
  { step: 40, reward: 50 },
  { step: 50, reward: 100 },
];

export default function Home() {
  const [gameMode, setGameMode] = useState<MathOperation | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  
  const [showHatch, setShowHatch] = useState<Monster | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [showBattle, setShowBattle] = useState(false); 
  const [showGachaShop, setShowGachaShop] = useState(false);
  const [showMergeLab, setShowMergeLab] = useState(false);
  const [showBossRaid, setShowBossRaid] = useState(false); 
  
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);

  // 실시간 대결을 위한 상태
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<{ hostId: string, hostName: string } | null>(null);
  const [battleProps, setBattleProps] = useState<{ initialOpponentId?: string, isHost?: boolean, roomId?: string } | null>(null);

  const { 
    currentUser, login, logout, addScore, incrementCombo, resetCombo, resetGame, 
    feverMode, combo, addCoins, spendCoins,
    dailySolvedCount, claimedRewards, incrementSolvedCount, claimMissionReward 
  } = useGameStore();

  useEffect(() => {
    getMonsters().then(setAllMonsters);
  }, []);

  // 글로벌 로비 접속 및 초대장 수신 로직
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('global_lobby', {
      config: { presence: { key: currentUser.id } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setOnlineUsers(Object.keys(state));
    });

    channel.on('broadcast', { event: 'battle_invite' }, (payload) => {
      if (payload.payload.targetId === currentUser.id) {
        setIncomingInvite({ hostId: payload.payload.hostId, hostName: payload.payload.hostName });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ name: currentUser.name });
    });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  // ⭐️ 유저가 접속하지 않았으면 무조건 로그인 화면(UserSelector)을 띄움
  if (!currentUser) return <UserSelector onSelect={login} />;

  const startGame = (mode: MathOperation, level: Difficulty) => {
    setGameMode(mode); setDifficulty(level); loadNewProblem(mode, level); resetGame();
  };

  const loadNewProblem = (mode: MathOperation, level: Difficulty) => {
    setProblem(generateProblem(mode, level)); setInput(''); setMessage(combo > 0 ? '계속 가보자! 🚀' : '준비 완료!');
  };

  const handleInput = (num: string) => { if (input.length < 3) setInput(prev => prev + num); };
  const handleDelete = () => { setInput(prev => prev.slice(0, -1)); };
  
  const handleEnter = () => {
    if (!problem || input === '') return;
    if (parseInt(input) === problem.answer) {
      addScore(problem.rewardPoints * (feverMode ? 2 : 1));
      addCoins(problem.rewardCoins * (feverMode ? 2 : 1));
      incrementCombo();
      incrementSolvedCount();
      setMessage(`정답이야! +${problem.rewardCoins * (feverMode ? 2 : 1)}코인 ✨`);
      confetti({ particleCount: feverMode ? 100 : 30, spread: 60, origin: { y: 0.6 }, colors: ['#FFD700', '#FFA500', '#4CAF50'] });
      setTimeout(() => loadNewProblem(gameMode!, difficulty!), 600); 
    } else {
      resetCombo(); setMessage('다시 한 번 생각해볼까? 🤔'); setInput('');
    }
  };

  const enterBossRaid = () => {
    if (currentUser.coins >= 1) {
      if(window.confirm("보스 레이드에 입장할까요? (-1 코인)")) { spendCoins(1); setShowBossRaid(true); }
    } else { alert("코인이 부족해! 수학 문제를 더 풀고 코인을 모아오자 📚"); }
  };

  const enterBattle = () => {
    if (currentUser.coins >= 1) {
      if(window.confirm("친구들과 대결하러 갈까요? (-1 코인)")) {
        spendCoins(1);
        setBattleProps({ isHost: true }); 
        setShowBattle(true);
      }
    } else { alert("코인이 부족해! 수학 문제를 더 풀고 코인을 모아오자 📚"); }
  };

  if (!gameMode) {
    return (
      <main className="flex min-h-screen flex-col items-center bg-blue-50/50 p-4 pb-12 overflow-x-hidden relative">
        {/* 실시간 대결 초대장 UI */}
        <AnimatePresence>
          {incomingInvite && (
            <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} 
              className="fixed top-10 w-full max-w-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-6 rounded-3xl shadow-2xl z-[100] flex flex-col items-center border-4 border-yellow-400">
              <div className="text-4xl mb-2 animate-bounce">⚔️</div>
              <span className="font-black text-xl mb-6 text-center leading-tight">
                <span className="text-yellow-300">{incomingInvite.hostName}</span>님이<br/>실시간 대결을 신청했습니다!
              </span>
              <div className="flex gap-3 w-full">
                <button onClick={() => {
                  setBattleProps({ initialOpponentId: incomingInvite.hostId, isHost: false, roomId: `${incomingInvite.hostId}_${currentUser.id}` });
                  setShowBattle(true);
                  setIncomingInvite(null);
                }} className="flex-1 bg-yellow-400 text-yellow-900 font-black px-6 py-4 rounded-2xl hover:scale-105 active:scale-95 shadow-lg transition-transform">
                  수락하기 🔥
                </button>
                <button onClick={() => setIncomingInvite(null)} className="flex-1 bg-gray-800 text-white font-black px-6 py-4 rounded-2xl hover:scale-105 active:scale-95 shadow-lg transition-transform">
                  도망가기 🏃
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 상단 프로필 바 */}
        <div className="w-full max-w-md flex justify-between items-center bg-white p-3 rounded-full shadow-sm mb-6 mt-2 border border-blue-100 relative z-10">
          <div className="flex items-center gap-2 font-black text-gray-700 ml-2">
            <span className="text-xl">👦</span> {currentUser.name}
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 px-4 py-1.5 rounded-full font-black text-yellow-700 flex items-center gap-1 border border-yellow-300">
              🪙 {currentUser.coins}
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600 font-bold text-xs mr-2">로그아웃</button>
          </div>
        </div>

        <MotionCard delay={0.1} className="w-full max-w-md mb-6 relative z-10">
          <h1 className="text-4xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 drop-shadow-sm">
            BRAIN ACADEMY
          </h1>
        </MotionCard>

        {/* 일일 미션 UI */}
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-5 mb-6 border border-gray-100 relative z-10">
          <div className="flex justify-between items-end mb-3">
            <h3 className="font-black text-indigo-900 text-lg flex items-center gap-2"><span>📅</span> 오늘의 미션</h3>
            <span className="font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full text-sm">{dailySolvedCount}개 성공!</span>
          </div>
          <div className="relative pt-6 pb-2">
            <div className="absolute top-8 left-4 right-4 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-500" style={{ width: `${Math.min((dailySolvedCount / 50) * 100, 100)}%` }} />
            </div>
            <div className="relative flex justify-between px-2">
              {DAILY_MISSIONS.map((mission) => {
                const isCleared = dailySolvedCount >= mission.step;
                const isClaimed = claimedRewards.includes(mission.step);
                return (
                  <div key={mission.step} className="flex flex-col items-center group relative cursor-pointer" onClick={() => claimMissionReward(mission.step, mission.reward)}>
                    <div className="text-[10px] font-black text-gray-400 mb-1">{mission.step}개</div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm z-10 transition-all ${isClaimed ? 'bg-gray-200 text-gray-400 ring-2 ring-white' : isCleared ? 'bg-yellow-400 text-white ring-4 ring-yellow-200 animate-bounce shadow-lg' : 'bg-white text-gray-300 ring-2 ring-gray-200'}`}>
                      {isClaimed ? '✔️' : '🎁'}
                    </div>
                    {isCleared && !isClaimed && (
                      <div className="absolute -bottom-6 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">+{mission.reward} 받기!</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* 학습 구역 */}
        <div className="w-full max-w-md mb-8 relative z-10">
          <div className="flex items-center gap-2 mb-3 px-2">
            <span className="text-xl">📚</span><h2 className="font-black text-gray-700 text-lg">수학 훈련소</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-green-100 flex items-center">
              <div className="w-16 text-center text-2xl drop-shadow-md">➕</div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <button onClick={() => startGame('ADD', 'LEVEL_1')} className="bg-green-50 hover:bg-green-100 text-green-700 py-3 rounded-xl font-black text-sm">1단계</button>
                <button onClick={() => startGame('ADD', 'LEVEL_2')} className="bg-green-100 hover:bg-green-200 text-green-800 py-3 rounded-xl font-black text-sm">2단계</button>
                <button onClick={() => startGame('ADD', 'LEVEL_3')} className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-black text-sm shadow-sm">3단계</button>
              </div>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 flex items-center">
              <div className="w-16 text-center text-2xl drop-shadow-md">➖</div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <button onClick={() => startGame('SUB', 'LEVEL_1')} className="bg-orange-50 hover:bg-orange-100 text-orange-700 py-3 rounded-xl font-black text-sm">1단계</button>
                <button onClick={() => startGame('SUB', 'LEVEL_2')} className="bg-orange-100 hover:bg-orange-200 text-orange-800 py-3 rounded-xl font-black text-sm">2단계</button>
                <button onClick={() => startGame('SUB', 'LEVEL_3')} className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-black text-sm shadow-sm">3단계</button>
              </div>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-purple-100 flex items-center">
              <div className="w-16 text-center text-2xl drop-shadow-md">✖️</div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <button onClick={() => startGame('MUL', 'LEVEL_1')} className="bg-purple-50 hover:bg-purple-100 text-purple-700 py-3 rounded-xl font-black text-sm">1단계</button>
                <button onClick={() => startGame('MUL', 'LEVEL_2')} className="bg-purple-100 hover:bg-purple-200 text-purple-800 py-3 rounded-xl font-black text-sm">2단계</button>
                <button onClick={() => startGame('MUL', 'LEVEL_3')} className="bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-black text-sm shadow-sm">3단계</button>
              </div>
            </div>
          </div>
        </div>

        {/* 모험 타운 */}
        <div className="w-full max-w-md relative z-10">
          <div className="flex items-center gap-2 mb-3 px-2">
            <span className="text-xl">🎮</span><h2 className="font-black text-gray-700 text-lg">모험 타운</h2>
          </div>
          
          <button onClick={enterBossRaid} className="w-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600 text-white font-black py-4 rounded-3xl shadow-[0_4px_0_rgba(153,27,27,1)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-between px-6 mb-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl animate-pulse drop-shadow-lg">🐉</span>
              <span className="text-xl tracking-wide">월드 보스 레이드</span>
            </div>
            <span className="text-sm bg-red-900/60 px-3 py-1 rounded-full border border-red-400">🪙 -1</span>
          </button>
          
          <div className="grid grid-cols-2 gap-3 w-full">
            <button onClick={enterBattle} className="bg-blue-500 text-white font-black py-4 rounded-3xl shadow-[0_4px_0_rgba(29,78,216,1)] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center gap-1 relative overflow-hidden group">
              <span className="text-3xl relative z-10">⚔️</span>
              <span className="text-base mt-1 relative z-10">유저 대결</span>
              {onlineUsers.length > 1 && <div className="absolute top-3 right-3 w-3 h-3 bg-green-400 rounded-full animate-ping border border-green-200"></div>}
            </button>
            <button onClick={() => setShowGachaShop(true)} className="bg-white text-gray-800 font-black py-4 rounded-3xl shadow-[0_4px_0_rgba(209,213,219,1)] active:translate-y-1 active:shadow-none border border-gray-200 transition-all flex flex-col items-center gap-1">
              <span className="text-3xl">🏪</span><span className="text-base mt-1">뽑기 상점</span>
            </button>
            <button onClick={() => setShowMergeLab(true)} className="bg-gray-800 text-white font-black py-4 rounded-3xl shadow-[0_4px_0_rgba(31,41,55,1)] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center gap-1">
              <span className="text-3xl">🧪</span><span className="text-base mt-1 text-indigo-200">합성소</span>
            </button>
            <button onClick={() => setShowCollection(true)} className="bg-white text-gray-800 font-black py-4 rounded-3xl shadow-[0_4px_0_rgba(209,213,219,1)] active:translate-y-1 active:shadow-none border border-gray-200 transition-all flex flex-col items-center gap-1">
              <span className="text-3xl">📖</span><span className="text-base mt-1">내 도감</span>
            </button>
          </div>
        </div>

        {/* 모달들 */}
        {showGachaShop && <GachaShop onClose={() => setShowGachaShop(false)} onHatch={(monster) => setShowHatch(monster)} />}
        {showMergeLab && <MergeLab monsters={allMonsters} onClose={() => setShowMergeLab(false)} />}
        {showCollection && <CollectionBook monsters={allMonsters} inventory={currentUser.inventory} onClose={() => setShowCollection(false)} />}
        {showHatch && <EggHatch monster={showHatch} onClose={() => setShowHatch(null)} />}
        {showBossRaid && <BossRaid onClose={() => setShowBossRaid(false)} />}
        
        {showBattle && (
          <BattleArena 
            onClose={() => { setShowBattle(false); setBattleProps(null); }} 
            onlineUsers={onlineUsers}
            initialOpponentId={battleProps?.initialOpponentId}
            isHost={battleProps?.isHost ?? true}
            roomId={battleProps?.roomId}
          />
        )}
      </main>
    );
  }

  // 수학 문제 풀이 화면
  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ${feverMode ? 'bg-red-50' : 'bg-[#FFFDF5]'}`}>
      <div className="absolute top-4 right-4 font-black text-yellow-700 bg-white px-4 py-2 rounded-full shadow-md border border-yellow-200">🪙 {currentUser.coins}</div>
      <BrainGauge />
      <AnimatePresence mode='wait'>
        <motion.div key={problem?.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="w-full max-w-md">
           <VisualBoard problem={problem} input={input} />
        </motion.div>
      </AnimatePresence>
      <div className={`h-8 mt-2 text-xl font-black transition-transform ${message.includes('다시') ? 'text-red-500 animate-shake' : 'text-blue-500'}`}>{message}</div>
      <NumberPad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />
      <button onClick={() => setGameMode(null)} className="mt-8 text-gray-500 hover:text-gray-800 font-bold text-sm bg-gray-200/50 px-6 py-3 rounded-full transition-all active:scale-95">← 마을로 돌아가기</button>
    </main>
  );
}