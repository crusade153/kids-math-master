// store/game-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // ⭐ 저장 미들웨어 추가

interface GameState {
  // 게임 플레이 상태 (휘발성)
  score: number;
  combo: number;
  maxCombo: number;
  feverMode: boolean;

  // 영구 저장 데이터 (코인 & 수집품)
  coins: number;
  inventory: string[]; // 획득한 몬스터 ID 목록

  // 액션
  addScore: (points: number) => void;
  resetGame: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  
  // 상점 액션
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean; // 성공 여부 반환
  unlockMonster: (monsterId: string) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // 초기값
      score: 0,
      combo: 0,
      maxCombo: 0,
      feverMode: false,
      coins: 0,
      inventory: [],

      // 게임 로직
      addScore: (points) => set((state) => ({ score: state.score + points })),
      
      incrementCombo: () => set((state) => {
        const newCombo = state.combo + 1;
        return {
          combo: newCombo,
          maxCombo: Math.max(state.maxCombo, newCombo),
          feverMode: newCombo >= 5,
        };
      }),

      resetCombo: () => set({ combo: 0, feverMode: false }),
      resetGame: () => set({ score: 0, combo: 0, maxCombo: 0, feverMode: false }),

      // 💰 경제 시스템 로직
      addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
      
      spendCoins: (amount) => {
        const current = get().coins;
        if (current >= amount) {
          set({ coins: current - amount });
          return true; // 구매 성공
        }
        return false; // 잔액 부족
      },

      unlockMonster: (monsterId) => set((state) => {
        if (state.inventory.includes(monsterId)) return state; // 이미 있으면 무시
        return { inventory: [...state.inventory, monsterId] };
      }),
    }),
    {
      name: 'kids-math-storage', // 브라우저 저장소 이름
      partialize: (state) => ({ coins: state.coins, inventory: state.inventory }), // 코인과 인벤토리만 저장 (점수는 초기화)
    }
  )
);