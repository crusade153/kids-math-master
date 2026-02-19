// actions/battle-actions.ts
'use server';

import { Monster } from '@/types/game';
import { getMonsters } from './game-actions';

// 특정 인벤토리에서 랜덤으로 10장 덱 구성 (내 덱, 상대 덱 공통 사용)
export async function generateDeck(inventoryIds: string[], isOpponent: boolean = false): Promise<Monster[]> {
  const allMonsters = await getMonsters();
  const userMonsters = allMonsters.filter(m => inventoryIds.includes(m.id));
  
  // 만약 소유한 카드가 없다면 임시로 전체 몬스터에서 제공 (버그 방지 및 기본 카드 제공)
  const pool = userMonsters.length > 0 ? userMonsters : allMonsters;
  
  const deck: Monster[] = [];
  for(let i = 0; i < 10; i++) {
    const randomCard = pool[Math.floor(Math.random() * pool.length)];
    // 리액트 Key 에러 방지를 위해 고유 ID 조합
    const prefix = isOpponent ? 'opponent' : 'player';
    deck.push({ ...randomCard, id: `${prefix}-${randomCard.id}-${i}` }); 
  }
  return deck;
}