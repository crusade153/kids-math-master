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
import GachaShop from '@/components/game/gacha-shop'; // 🏪 상점 추가
import { useGameStore } from '@/store/game-store';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { generateProblem } from '@/lib/generator';
import { getMonsters } from '@/actions/game-actions';

export default function Home() {
  const [gameMode, setGameMode] = useState<MathOperation | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  
  const [showHatch, setShowHatch] = useState<Monster | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [showBattle, setShowBattle] = useState(false); 
  const [showGachaShop, setShowGachaShop] = useState(false); // 🏪 상점 상태 추가
  
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);

  const { 
    currentUser, login, logout,
    addScore, incrementCombo, resetCombo, resetGame, feverMode, combo,
    addCoins 
  } = useGameStore();

  useEffect(() => {
    getMonsters().then(setAllMonsters);
  }, []);

  if (!currentUser) {
    return <UserSelector onSelect={login} />;
  }

  const startGame = (mode: MathOperation, level: Difficulty) => {
    setGameMode(mode);
    setDifficulty(level);
    loadNewProblem(mode, level);
    resetGame();
  };

  const loadNewProblem = (mode: MathOperation, level: Difficulty) => {
    const newProblem = generateProblem(mode, level);
    setProblem(newProblem);
    setInput('');
    setMessage(combo > 0 ? 'Keep going! 🚀' : 'Ready?');
  };

  const handleInput = (num: string) => {
    if (input.length < 3) setInput((prev) => prev + num);
  };

  const handleDelete = () => {
    setInput((prev) => prev.slice(0, -1));
  };

  const handleEnter = () => {
    if (!problem || input === '') return;
    const userAnswer = parseInt(input);
    const isCorrect = userAnswer === problem.answer;

    if (isCorrect) {
      const bonusScore = problem.rewardPoints * (feverMode ? 2 : 1);
      const bonusCoins = problem.rewardCoins * (feverMode ? 2 : 1);
      
      addScore(bonusScore);
      addCoins(bonusCoins);
      incrementCombo();
      setMessage(`Excellent! +${bonusCoins}코인 ✨`);
      
      confetti({
        particleCount: feverMode ? 100 : 30,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#4CAF50']
      });

      setTimeout(() => loadNewProblem(gameMode!, difficulty!), 500); 
    } else {
      resetCombo();
      setMessage('Try again! 😅');
      setInput('');
    }
  };

  // 1️⃣ 로비 화면
  if (!gameMode) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-blue-50 p-4 overflow-hidden relative">
        <div className="absolute top-4 right-4 flex gap-4 z-10">
          <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-lg font-bold text-gray-700 flex items-center gap-2">
            👤 {currentUser.name}
          </div>
          <div className="bg-yellow-400 px-4 py-2 rounded-full shadow-lg font-black text-white flex items-center gap-2">
            🪙 {currentUser.coins}
          </div>
          <button onClick={logout} className="bg-gray-200 px-3 rounded-full text-xs hover:bg-gray-300 transition font-bold">로그아웃</button>
        </div>

        <MotionCard delay={0.1}>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2 drop-shadow-sm">
            BRAIN ACADEMY
          </h1>
          <p className="text-center text-gray-500 mb-8 font-bold">말랑말랑 두뇌 체조 🧠</p>
        </MotionCard>
        
        <div className="w-full max-w-sm space-y-6 mb-8 max-h-[55vh] overflow-y-auto p-2 scrollbar-hide">
          {/* 덧셈 */}
          <div className="bg-white p-5 rounded-3xl shadow-md border-b-4 border-green-100">
            <h3 className="text-center font-bold text-green-600 mb-3 text-lg">➕ 덧셈 챌린지</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => startGame('ADD', 'LEVEL_1')} className="bg-green-100 hover:bg-green-200 text-green-700 py-3 rounded-xl font-bold text-sm transition">1단계<br/><span className="text-xs font-normal opacity-70">(한자리)</span></button>
              <button onClick={() => startGame('ADD', 'LEVEL_2')} className="bg-green-200 hover:bg-green-300 text-green-800 py-3 rounded-xl font-bold text-sm transition">2단계<br/><span className="text-xs font-normal opacity-70">(두자리+1)</span></button>
              <button onClick={() => startGame('ADD', 'LEVEL_3')} className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold text-sm transition shadow-lg">3단계<br/><span className="text-xs font-normal opacity-90">(두자리)</span></button>
            </div>
          </div>
          {/* 뺄셈 */}
          <div className="bg-white p-5 rounded-3xl shadow-md border-b-4 border-orange-100">
            <h3 className="text-center font-bold text-orange-600 mb-3 text-lg">➖ 뺄셈 챌린지</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => startGame('SUB', 'LEVEL_1')} className="bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 rounded-xl font-bold text-sm transition">1단계<br/><span className="text-xs font-normal opacity-70">(한자리)</span></button>
              <button onClick={() => startGame('SUB', 'LEVEL_2')} className="bg-orange-200 hover:bg-orange-300 text-orange-800 py-3 rounded-xl font-bold text-sm transition">2단계<br/><span className="text-xs font-normal opacity-70">(두자리-1)</span></button>
              <button onClick={() => startGame('SUB', 'LEVEL_3')} className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-sm transition shadow-lg">3단계<br/><span className="text-xs font-normal opacity-90">(두자리)</span></button>
            </div>
          </div>
          {/* 구구단 */}
          <div className="bg-white p-5 rounded-3xl shadow-md border-b-4 border-purple-100">
            <h3 className="text-center font-bold text-purple-600 mb-3 text-lg">✖️ 구구단 마스터</h3>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => startGame('MUL', 'LEVEL_1')} className="bg-purple-100 hover:bg-purple-200 text-purple-700 py-3 rounded-xl font-bold text-sm transition">1단계<br/><span className="text-xs font-normal opacity-70">(2~5단)</span></button>
              <button onClick={() => startGame('MUL', 'LEVEL_2')} className="bg-purple-200 hover:bg-purple-300 text-purple-800 py-3 rounded-xl font-bold text-sm transition">2단계<br/><span className="text-xs font-normal opacity-70">(6~9단)</span></button>
              <button onClick={() => startGame('MUL', 'LEVEL_3')} className="bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-bold text-sm transition shadow-lg">3단계<br/><span className="text-xs font-normal opacity-90">(전체)</span></button>
            </div>
          </div>
        </div>

        {/* 하단 메뉴 */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {/* 🏪 기존 단순 버튼에서 상점 띄우는 버튼으로 교체 */}
          <button onClick={() => setShowGachaShop(true)} className="bg-white text-gray-800 font-black py-4 rounded-2xl shadow-lg active:scale-95 border-2 border-yellow-300 flex flex-col items-center justify-center transition-all hover:bg-yellow-50">
            <span className="text-2xl mb-1">🏪</span>
            <span className="text-xs whitespace-nowrap">뽑기 상점</span>
          </button>
          
          <button onClick={() => setShowCollection(true)} className="bg-white text-gray-800 font-black py-4 rounded-2xl shadow-lg active:scale-95 border-2 border-blue-300 flex flex-col items-center justify-center transition-all hover:bg-blue-50">
            <span className="text-2xl mb-1">📖</span>
            <span className="text-xs whitespace-nowrap">내 도감</span>
          </button>

          <button onClick={() => setShowBattle(true)} className="bg-gradient-to-br from-red-500 to-orange-400 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 border-2 border-red-300 flex flex-col items-center justify-center transition-all hover:scale-105">
            <span className="text-2xl mb-1 drop-shadow-md">⚔️</span>
            <span className="text-xs whitespace-nowrap drop-shadow-sm">배틀 아레나</span>
          </button>
        </div>

        {/* 각종 모달 컴포넌트 렌더링 */}
        {showGachaShop && (
          <GachaShop onClose={() => setShowGachaShop(false)} onHatch={(monster) => setShowHatch(monster)} />
        )}
        {showCollection && (
          <CollectionBook monsters={allMonsters} inventory={currentUser.inventory} onClose={() => setShowCollection(false)} />
        )}
        {showHatch && (
          <EggHatch monster={showHatch} onClose={() => setShowHatch(null)} />
        )}
        {showBattle && (
          <BattleArena onClose={() => setShowBattle(false)} />
        )}
      </main>
    );
  }

  // 2️⃣ 게임 화면
  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ${feverMode ? 'bg-red-50' : 'bg-yellow-50'}`}>
      <div className="absolute top-4 right-4 font-black text-yellow-600 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-md">
        🪙 {currentUser.coins}
      </div>
      <BrainGauge />
      
      <AnimatePresence mode='wait'>
        <motion.div
          key={problem?.id}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="w-full max-w-md"
        >
           <VisualBoard problem={problem} input={input} />
        </motion.div>
      </AnimatePresence>

      <div className={`h-8 mt-4 text-xl font-bold transition-transform ${message.includes('Try') ? 'text-red-500 animate-shake' : 'text-blue-500'}`}>
        {message}
      </div>
      <NumberPad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />
      <button onClick={() => setGameMode(null)} className="mt-8 text-gray-500 hover:text-gray-800 font-bold text-sm bg-white/80 px-6 py-3 rounded-full transition-all shadow-sm">
        ← 그만하기
      </button>
    </main>
  );
}