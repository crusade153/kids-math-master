// components/game/gacha-shop.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster } from '@/types/game';
import { pullRandomMonster, pullPremiumMonster, pullLegendaryMonster, getSelectableLegendaries } from '@/actions/game-actions';
import { useGameStore } from '@/store/game-store';

interface GachaShopProps {
  onClose: () => void;
  onHatch: (monster: Monster) => void; // 뽑은 몬스터를 알까기 화면으로 넘김
}

export default function GachaShop({ onClose, onHatch }: GachaShopProps) {
  const { spendCoins, unlockMonster, currentUser } = useGameStore();
  const [legendaries, setLegendaries] = useState<Monster[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSelectableLegendaries().then(setLegendaries);
  }, []);

  const handleRandomGacha = async (cost: number, type: 'NORMAL' | 'PREMIUM' | 'LEGENDARY') => {
    if (!currentUser || currentUser.coins < cost) {
      alert("코인이 부족해요! 문제를 더 풀어서 코인을 모아보세요 📚💰");
      return;
    }
    
    setLoading(true);
    let newMonster: Monster | null = null;
    
    if (type === 'NORMAL') newMonster = await pullRandomMonster();
    else if (type === 'PREMIUM') newMonster = await pullPremiumMonster();
    else if (type === 'LEGENDARY') newMonster = await pullLegendaryMonster();
    
    setLoading(false);

    if (spendCoins(cost) && newMonster) {
      unlockMonster(newMonster.id); // 인벤토리에 추가
      onClose(); // 상점 닫기
      onHatch(newMonster); // 알까기 연출 시작
    }
  };

  const handleSelectLegendary = (monster: Monster) => {
    if (!currentUser || currentUser.coins < 200) {
      alert("코인이 부족해요! 전설을 직접 고르려면 200코인이 필요합니다 👑");
      return;
    }
    
    if (spendCoins(200)) {
      unlockMonster(monster.id);
      onClose();
      onHatch(monster);
    }
  };

  // 1. 뽑기 연산 중 로딩 화면
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center backdrop-blur-sm">
        <div className="text-white text-3xl font-black animate-bounce drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          상점 주인과 거래 중... 🥚✨
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gray-100 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col border-4 border-gray-700">
        
        {/* 상점 헤더 */}
        <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-6 flex justify-between items-center shadow-md z-10">
          <h2 className="text-3xl font-black text-white drop-shadow-md">
            {showSelector ? '✨ 전설 선택권 (200 코인)' : '🏪 포켓몬 뽑기 상점'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="bg-black/30 px-5 py-2 rounded-full font-black text-yellow-300 shadow-inner">
              내 코인: 🪙 {currentUser?.coins || 0}
            </div>
            <button onClick={onClose} className="text-white text-3xl hover:text-red-200 transition-transform hover:scale-110 active:scale-95">
              ✖
            </button>
          </div>
        </div>

        {/* 상점 컨텐츠 */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
          <AnimatePresence mode="wait">
            {!showSelector ? (
              <motion.div key="shop" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 10코인 일반 뽑기 */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-gray-200 flex flex-col items-center text-center transition-transform hover:-translate-y-2">
                  <div className="text-7xl mb-4 drop-shadow-md">🥚</div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">일반 뽑기</h3>
                  <p className="text-sm text-gray-500 mb-6 flex-1">일반 등급부터 전설 등급까지!<br/>당신의 운을 가볍게 시험해보세요.</p>
                  <button onClick={() => handleRandomGacha(10, 'NORMAL')} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-[0_5px_0_rgba(29,78,216,1)] hover:shadow-[0_2px_0_rgba(29,78,216,1)] hover:translate-y-1">
                    10 코인으로 뽑기
                  </button>
                </div>

                {/* 50코인 고급 뽑기 */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-blue-300 flex flex-col items-center text-center transition-transform hover:-translate-y-2">
                  <div className="text-7xl mb-4 drop-shadow-lg filter hue-rotate-180">🥚</div>
                  <h3 className="text-2xl font-black text-blue-600 mb-2">고급 뽑기</h3>
                  <p className="text-sm text-gray-600 mb-6 flex-1"><span className="text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded">RARE 이상 확정!</span><br/>더욱 강력한 포켓몬을 원한다면 추천합니다.</p>
                  <button onClick={() => handleRandomGacha(50, 'PREMIUM')} className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-[0_5px_0_rgba(88,28,135,1)] hover:shadow-[0_2px_0_rgba(88,28,135,1)] hover:translate-y-1">
                    50 코인으로 뽑기
                  </button>
                </div>

                {/* 100코인 전설 뽑기 */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-yellow-400 flex flex-col items-center text-center transition-transform hover:-translate-y-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-yellow-50/50 pointer-events-none" />
                  <div className="text-7xl mb-4 drop-shadow-xl filter sepia brightness-110 relative z-10">👑</div>
                  <h3 className="text-2xl font-black text-yellow-600 mb-2 relative z-10">전설의 알</h3>
                  <p className="text-sm text-gray-700 mb-6 flex-1 relative z-10"><span className="text-yellow-600 font-bold bg-yellow-100 px-2 py-0.5 rounded">LEGENDARY & MYTHICAL 확정!</span><br/>무조건 최강의 포켓몬이 등장합니다.</p>
                  <button onClick={() => handleRandomGacha(100, 'LEGENDARY')} className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-[0_5px_0_rgba(161,98,7,1)] hover:shadow-[0_2px_0_rgba(161,98,7,1)] hover:translate-y-1 relative z-10">
                    100 코인으로 뽑기
                  </button>
                </div>

                {/* 200코인 확정 선택권 */}
                <div className="bg-gray-900 p-6 rounded-3xl shadow-2xl border-4 border-red-500 flex flex-col items-center text-center relative overflow-hidden transition-transform hover:-translate-y-2">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-600/30 to-transparent pointer-events-none" />
                  <div className="text-7xl mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,1)] z-10 relative">🎟️</div>
                  <h3 className="text-2xl font-black text-red-400 mb-2 z-10 relative">전설 선택권</h3>
                  <p className="text-sm text-gray-300 mb-6 flex-1 z-10 relative"><span className="text-red-400 font-bold">운을 믿지 않으신다면 직접 선택하세요!</span><br/>엄청난 노력이 빛을 발하는 순간입니다.</p>
                  <button onClick={() => setShowSelector(true)} className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-black py-4 rounded-2xl active:scale-95 transition-all shadow-[0_5px_0_rgba(153,27,27,1)] hover:shadow-[0_2px_0_rgba(153,27,27,1)] hover:translate-y-1 z-10 relative">
                    200 코인 (선택하러 가기)
                  </button>
                </div>
              </motion.div>
            ) : (
              // 전설 선택권 진입 시 나타나는 포켓몬 리스트
              <motion.div key="selector" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="flex flex-col h-full">
                <button onClick={() => setShowSelector(false)} className="mb-6 text-gray-500 font-bold hover:text-gray-800 self-start bg-white px-4 py-2 rounded-full shadow transition-all">
                  ← 상점 메뉴로 돌아가기
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
                  {legendaries.map(monster => (
                    <motion.button
                      key={monster.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelectLegendary(monster)}
                      className="bg-white rounded-2xl p-4 shadow-lg border-2 border-yellow-300 flex flex-col items-center hover:shadow-[0_0_20px_rgba(250,204,21,0.5)] transition-all group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-yellow-50 pointer-events-none" />
                      <div className="relative w-20 h-20 mb-3 z-10">
                        {monster.image ? (
                          <Image src={monster.image} alt={monster.name} fill className="object-contain group-hover:scale-125 transition-transform duration-300 drop-shadow-xl" />
                        ) : (
                          <div className="text-3xl text-center mt-4">❔</div>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-gray-500 mb-1 z-10 bg-gray-100 px-2 py-0.5 rounded">{monster.type.split('/')[0]}</span>
                      <h4 className="font-black text-sm text-gray-800 truncate w-full text-center z-10">{monster.name}</h4>
                      <div className="w-full mt-2 bg-yellow-100 text-yellow-700 text-xs font-black py-1.5 rounded-lg text-center z-10 shadow-inner">
                        전투력 {monster.hp + monster.attack}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}