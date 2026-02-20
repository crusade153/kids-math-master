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

// ⭐️ 일일 미션 보상 테이블 (목표 개수와 보상 코인)
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

  // ⭐️ store에서 미션 관련 상태와 함수들을 가져옵니다.
  const { 
    currentUser, login, logout, addScore, incrementCombo, resetCombo, resetGame, 
    feverMode, combo, addCoins, spendCoins,
    dailySolvedCount, claimedRewards, incrementSolvedCount, claimMissionReward 
  } = useGameStore();

  useEffect(() => {
    getMonsters().then(setAllMonsters);
  }, []);

  if (!currentUser) return <UserSelector onSelect={login} />;

  const startGame = (mode: MathOperation, level: Difficulty) => {
    setGameMode(mode); setDifficulty(level); loadNewProblem(mode, level); resetGame();
  };

  const loadNewProblem = (mode: MathOperation, level: Difficulty) => {
    setProblem(generateProblem(mode, level)); setInput(''); setMessage(combo > 0 ? 'Keep going! 🚀' : 'Ready?');
  };

  const handleInput = (num: string) => { if (input.length < 3) setInput(prev => prev + num); };
  const handleDelete = () => { setInput(prev => prev.slice(0, -1)); };
  
  const handleEnter = () => {
    if (!problem || input === '') return;
    if (parseInt(input) === problem.answer) {
      addScore(problem.rewardPoints * (feverMode ? 2 : 1));
      addCoins(problem.rewardCoins * (feverMode ? 2 : 1));
      incrementCombo();
      incrementSolvedCount(); // ⭐️ 정답 시 문제 풀이 횟수 증가!
      setMessage(`Excellent! +${problem.rewardCoins * (feverMode ? 2 : 1)}코인 ✨`);
      confetti({ particleCount: feverMode ? 100 : 30, spread: 60, origin: { y: 0.6 }, colors: ['#FFD700', '#FFA500', '#4CAF50'] });
      setTimeout(() => loadNewProblem(gameMode!, difficulty!), 500); 
    } else {
      resetCombo(); setMessage('Try again! 😅'); setInput('');
    }
  };

  // ⭐️ 보스 레이드 입장 로직 (1코인 소모)
  const enterBossRaid = () => {
    if (currentUser.coins >= 1) {
      if(window.confirm("보스 레이드에 입장하시겠습니까? (1코인 소모)")) {
        spendCoins(1);
        setShowBossRaid(true);
      }
    } else {
      alert("코인이 부족합니다! 수학 문제를 더 풀고 1코인을 모아오세요 📚");
    }
  };

  // ⭐️ 유저 배틀 입장 로직 (1코인 소모)
  const enterBattle = () => {
    if (currentUser.coins >= 1) {
      if(window.confirm("유저 대결에 입장하시겠습니까? (1코인 소모)")) {
        spendCoins(1);
        setShowBattle(true);
      }
    } else {
      alert("코인이 부족합니다! 수학 문제를 더 풀고 1코인을 모아오세요 📚");
    }
  };

  if (!gameMode) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-blue-50 p-4 overflow-hidden relative">
        <div className="absolute top-4 right-4 flex gap-4 z-10">
          <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-lg font-bold text-gray-700 flex items-center gap-2">👤 {currentUser.name}</div>
          <div className="bg-yellow-400 px-4 py-2 rounded-full shadow-lg font-black text-white flex items-center gap-2">🪙 {currentUser.coins}</div>
          <button onClick={logout} className="bg-gray-200 px-3 rounded-full text-xs hover:bg-gray-300 transition font-bold">로그아웃</button>
        </div>

        <MotionCard delay={0.1}>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2 drop-shadow-sm text-center mt-10">
            BRAIN ACADEMY
          </h1>
          <p className="text-center text-gray-500 mb-6 font-bold">말랑말랑 두뇌 체조 🧠</p>
        </MotionCard>

        {/* ⭐️ 일일 미션 UI (계단식 보상) */}
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-md p-4 mb-6 border-2 border-indigo-100">
          <h3 className="font-black text-indigo-600 mb-2 flex justify-between">
            <span>📅 오늘의 수학 미션</span>
            <span>{dailySolvedCount} / 50 문제</span>
          </h3>
          {/* 프로그레스 바 */}
          <div className="w-full h-4 bg-gray-200 rounded-full mb-4 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-500" 
              style={{ width: `${Math.min((dailySolvedCount / 50) * 100, 100)}%` }} 
            />
          </div>
          {/* 보상 버튼들 */}
          <div className="grid grid-cols-4 gap-2">
            {DAILY_MISSIONS.map((mission) => {
              const isCleared = dailySolvedCount >= mission.step;
              const isClaimed = claimedRewards.includes(mission.step);
              return (
                <button 
                  key={mission.step}
                  onClick={() => claimMissionReward(mission.step, mission.reward)}
                  disabled={!isCleared || isClaimed}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                    isClaimed ? 'bg-gray-100 opacity-50 grayscale' : 
                    isCleared ? 'bg-yellow-400 hover:bg-yellow-300 shadow-lg animate-bounce' : 
                    'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className="text-[10px] font-black text-gray-600">{mission.step}개</span>
                  <span className="text-sm font-black mt-1">{isClaimed ? '✔️' : '🎁'}</span>
                  <span className="text-[10px] font-bold mt-1 text-red-600">+{mission.reward}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* 학습 콘텐츠 영역 (스크롤 축소) */}
        <div className="w-full max-w-sm space-y-4 mb-6 max-h-[30vh] overflow-y-auto p-2 scrollbar-hide">
          <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-green-100">
            <h3 className="text-center font-bold text-green-600 mb-2">➕ 덧셈</h3>
            <div className="grid grid-cols-3 gap-2"><button onClick={() => startGame('ADD', 'LEVEL_1')} className="bg-green-100 text-green-700 py-2 rounded-xl font-bold text-sm">1단계</button><button onClick={() => startGame('ADD', 'LEVEL_2')} className="bg-green-200 text-green-800 py-2 rounded-xl font-bold text-sm">2단계</button><button onClick={() => startGame('ADD', 'LEVEL_3')} className="bg-green-500 text-white py-2 rounded-xl font-bold text-sm shadow">3단계</button></div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-orange-100">
            <h3 className="text-center font-bold text-orange-600 mb-2">➖ 뺄셈</h3>
            <div className="grid grid-cols-3 gap-2"><button onClick={() => startGame('SUB', 'LEVEL_1')} className="bg-orange-100 text-orange-700 py-2 rounded-xl font-bold text-sm">1단계</button><button onClick={() => startGame('SUB', 'LEVEL_2')} className="bg-orange-200 text-orange-800 py-2 rounded-xl font-bold text-sm">2단계</button><button onClick={() => startGame('SUB', 'LEVEL_3')} className="bg-orange-500 text-white py-2 rounded-xl font-bold text-sm shadow">3단계</button></div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border-b-4 border-purple-100">
            <h3 className="text-center font-bold text-purple-600 mb-2">✖️ 구구단</h3>
            <div className="grid grid-cols-3 gap-2"><button onClick={() => startGame('MUL', 'LEVEL_1')} className="bg-purple-100 text-purple-700 py-2 rounded-xl font-bold text-sm">1단계</button><button onClick={() => startGame('MUL', 'LEVEL_2')} className="bg-purple-200 text-purple-800 py-2 rounded-xl font-bold text-sm">2단계</button><button onClick={() => startGame('MUL', 'LEVEL_3')} className="bg-purple-500 text-white py-2 rounded-xl font-bold text-sm shadow">3단계</button></div>
          </div>
        </div>

        {/* 게임 콘텐츠 통합 메뉴 */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          {/* 보스 레이드 (입장료 1코인) */}
          <button onClick={enterBossRaid} className="w-full bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white font-black py-4 rounded-2xl shadow-[0_5px_0_rgba(153,27,27,1)] active:scale-95 active:translate-y-1 transition-all flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-3xl animate-pulse">🐉</span>
              <span className="text-xl tracking-widest drop-shadow-md">월드 보스 레이드</span>
            </div>
            <span className="text-xs bg-red-900/50 px-3 py-1 rounded-full">입장료: 🪙 1코인</span>
          </button>
          
          <div className="grid grid-cols-2 gap-3 w-full pb-10">
            <button onClick={() => setShowGachaShop(true)} className="bg-white text-gray-800 font-black py-3 rounded-2xl shadow-md border-b-4 border-yellow-300 flex flex-col items-center active:scale-95 transition-transform"><span className="text-xl">🏪</span><span className="text-xs mt-1">뽑기 상점</span></button>
            <button onClick={() => setShowMergeLab(true)} className="bg-gray-800 text-white font-black py-3 rounded-2xl shadow-md border-b-4 border-indigo-500 flex flex-col items-center active:scale-95 transition-transform"><span className="text-xl">🧪</span><span className="text-xs mt-1 text-indigo-200">합성소</span></button>
            <button onClick={() => setShowCollection(true)} className="bg-white text-gray-800 font-black py-3 rounded-2xl shadow-md border-b-4 border-blue-300 flex flex-col items-center active:scale-95 transition-transform"><span className="text-xl">📖</span><span className="text-xs mt-1">내 도감</span></button>
            {/* 유저 배틀 (입장료 1코인) */}
            <button onClick={enterBattle} className="bg-blue-50 text-blue-900 font-black py-3 rounded-2xl shadow-md border-b-4 border-blue-400 flex flex-col items-center active:scale-95 transition-transform">
              <span className="text-xl">⚔️</span>
              <span className="text-xs mt-1">유저 대결 (-1🪙)</span>
            </button>
          </div>
        </div>

        {showGachaShop && <GachaShop onClose={() => setShowGachaShop(false)} onHatch={(monster) => setShowHatch(monster)} />}
        {showMergeLab && <MergeLab monsters={allMonsters} onClose={() => setShowMergeLab(false)} />}
        {showCollection && <CollectionBook monsters={allMonsters} inventory={currentUser.inventory} onClose={() => setShowCollection(false)} />}
        {showHatch && <EggHatch monster={showHatch} onClose={() => setShowHatch(null)} />}
        {showBattle && <BattleArena onClose={() => setShowBattle(false)} />}
        {showBossRaid && <BossRaid onClose={() => setShowBossRaid(false)} />}
      </main>
    );
  }

  // 게임 화면
  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ${feverMode ? 'bg-red-50' : 'bg-yellow-50'}`}>
      <div className="absolute top-4 right-4 font-black text-yellow-600 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-md">🪙 {currentUser.coins}</div>
      <BrainGauge />
      <AnimatePresence mode='wait'>
        <motion.div key={problem?.id} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="w-full max-w-md">
           <VisualBoard problem={problem} input={input} />
        </motion.div>
      </AnimatePresence>
      <div className={`h-8 mt-4 text-xl font-bold transition-transform ${message.includes('Try') ? 'text-red-500 animate-shake' : 'text-blue-500'}`}>{message}</div>
      <NumberPad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />
      <button onClick={() => setGameMode(null)} className="mt-8 text-gray-500 hover:text-gray-800 font-bold text-sm bg-white/80 px-6 py-3 rounded-full transition-all shadow-sm">← 그만하기</button>
    </main>
  );
}