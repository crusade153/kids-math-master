// components/home/math-game-view.tsx
'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/game-store';
import { MathProblem, MathOperation, Difficulty } from '@/types/math';
import { generateProblem } from '@/lib/generator';
import BrainGauge from '@/components/ui/brain-gauge';
import VisualBoard from '@/components/ui/visual-board';
import NumberPad from '@/components/ui/number-pad';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface MathGameViewProps {
  mode: MathOperation;
  difficulty: Difficulty;
  onExit: () => void;
}

export default function MathGameView({ mode, difficulty, onExit }: MathGameViewProps) {
  const { currentUser, addScore, incrementCombo, resetCombo, resetGame, feverMode, combo, addCoins, incrementSolvedCount } = useGameStore();
  
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');

  // 컴포넌트 마운트 시 최초 문제 로드 및 게임 리셋
  useEffect(() => {
    resetGame();
    loadNewProblem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNewProblem = () => {
    setProblem(generateProblem(mode, difficulty)); 
    setInput(''); 
    setMessage(combo > 0 ? '계속 가보자! 🚀' : '준비 완료!');
  };

  const handleInput = (num: string) => { 
    if (input.length < 3) setInput(prev => prev + num); 
  };
  
  const handleDelete = () => { 
    setInput(prev => prev.slice(0, -1)); 
  };
  
  const handleEnter = () => {
    if (!problem || input === '') return;
    
    if (parseInt(input) === problem.answer) {
      addScore(problem.rewardPoints * (feverMode ? 2 : 1));
      addCoins(problem.rewardCoins * (feverMode ? 2 : 1));
      incrementCombo();
      incrementSolvedCount();
      
      setMessage(`정답이야! +${problem.rewardCoins * (feverMode ? 2 : 1)}코인 ✨`);
      confetti({ particleCount: feverMode ? 100 : 30, spread: 60, origin: { y: 0.6 }, colors: ['#FFD700', '#FFA500', '#4CAF50'] });
      
      setTimeout(() => loadNewProblem(), 600); 
    } else {
      resetCombo(); 
      setMessage('다시 한 번 생각해볼까? 🤔'); 
      setInput('');
    }
  };

  if (!currentUser) return null;

  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ${feverMode ? 'bg-red-50' : 'bg-[#FFFDF5]'}`}>
      <div className="absolute top-4 right-4 font-black text-yellow-700 bg-white px-4 py-2 rounded-full shadow-md border border-yellow-200">
        🪙 {currentUser.coins}
      </div>
      
      <BrainGauge />
      
      <AnimatePresence mode='wait'>
        <motion.div 
          key={problem?.id} 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 1.05 }} 
          className="w-full max-w-md"
        >
           <VisualBoard problem={problem} input={input} />
        </motion.div>
      </AnimatePresence>
      
      <div className={`h-8 mt-2 text-xl font-black transition-transform ${message.includes('다시') ? 'text-red-500 animate-shake' : 'text-blue-500'}`}>
        {message}
      </div>
      
      <NumberPad onInput={handleInput} onDelete={handleDelete} onEnter={handleEnter} />
      
      <button 
        onClick={onExit} 
        className="mt-8 text-gray-500 hover:text-gray-800 font-bold text-sm bg-gray-200/50 px-6 py-3 rounded-full transition-all active:scale-95"
      >
        ← 마을로 돌아가기
      </button>
    </main>
  );
}