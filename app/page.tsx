'use client';

import { useState, useEffect } from 'react';
import { MathProblem, MathOperation } from '@/types/math';
import NumberPad from '@/components/ui/number-pad';
import VisualBoard from '@/components/ui/visual-board';
import MotionCard from '@/components/ui/motion-card';
import BrainGauge from '@/components/ui/brain-gauge';
import EggHatch from '@/components/game/egg-hatch';
import { useGameStore } from '@/store/game-store';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { getSmartProblem, saveResult } from '@/lib/smart-engine';
import { pullMonster, Monster, MONSTER_LIST } from '@/lib/monsters';

export default function Home() {
  // UI 상태
  const [gameMode, setGameMode] = useState<MathOperation | null>(null);
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  
  // 가챠/도감 UI 상태
  const [showHatch, setShowHatch] = useState<Monster | null>(null);
  const [showCollection, setShowCollection] = useState(false);

  // 전역 상태
  const { 
    addScore, incrementCombo, resetCombo, resetGame, feverMode, combo,
    coins, addCoins, spendCoins, unlockMonster, inventory 
  } = useGameStore();

  useEffect(() => {
    if (gameMode) {
      loadNewProblem();
      resetGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode]);

  const loadNewProblem = () => {
    if (!gameMode) return;
    const newProblem = getSmartProblem(gameMode);
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

    saveResult(problem, isCorrect);

    if (isCorrect) {
      const bonus = feverMode ? 20 : 10;
      addScore(bonus);
      addCoins(feverMode ? 2 : 1);
      incrementCombo();
      setMessage('Excellent! ✨');
      
      const particleCount = feverMode ? 150 : 50;
      confetti({
        particleCount: particleCount,
        spread: feverMode ? 100 : 50,
        origin: { y: 0.6 },
        colors: feverMode ? ['#FF0000', '#FFFF00'] : ['#4CAF50', '#2196F3']
      });

      setTimeout(() => loadNewProblem(), 500); 
    } else {
      resetCombo();
      setMessage('Try again! 😅');
      setInput('');
    }
  };

  // 알 까기 시도
  const handleGacha = () => {
    if (spendCoins(10)) {
      const newMonster = pullMonster();
      unlockMonster(newMonster.id);
      setShowHatch(newMonster);
    } else {
      alert("코인이 부족해요! 문제를 더 풀어보세요 💰");
    }
  };

  // 1️⃣ 메인 메뉴 (로비)
  if (!gameMode) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-blue-50 p-4 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 to-transparent pointer-events-none" />
        
        {/* 상단 코인 표시 */}
        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-lg font-bold text-yellow-600 flex items-center gap-2 z-10">
          <span>🪙 {coins}</span>
        </div>

        <MotionCard delay={0.1}>
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2 drop-shadow-sm">
            BRAIN ACADEMY
          </h1>
          <p className="text-center text-gray-500 mb-8 font-bold">말랑말랑 두뇌 체조 🧠</p>
        </MotionCard>
        
        {/* 메뉴 버튼들 */}
        <div className="grid gap-4 w-full max-w-sm mb-8">
          {[
            { mode: 'ADD', label: '덧셈 챌린지', color: 'bg-green-400', icon: '➕' },
            { mode: 'SUB', label: '뺄셈 챌린지', color: 'bg-orange-400', icon: '➖' },
            { mode: 'MUL', label: '구구단 마스터', color: 'bg-purple-400', icon: '✖️' }
          ].map((item, index) => (
            <MotionCard key={item.mode} delay={0.2 + (index * 0.1)}>
              <button 
                onClick={() => setGameMode(item.mode as MathOperation)} 
                className={`${item.color} w-full text-white text-2xl font-bold py-5 rounded-3xl shadow-[0_8px_0_rgb(0,0,0,0.1)] active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-4`}
              >
                <span className="bg-white/20 p-2 rounded-full">{item.icon}</span>
                {item.label}
              </button>
            </MotionCard>
          ))}
        </div>

        {/* 하단: 상점 및 도감 버튼 */}
        <div className="flex gap-4 w-full max-w-sm">
          <button 
            onClick={handleGacha}
            className="flex-1 bg-white text-gray-700 font-bold py-4 rounded-2xl shadow-lg active:scale-95 border-2 border-yellow-200"
          >
            🥚 뽑기 (10코인)
          </button>
          <button 
            onClick={() => setShowCollection(!showCollection)}
            className="flex-1 bg-white text-gray-700 font-bold py-4 rounded-2xl shadow-lg active:scale-95 border-2 border-blue-200"
          >
            📖 내 도감
          </button>
        </div>

        {/* 도감 보기 (간단 모달) */}
        {showCollection && (
          <div className="absolute inset-0 bg-white/95 z-20 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">내 몬스터 도감 ({inventory.length}/{MONSTER_LIST.length})</h2>
              <button onClick={() => setShowCollection(false)} className="text-2xl">❌</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {MONSTER_LIST.map((m) => {
                const isOwned = inventory.includes(m.id);
                return (
                  <div key={m.id} className={`p-4 rounded-xl text-center border-2 ${isOwned ? 'border-blue-100 bg-blue-50' : 'border-gray-100 bg-gray-50 opacity-50'}`}>
                    <div className="text-4xl mb-2">{isOwned ? m.emoji : '❓'}</div>
                    <div className="text-xs font-bold text-gray-500">{m.name}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 알 까기 연출 모달 */}
        {showHatch && (
          <EggHatch monster={showHatch} onClose={() => setShowHatch(null)} />
        )}
      </main>
    );
  }

  // 2️⃣ 게임 화면 (In-Game)
  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ${feverMode ? 'bg-red-50' : 'bg-yellow-50'}`}>
      
      {/* 상단바: 코인 표시 */}
      <div className="absolute top-4 right-4 font-bold text-yellow-600 bg-white/50 px-3 py-1 rounded-full">
        🪙 {coins}
      </div>

      <BrainGauge />

      <AnimatePresence mode='wait'>
        <motion.div
          key={problem?.id}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-md"
        >
           <VisualBoard problem={problem} input={input} />
        </motion.div>
      </AnimatePresence>

      <div className={`h-8 mt-4 text-xl font-bold transition-transform ${message.includes('Try') ? 'text-red-500 animate-shake' : 'text-blue-500'}`}>
        {message}
      </div>

      <NumberPad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />

      <button 
        onClick={() => setGameMode(null)}
        className="mt-8 text-gray-400 hover:text-gray-600 font-bold text-sm bg-white/50 px-4 py-2 rounded-full transition-colors"
      >
        ← 그만하기
      </button>
    </main>
  );
}