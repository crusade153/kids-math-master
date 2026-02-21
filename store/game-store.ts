// store/game-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types/game';
import { syncUserProgress } from '@/actions/user-actions';

interface GameState {
  currentUser: (UserProfile & { dailySolvedCount?: number, claimedRewards?: number[] }) | null;
  score: number;
  combo: number;
  maxCombo: number;
  feverMode: boolean;

  dailySolvedCount: number;
  claimedRewards: number[];

  login: (user: UserProfile & { dailySolvedCount?: number, claimedRewards?: number[] }) => void;
  logout: () => void;
  addScore: (points: number) => void;
  resetGame: () => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  unlockMonster: (monsterId: string) => void;
  mergeMonsters: (invId: string) => void;
  incrementSolvedCount: () => void;
  claimMissionReward: (step: number, coinReward: number) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      feverMode: false,
      dailySolvedCount: 0,
      claimedRewards: [],

      login: (user) => set({ 
        currentUser: user, 
        score: user.score || 0,
        dailySolvedCount: user.dailySolvedCount || 0,
        claimedRewards: user.claimedRewards || []
      }),

      logout: () => set({ currentUser: null, score: 0, dailySolvedCount: 0, claimedRewards: [] }),

      addScore: (points) => {
        set((state) => {
          const newScore = state.score + points;
          if (state.currentUser) syncUserProgress(state.currentUser.id, { score: newScore });
          return { score: newScore };
        });
      },

      incrementCombo: () => set((state) => {
        const newCombo = state.combo + 1;
        return {
          combo: newCombo,
          maxCombo: Math.max(state.maxCombo, newCombo),
          feverMode: newCombo >= 5,
        };
      }),

      resetCombo: () => set({ combo: 0, feverMode: false }),
      resetGame: () => set({ combo: 0, feverMode: false }),

      addCoins: (amount) => {
        const state = get();
        if (!state.currentUser) return;
        const newCoins = state.currentUser.coins + amount;
        set({ currentUser: { ...state.currentUser, coins: newCoins } });
        syncUserProgress(state.currentUser.id, { coins: newCoins });
      },

      spendCoins: (amount) => {
        const state = get();
        if (!state.currentUser || state.currentUser.coins < amount) return false;
        const newCoins = state.currentUser.coins - amount;
        set({ currentUser: { ...state.currentUser, coins: newCoins } });
        syncUserProgress(state.currentUser.id, { coins: newCoins });
        return true;
      },

      unlockMonster: (monsterId) => {
        const state = get();
        if (!state.currentUser) return;
        const newInventory = [...state.currentUser.inventory, monsterId];
        set({ currentUser: { ...state.currentUser, inventory: newInventory } });
        syncUserProgress(state.currentUser.id, { inventory: newInventory });
      },

      mergeMonsters: (invId) => {
        const state = get();
        if (!state.currentUser) return;
        const inv = [...state.currentUser.inventory];
        let count = 0;
        const newInv = inv.filter(id => {
          if (id === invId && count < 3) { count++; return false; }
          return true;
        });
        if (count === 3) {
          const [baseId, lvlStr] = String(invId).split('_');
          const level = parseInt(lvlStr || '0', 10);
          newInv.push(`${baseId}_${level + 1}`);
          set({ currentUser: { ...state.currentUser, inventory: newInv } });
          syncUserProgress(state.currentUser.id, { inventory: newInv });
        }
      },

      incrementSolvedCount: () => set((state) => {
        const newCount = state.dailySolvedCount + 1;
        if (state.currentUser) syncUserProgress(state.currentUser.id, { dailySolvedCount: newCount });
        return { dailySolvedCount: newCount };
      }),

      claimMissionReward: (step, coinReward) => {
        const state = get();
        if (state.dailySolvedCount >= step && !state.claimedRewards.includes(step)) {
          state.addCoins(coinReward);
          const newClaimed = [...state.claimedRewards, step];
          set({ claimedRewards: newClaimed });
          if (state.currentUser) syncUserProgress(state.currentUser.id, { claimedRewards: newClaimed });
        }
      }
    }),
    {
      name: 'kids-math-storage', // 로컬 스토리지에 저장될 이름
    }
  )
);