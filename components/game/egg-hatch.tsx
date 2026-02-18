// components/game/egg-hatch.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monster } from '@/types/game';
import confetti from 'canvas-confetti';

interface EggHatchProps {
  monster: Monster;
  onClose: () => void;
}

export default function EggHatch({ monster, onClose }: EggHatchProps) {
  const [stage, setStage] = useState<'EGG' | 'CRACK' | 'REVEAL'>('EGG');

  const handleCrack = () => {
    setStage('CRACK');
    setTimeout(() => {
      setStage('REVEAL');
      // 전설 등급이면 대박 폭죽 터뜨리기
      if (monster.rarity === 'LEGENDARY') {
        confetti({ particleCount: 200, spread: 100, colors: ['#FFD700', '#FFFFFF'] });
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
        
        {/* ✅ 수정 1: 배경 광원 효과에 'pointer-events-none' 추가 (클릭 방해 금지) */}
        {monster.rarity !== 'COMMON' && stage === 'REVEAL' && (
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,yellow_180deg,transparent_360deg)] opacity-30 scale-150 pointer-events-none"
          />
        )}

        <AnimatePresence mode='wait'>
          {/* 1단계: 알 (클릭해서 깨기) */}
          {stage !== 'REVEAL' && (
            <motion.div
              key="egg"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              onClick={handleCrack}
              className="cursor-pointer relative z-10" // ✅ 내용물을 위로 올림
            >
              <motion.div
                animate={stage === 'CRACK' ? { x: [-5, 5, -5, 5, 0], rotate: [0, -10, 10, -10, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="text-9xl mb-4 select-none filter drop-shadow-xl"
              >
                🥚
              </motion.div>
              <p className="text-gray-500 font-bold animate-pulse">알을 탭해서 깨보세요!</p>
            </motion.div>
          )}

          {/* 2단계: 몬스터 등장 */}
          {stage === 'REVEAL' && (
            <motion.div
              key="monster"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="relative z-10" // ✅ 수정 2: 버튼이 배경보다 위에 오도록 z-index 추가
            >
              <div className="text-2xl font-bold mb-2 text-gray-400">{monster.rarity === 'LEGENDARY' ? '👑 전설 발견!!' : monster.rarity === 'RARE' ? '✨ 희귀 발견!' : '🌱 새로운 친구!'}</div>
              <div className="text-9xl mb-4 filter drop-shadow-2xl">{monster.emoji}</div>
              <h2 className="text-3xl font-black text-gray-800 mb-2">{monster.name}</h2>
              <p className="text-gray-500 mb-8">{monster.description}</p>
              
              <button 
                onClick={onClose}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg active:scale-95 transition-transform"
              >
                확인
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}