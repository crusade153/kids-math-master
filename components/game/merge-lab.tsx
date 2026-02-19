// components/game/merge-lab.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster } from '@/types/game';
import { useGameStore } from '@/store/game-store';
import confetti from 'canvas-confetti';

interface MergeLabProps {
  monsters: Monster[];
  onClose: () => void;
}

interface InvGroup {
  invId: string;
  baseId: string;
  level: number;
  count: number;
  monster: Monster;
}

export default function MergeLab({ monsters, onClose }: MergeLabProps) {
  const { currentUser, mergeMonsters } = useGameStore();

  if (!currentUser) return null;

  // 인벤토리에 있는 카드들을 '강화 레벨'을 포함한 전체 ID 기준으로 집계합니다.
  const groups = currentUser.inventory.reduce((acc, invId) => {
    acc[invId] = (acc[invId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const displayGroups = Object.entries(groups).map(([invId, count]) => {
    const [baseId, lvlStr] = invId.split('_');
    const level = parseInt(lvlStr || '0', 10);
    const m = monsters.find(x => x.id === baseId);
    return { invId, baseId, level, count, monster: m };
  }).filter(g => g.monster) as InvGroup[];

  // 정렬: 합성이 가능한(3개 이상) 카드가 1순위, 레벨이 높은 카드가 2순위
  displayGroups.sort((a, b) => {
    if (a.count >= 3 && b.count < 3) return -1;
    if (a.count < 3 && b.count >= 3) return 1;
    return b.level - a.level;
  });

  const playMergeSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(400, now + 0.1);
      osc.frequency.setValueAtTime(500, now + 0.2);
      osc.frequency.setValueAtTime(600, now + 0.3);
      osc.frequency.setValueAtTime(800, now + 0.4);
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } catch(e) {}
  };

  const handleMerge = (invId: string) => {
    playMergeSound();
    mergeMonsters(invId);
    confetti({ 
      particleCount: 150, 
      spread: 80, 
      origin: { y: 0.5 }, 
      colors: ['#8b5cf6', '#d946ef', '#fcd34d'] 
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-gray-900 w-full max-w-6xl rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.3)] relative max-h-[90vh] flex flex-col border-4 border-indigo-500">
        
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 p-6 md:p-8 flex justify-between items-center shadow-lg z-10 border-b-2 border-indigo-400">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(167,139,250,0.8)]">
              🧪 돌연변이 합성소
            </h2>
            <p className="text-indigo-200 text-sm md:text-base mt-2 font-bold bg-black/30 inline-block px-4 py-1 rounded-full">
              같은 카드 3장을 모아 다음 단계로 진화시키세요! (스탯 20% 대폭 상승🚀)
            </p>
          </div>
          <button onClick={onClose} className="text-white text-5xl hover:text-red-400 transition-transform hover:scale-110">
            ✖
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            <AnimatePresence>
              {displayGroups.map((group) => {
                const m = group.monster;
                const isReady = group.count >= 3;
                const finalHp = Math.round(m.hp * (1 + 0.2 * group.level));
                const finalAtk = Math.round(m.attack * (1 + 0.2 * group.level));

                return (
                  <motion.div 
                    layout
                    key={group.invId}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className={`relative rounded-[2rem] p-5 flex flex-col items-center border-2 transition-all shadow-xl ${
                      isReady ? 'bg-indigo-950 border-indigo-400 shadow-[0_0_30px_rgba(167,139,250,0.6)]' : 'bg-gray-800 border-gray-700 opacity-80'
                    }`}
                  >
                    {/* 레벨 뱃지 */}
                    {group.level > 0 && (
                      <div className="absolute -top-3 -left-3 bg-gradient-to-br from-yellow-400 to-orange-500 text-yellow-900 font-black px-4 py-1.5 rounded-full shadow-lg z-20 text-lg border border-yellow-200">
                        +{group.level}
                      </div>
                    )}
                    
                    {/* 보유 개수 */}
                    <div className="absolute top-3 right-3 bg-blue-500 text-white font-black text-xs px-2.5 py-1 rounded-md z-20 shadow-md">
                      보유: {group.count}장
                    </div>

                    <div className="relative w-24 h-24 md:w-28 md:h-28 mb-3 z-10 mt-4 pointer-events-none">
                      <Image src={m.image} alt={m.name} fill className={`object-contain drop-shadow-2xl ${isReady ? 'animate-pulse' : ''}`} />
                    </div>
                    
                    <h4 className="font-black text-white text-center w-full truncate text-lg">{m.name}</h4>
                    
                    <div className="flex gap-2 mt-2 w-full justify-center">
                      <span className="bg-green-900/80 text-green-300 px-2 py-1 rounded shadow-inner text-xs font-black">HP {finalHp}</span>
                      <span className="bg-red-900/80 text-red-300 px-2 py-1 rounded shadow-inner text-xs font-black">ATK {finalAtk}</span>
                    </div>

                    {isReady ? (
                      <button 
                        onClick={() => handleMerge(group.invId)} 
                        className="mt-5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-black text-lg py-3 rounded-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(217,70,239,0.8)]"
                      >
                        ✨ 진화!
                      </button>
                    ) : (
                      <div className="mt-5 w-full bg-gray-700 text-gray-400 font-bold py-3 rounded-xl text-center text-sm border border-gray-600 shadow-inner">
                        {3 - (group.count % 3)}장 더 필요
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          
          {displayGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-gray-500">
              <div className="text-8xl mb-4 grayscale opacity-50">🥚</div>
              <p className="font-black text-2xl">인벤토리가 비어있습니다.</p>
              <p className="mt-2 text-lg">뽑기 상점에서 카드를 획득하고 진화시켜 보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}