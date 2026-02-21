// components/home/main-client.tsx
'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/game-store';
import UserSelector from '@/components/game/user-selector';
import TownView from '@/components/home/town-view';
import MathGameView from '@/components/home/math-game-view';
import { MathOperation, Difficulty } from '@/types/math';
import { Monster } from '@/types/game';

interface MainClientProps {
  initialMonsters: Monster[];
}

export default function MainClient({ initialMonsters }: MainClientProps) {
  const { currentUser, login } = useGameStore();
  const [gameConfig, setGameConfig] = useState<{ mode: MathOperation; difficulty: Difficulty } | null>(null);

  // ⭐️ 유저가 접속하지 않았으면 로그인 화면(UserSelector)으로 가드(Guard)
  if (!currentUser) {
    return <UserSelector onSelect={login} />;
  }

  // ⭐️ 상태 분리: 게임 중일 때는 Town UI가 렌더링(메모리 차지)되지 않음
  if (gameConfig) {
    return (
      <MathGameView 
        mode={gameConfig.mode} 
        difficulty={gameConfig.difficulty} 
        onExit={() => setGameConfig(null)} 
      />
    );
  }

  return (
    <TownView 
      allMonsters={initialMonsters} 
      onStartGame={(mode, difficulty) => setGameConfig({ mode, difficulty })} 
    />
  );
}