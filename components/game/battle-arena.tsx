// components/game/battle-arena.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Monster, UserProfile } from '@/types/game';
import { generateDeck } from '@/actions/battle-actions';
import { getUsers } from '@/actions/user-actions';
import { useGameStore } from '@/store/game-store';
import confetti from 'canvas-confetti';

interface BattleArenaProps {
  onClose: () => void;
}

// 개별 카드 UI 컴포넌트
const BattleCard = ({ monster, isOpponent, turnState, isDefeated }: { monster: Monster, isOpponent?: boolean, turnState: string, isDefeated: boolean }) => {
  // ⭐️ 상태에 따른 다이내믹 애니메이션 속성
  let animateProps: any = { y: 0, opacity: 1, rotateY: 0, scale: 1, x: 0, filter: 'brightness(1) grayscale(0%)' };
  
  // 격돌(Clashing) 상태일 때 위아래로 튀어오르는 모션
  if (turnState === 'CLASHING') {
    animateProps = {
      y: isOpponent ? [0, 60, 0] : [0, -60, 0],
      scale: [1, 1.1, 1],
      transition: { duration: 0.3 }
    };
  }

  // 패배했을 때 카드가 흑백으로 변하고 뒤로 밀려나는 모션
  if (isDefeated && turnState === 'DONE') {
    animateProps = {
      opacity: 0.6,
      scale: 0.85,
      filter: 'brightness(0.6) grayscale(100%)',
      rotateZ: isOpponent ? 5 : -5,
      y: isOpponent ? -20 : 20,
      transition: { type: "spring", stiffness: 200 }
    };
  }

  return (
    <motion.div
      initial={{ y: isOpponent ? -50 : 50, opacity: 0, rotateY: 180 }}
      animate={animateProps}
      exit={{ opacity: 0, scale: 0.5 }}
      className={`bg-white rounded-3xl p-4 shadow-2xl w-40 md:w-48 flex flex-col items-center border-4 relative ${
        isOpponent ? 'border-red-400' : 'border-blue-400'
      }`}
    >
      <div className={`absolute -top-3 px-3 py-1 rounded-full text-xs font-black text-white ${isOpponent ? 'bg-red-500' : 'bg-blue-500'}`}>
        {isOpponent ? '상대 카드' : '내 카드'}
      </div>
      <div className="relative w-24 h-24 md:w-32 md:h-32 mb-2 mt-2">
        {monster.image ? (
          <Image src={monster.image} alt={monster.name} fill className="object-contain drop-shadow-lg" />
        ) : (
          <div className="text-4xl text-center mt-8">❔</div>
        )}
      </div>
      <h3 className="font-black text-gray-800 text-sm md:text-base truncate w-full text-center">{monster.name}</h3>
      
      <div className="flex gap-2 mt-2 text-[10px] md:text-xs font-bold w-full justify-center">
        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md shadow-sm">HP {monster.hp}</span>
        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md shadow-sm">ATK {monster.attack}</span>
      </div>
      <div className="mt-2 text-xs md:text-sm font-black bg-yellow-100 text-yellow-700 px-3 py-2 rounded-xl w-full text-center shadow-inner">
        전투력: {monster.hp + monster.attack}
      </div>
    </motion.div>
  );
};

export default function BattleArena({ onClose }: BattleArenaProps) {
  const { currentUser } = useGameStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [opponent, setOpponent] = useState<UserProfile | null>(null);
  
  const [playerDeck, setPlayerDeck] = useState<Monster[]>([]);
  const [opponentDeck, setOpponentDeck] = useState<Monster[]>([]);
  
  // 게임 흐름 상태: SELECT(상대선택) -> LOADING -> READY -> BATTLING -> RESULT
  const [stage, setStage] = useState<'SELECT' | 'LOADING' | 'READY' | 'BATTLING' | 'RESULT'>('SELECT');
  
  // 전투 내부 턴 상태: IDLE(버튼 대기) -> CLASHING(격돌 중) -> DONE(결과 표시)
  const [turnState, setTurnState] = useState<'IDLE' | 'CLASHING' | 'DONE'>('IDLE');
  
  const [currentTurn, setCurrentTurn] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [turnResult, setTurnResult] = useState<'WIN' | 'LOSE' | 'DRAW' | null>(null);

  // 1. 유저 목록 불러오기 (본인 제외)
  useEffect(() => {
    getUsers().then(data => {
      setUsers(data.filter(u => u.id !== currentUser?.id));
    });
  }, [currentUser]);

  // 2. 상대방 선택 시 서로의 덱 생성
  const handleSelectOpponent = async (selectedUser: UserProfile) => {
    setOpponent(selectedUser);
    setStage('LOADING');
    
    if (currentUser) {
      // 내 카드 생성 (isOpponent = false)
      const pDeck = await generateDeck(currentUser.inventory, false);
      // 상대방 카드 생성 (isOpponent = true)
      const oDeck = await generateDeck(selectedUser.inventory, true);
      
      setPlayerDeck(pDeck);
      setOpponentDeck(oDeck);
      setStage('READY');
    }
  };

  const startBattle = () => {
    setStage('BATTLING');
    setCurrentTurn(0);
    setPlayerScore(0);
    setOpponentScore(0);
    setTurnState('IDLE'); // 첫 턴 대기 상태
  };

  // 3. 사용자가 "대결!" 버튼을 눌렀을 때
  const handleClash = () => {
    setTurnState('CLASHING');
    
    // 격돌 애니메이션 재생 후 (0.5초 뒤) 승패 결과 계산 및 표시
    setTimeout(() => {
      const pCard = playerDeck[currentTurn];
      const oCard = opponentDeck[currentTurn];
      const pPower = pCard.hp + pCard.attack;
      const oPower = oCard.hp + oCard.attack;

      if (pPower > oPower) {
        setTurnResult('WIN');
        setPlayerScore(s => s + 1);
      } else if (pPower < oPower) {
        setTurnResult('LOSE');
        setOpponentScore(s => s + 1);
      } else {
        setTurnResult('DRAW');
      }
      setTurnState('DONE');
    }, 400); 
  };

  // 4. "다음 턴" 버튼을 눌렀을 때
  const handleNextTurn = () => {
    if (currentTurn >= 9) {
      setStage('RESULT');
      if (playerScore > opponentScore) {
        // 최종 승리 시 팡파르
        confetti({ particleCount: 300, spread: 150, origin: { y: 0.5 }, zIndex: 100 });
      }
    } else {
      setCurrentTurn(c => c + 1);
      setTurnResult(null);
      setTurnState('IDLE');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      {/* 닫기 버튼 */}
      <button onClick={onClose} className="absolute top-6 right-6 text-4xl text-white hover:text-red-400 transition-transform hover:scale-110 z-[60]">
        ✖
      </button>

      <AnimatePresence mode="wait">
        {/* 상단 스코어 보드 (배틀 중에만 표시) */}
        {(stage === 'BATTLING' || stage === 'RESULT') && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="absolute top-10 flex gap-8 items-center bg-black/50 px-8 py-4 rounded-full border border-gray-700 shadow-xl z-20">
            <div className="text-center">
              <div className="text-blue-400 font-black text-sm mb-1">YOU</div>
              <div className="text-4xl font-black text-white">{playerScore}</div>
            </div>
            <div className="text-2xl font-bold text-gray-500">VS</div>
            <div className="text-center">
              <div className="text-red-400 font-black text-sm mb-1">{opponent?.name || 'ENEMY'}</div>
              <div className="text-4xl font-black text-white">{opponentScore}</div>
            </div>
          </motion.div>
        )}

        {/* --- 스테이지 1: 상대 선택 --- */}
        {stage === 'SELECT' && (
          <motion.div key="select" exit={{ opacity: 0 }} className="text-center w-full max-w-4xl">
            <h2 className="text-4xl font-black text-white mb-8">⚔️ 대결할 상대를 선택하세요!</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {users.length === 0 ? (
                <div className="col-span-full text-white text-xl">다른 유저를 불러오고 있습니다...</div>
              ) : (
                users.map((user) => (
                  <motion.button
                    key={user.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelectOpponent(user)}
                    className="bg-white p-6 rounded-3xl shadow-xl flex flex-col items-center border-4 border-transparent hover:border-red-400 transition-colors"
                  >
                    <div className="text-5xl mb-4">{user.id === 'user3' ? '👑' : '👦'}</div>
                    <h3 className="text-2xl font-bold text-gray-800">{user.name}</h3>
                    <p className="text-gray-500 font-bold mt-2">보유 몬스터: {user.inventory.length}장</p>
                  </motion.button>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* --- 스테이지 2: 로딩 화면 --- */}
        {stage === 'LOADING' && (
          <motion.div key="loading" exit={{ opacity: 0 }} className="text-white text-2xl font-bold animate-pulse">
            ⚔️ 각자의 인벤토리에서 덱을 구성하는 중...
          </motion.div>
        )}

        {/* --- 스테이지 3: 준비 완료 --- */}
        {stage === 'READY' && (
          <motion.div key="ready" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-center">
            <div className="text-6xl mb-6">🃏</div>
            <h2 className="text-4xl font-black text-white mb-8">10 vs 10 데스매치 준비 완료</h2>
            <button onClick={startBattle} className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-black text-2xl py-4 px-12 rounded-full shadow-[0_0_40px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95 transition-all">
              아레나 입장 🔥
            </button>
          </motion.div>
        )}

        {/* --- 스테이지 4: 배틀 씬 --- */}
        {stage === 'BATTLING' && (
          <motion.div 
            key="battle" 
            className="flex flex-col items-center justify-center gap-6 w-full h-full relative"
            // ⭐️ 패배 시 전체 화면 흔들림 이펙트 적용
            animate={turnState === 'DONE' && turnResult === 'LOSE' ? { x: [-15, 15, -15, 15, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            {/* 턴 백그라운드 표시기 */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10 font-black text-8xl md:text-9xl z-0 pointer-events-none">
              T{currentTurn + 1}
            </div>

            {/* 상대방 카드 */}
            {opponentDeck[currentTurn] && (
              <BattleCard 
                monster={opponentDeck[currentTurn]} 
                isOpponent 
                turnState={turnState}
                isDefeated={turnResult === 'WIN'} 
              />
            )}

            {/* 중앙 인터페이스 (버튼 및 결과 텍스트) */}
            <div className="h-24 flex items-center justify-center z-10 relative w-full">
              {/* 대결 버튼 */}
              {turnState === 'IDLE' && (
                <button onClick={handleClash} className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black text-3xl py-3 px-10 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.8)] active:scale-95 transition-transform">
                  대결! ⚔️
                </button>
              )}

              {/* 승패 텍스트 (화면 중앙에 꽝! 하고 나타남) */}
              <AnimatePresence>
                {turnState === 'DONE' && turnResult && (
                  <motion.div 
                    initial={{ scale: 0, opacity: 0 }} 
                    animate={{ scale: 1.2, opacity: 1 }} 
                    exit={{ scale: 0, opacity: 0 }} 
                    className={`absolute font-black text-6xl italic drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-widest whitespace-nowrap ${
                      turnResult === 'WIN' ? 'text-blue-400' : turnResult === 'LOSE' ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {turnResult === 'WIN' ? '승리!' : turnResult === 'LOSE' ? '패배' : '무승부'}
                  </motion.div>
                )}
              </AnimatePresence>

               {/* 다음 턴 버튼 */}
              {turnState === 'DONE' && (
                <motion.button 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={handleNextTurn} 
                  className="absolute right-0 bg-white/20 hover:bg-white/30 text-white font-bold text-lg py-3 px-6 rounded-full backdrop-blur-sm active:scale-95 transition-all"
                >
                  {currentTurn >= 9 ? '결과 보기 👉' : '다음 턴 ⏭️'}
                </motion.button>
              )}
            </div>

            {/* 내 카드 */}
            {playerDeck[currentTurn] && (
              <BattleCard 
                monster={playerDeck[currentTurn]} 
                turnState={turnState}
                isDefeated={turnResult === 'LOSE'}
              />
            )}
          </motion.div>
        )}

        {/* --- 스테이지 5: 최종 결과 --- */}
        {stage === 'RESULT' && (
          <motion.div key="result" initial={{ scale: 0, y: 50 }} animate={{ scale: 1, y: 0 }} className="text-center bg-white p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
            <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${playerScore >= opponentScore ? 'from-yellow-200/50' : 'from-gray-300/50'} to-transparent pointer-events-none`} />
            <h2 className="text-5xl font-black mb-4 z-10 relative">
              {playerScore > opponentScore ? '🎉 최종 승리! 🎉' : playerScore < opponentScore ? '💀 아쉬운 패배' : '🤝 치열한 무승부'}
            </h2>
            <div className="text-3xl font-bold text-gray-600 mb-8 z-10 relative">
              내 점수 {playerScore} : {opponentScore} 상대 점수
            </div>
            <button onClick={onClose} className="bg-gray-800 text-white font-bold py-4 px-12 rounded-full text-xl hover:bg-gray-700 active:scale-95 transition-all z-10 relative">
              마을로 돌아가기
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}