// components/game/collection-book.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monster } from '@/types/game';

interface CollectionBookProps {
  monsters: Monster[];
  inventory: string[]; // 내가 가진 몬스터 ID 목록
  onClose: () => void;
}

export default function CollectionBook({ monsters, inventory, onClose }: CollectionBookProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      {/* 헤더 */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 text-white">
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            MONSTER BOOK
          </h2>
          <p className="text-sm text-gray-400">
            수집률: {Math.round((inventory.length / monsters.length) * 100)}% 
            ({inventory.length} / {monsters.length})
          </p>
        </div>
        <button onClick={onClose} className="text-4xl hover:scale-110 transition">❌</button>
      </div>

      {/* 그리드 리스트 */}
      <div className="w-full max-w-5xl h-[80vh] overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 scrollbar-hide">
        {monsters.map((monster) => {
          const isOwned = inventory.includes(monster.id);
          const isSelected = selectedId === monster.id;

          return (
            <motion.div
              key={monster.id}
              layoutId={monster.id}
              onClick={() => isOwned && setSelectedId(monster.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative aspect-[3/4] rounded-2xl p-4 cursor-pointer transition-all duration-300
                ${isOwned 
                  ? 'bg-white shadow-xl hover:shadow-2xl hover:-translate-y-2 border-4 border-blue-100' 
                  : 'bg-gray-800 border-4 border-gray-700 opacity-60 grayscale'
                }`}
            >
              {/* 카드 내용 */}
              <div className="h-full flex flex-col items-center justify-between">
                <div className="w-full flex justify-between items-start">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    monster.rarity === 'LEGENDARY' ? 'bg-purple-100 text-purple-600' :
                    monster.rarity === 'RARE' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {monster.generation}
                  </span>
                  <span className="text-2xl">{isOwned ? monster.type : '🔒'}</span>
                </div>

                <div className="text-6xl my-2 filter drop-shadow-md">
                  {isOwned ? monster.type : '?'} 
                  {/* 실제로는 여기에 이미지 URL을 넣으면 더 좋습니다 */}
                </div>

                <div className="text-center w-full">
                  <div className="text-xs text-gray-400 font-mono mb-1">No.{monster.id}</div>
                  <h3 className="font-black text-gray-800 text-lg truncate">
                    {isOwned ? monster.name : '???'}
                  </h3>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 상세 보기 모달 (카드 클릭 시 등장) */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedId(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            {(() => {
              const m = monsters.find(mon => mon.id === selectedId)!;
              return (
                <motion.div
                  layoutId={selectedId}
                  className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 상단 배경 (타입별 색상) */}
                  <div className="h-32 bg-gradient-to-br from-blue-400 to-purple-500 relative">
                    <button 
                      onClick={() => setSelectedId(null)}
                      className="absolute top-4 right-4 bg-black/20 text-white rounded-full p-2 hover:bg-black/40"
                    >
                      ✖
                    </button>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-8xl drop-shadow-2xl">
                      {m.type}
                    </div>
                  </div>

                  <div className="pt-14 pb-8 px-8 text-center">
                    <h2 className="text-3xl font-black text-gray-800 mb-2">{m.name}</h2>
                    <div className="flex justify-center gap-2 mb-6">
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-500">{m.generation}</span>
                      <span className="bg-yellow-100 px-3 py-1 rounded-full text-xs font-bold text-yellow-700">{m.rarity}</span>
                    </div>

                    <div className="space-y-4 text-left bg-gray-50 p-4 rounded-xl">
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase">Description</h4>
                        <p className="text-gray-700 font-medium">{m.description}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase">Skills</h4>
                        <p className="text-gray-700 font-medium">{m.skills}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase">History</h4>
                        <p className="text-sm text-gray-500">{m.history}</p>
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