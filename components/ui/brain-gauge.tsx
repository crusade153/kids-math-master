// components/ui/brain-gauge.tsx
'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';

export default function BrainGauge() {
  const { score, combo, feverMode } = useGameStore();
  
  // 목표 점수 (예: 1000g 달성 시 두뇌왕)
  const maxScore = 500; 
  const progress = Math.min((score / maxScore) * 100, 100);

  return (
    <div className="w-full max-w-md mb-6">
      <div className="flex justify-between items-end mb-2 px-2">
        <span className="font-bold text-gray-500">Brain Weight</span>
        <div className="flex items-baseline gap-1">
          <motion.span 
            key={score} // 숫자가 바뀔 때마다 애니메이션
            initial={{ scale: 1.5, color: '#FFD700' }}
            animate={{ scale: 1, color: '#374151' }}
            className="text-3xl font-black text-gray-700"
          >
            {score}
          </motion.span>
          <span className="text-sm font-bold text-gray-400">g</span>
        </div>
      </div>

      {/* 게이지 바 배경 */}
      <div className="h-6 bg-gray-200 rounded-full overflow-hidden border-4 border-white shadow-inner relative">
        {/* 차오르는 게이지 */}
        <motion.div 
          className={`h-full ${feverMode ? 'bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500' : 'bg-blue-400'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        />
        
        {/* 빗금 무늬 효과 (CSS 패턴) */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
      </div>

      {/* 콤보 메시지 */}
      <div className="h-8 text-center mt-1">
        {combo > 1 && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            className={`font-black text-lg ${feverMode ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}
          >
            {combo} COMBO! 🔥
          </motion.div>
        )}
      </div>
    </div>
  );
}