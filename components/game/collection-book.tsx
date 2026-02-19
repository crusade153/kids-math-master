// components/game/collection-book.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster } from '@/types/game';

interface CollectionBookProps {
  monsters: Monster[];
  inventory: string[];
  onClose: () => void;
}

export default function CollectionBook({ monsters, inventory, onClose }: CollectionBookProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ⭐️ 강화 수치(_1, _2)를 뗀 순수 ID만 추출하여 도감 소유 여부를 체크합니다.
  const ownedBaseIds = new Set(inventory.map(id => id.split('_')[0]));
  const collectionRate = Math.round((ownedBaseIds.size / monsters.length) * 100);

  return (
    <div className="fixed inset-0 bg-black/95 z-[80] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl flex justify-between items-center mb-6 px-2">
        <div>
          <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">
            MONSTER BOOK
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-green-400 transition-all duration-1000"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 font-bold">
              {collectionRate}% ({ownedBaseIds.size}/{monsters.length})
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-4xl text-white hover:text-red-400 transition-colors transform hover:scale-110 active:scale-95">
          ❌
        </button>
      </div>

      <div className="w-full max-w-6xl h-[85vh] overflow-y-auto p-4 md:p-8 rounded-3xl bg-gray-900/50 border border-gray-800 backdrop-blur-sm custom-scrollbar">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-20">
          {monsters.map((monster) => {
            const isOwned = ownedBaseIds.has(monster.id);
            // ⭐️ 내가 이 카드를 종류별로 총 몇 장 가지고 있는지 계산합니다.
            const count = inventory.filter(id => id.split('_')[0] === monster.id).length;

            return (
              <motion.div
                key={monster.id}
                layoutId={`card-${monster.id}`}
                onClick={() => isOwned && setSelectedId(monster.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={isOwned ? { y: -5, scale: 1.02 } : {}}
                className={`relative aspect-[2/3] rounded-xl p-3 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg group ${
                  isOwned ? 'bg-white border-4 border-white ring-4 ring-blue-400/30' : 'bg-gray-800 border-4 border-gray-700'
                }`}
              >
                {isOwned && <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 to-transparent pointer-events-none" />}
                
                <div className="flex justify-between items-center z-10">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isOwned ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-gray-500'}`}>
                    No.{monster.id.replace(/[a-z]/g, '')}
                  </span>
                  <span className="text-lg filter drop-shadow-md">{isOwned ? monster.type.split('/')[0] : '🔒'}</span>
                </div>

                <div className="relative w-full flex-1 my-2 flex items-center justify-center pointer-events-none">
                  {monster.image ? (
                    <div className="relative w-full h-full">
                      <Image src={monster.image} alt={monster.name} fill sizes="(max-width: 768px) 150px, 200px" className={`object-contain transition-all duration-500 ${isOwned ? 'filter-none group-hover:scale-110' : 'brightness-0 invert opacity-20'}`} />
                    </div>
                  ) : (
                    <div className="text-4xl text-gray-600 opacity-50">?</div>
                  )}
                </div>

                <div className="z-10 text-center flex flex-col items-center">
                  <div className={`text-[10px] font-bold mb-1 ${isOwned ? 'text-blue-500' : 'text-gray-600'}`}>{monster.generation}</div>
                  <h3 className={`font-black text-sm md:text-base w-full truncate px-1 py-1 rounded-lg ${isOwned ? 'text-gray-800 bg-gray-100' : 'text-gray-500 bg-gray-900'}`}>
                    {isOwned ? monster.name : '???'}
                  </h3>
                  {/* 보유 개수 배지 */}
                  {isOwned && count > 0 && (
                    <div className="mt-1 bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm w-full">
                      총 보유: {count}장
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 모달 상세보기 (이전과 동일) */}
      <AnimatePresence>
        {selectedId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)} className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[90] p-4">
            {(() => {
              const m = monsters.find(mon => mon.id === selectedId)!;
              return (
                <motion.div layoutId={`card-${selectedId}`} className="bg-white w-full max-w-sm md:max-w-md rounded-[2rem] overflow-hidden shadow-2xl relative border-4 border-white" onClick={(e) => e.stopPropagation()}>
                  <div className="h-48 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 relative flex justify-center items-center overflow-hidden">
                    <button onClick={() => setSelectedId(null)} className="absolute top-4 right-4 bg-black/20 text-white rounded-full p-2 hover:bg-black/40 z-20 backdrop-blur-sm transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <motion.div initial={{ scale: 0.5, y: 50, opacity: 0 }} animate={{ scale: 1, y: 20, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="relative w-56 h-56 mt-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] z-10 pointer-events-none">
                       <Image src={m.image} alt={m.name} fill className="object-contain" priority />
                    </motion.div>
                  </div>
                  <div className="pt-20 pb-8 px-8 text-center bg-white relative">
                    <h2 className="text-3xl font-black text-gray-800 mb-2">{m.name}</h2>
                    <div className="flex justify-center gap-2 mb-6 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        m.rarity === 'MYTHICAL' ? 'bg-pink-100 text-pink-700 border-pink-200' :
                        m.rarity === 'LEGENDARY' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        m.rarity === 'RARE' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-green-100 text-green-700 border-green-200'
                      }`}>{m.rarity}</span>
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600 border border-gray-200">
                        {m.type}
                      </span>
                    </div>
                    <div className="text-left space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <p className="text-gray-700 font-medium leading-relaxed text-sm break-keep">{m.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-50 p-3 rounded-2xl border border-red-100 text-center">
                          <h4 className="text-[10px] font-extrabold text-red-400 uppercase mb-1">기본 HP</h4>
                          <p className="text-red-900 font-black text-lg">{m.hp}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-center">
                          <h4 className="text-[10px] font-extrabold text-blue-400 uppercase mb-1">기본 공격력</h4>
                          <p className="text-blue-900 font-black text-lg">{m.attack}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}