// actions/battle-actions.ts
'use server';

import { Monster } from '@/types/game';
import { getMonsters } from './game-actions';

export async function generateDeck(inventoryIds: string[], isOpponent: boolean = false): Promise<Monster[]> {
  const allMonsters = await getMonsters();
  
  // ⭐️ 획득한 카드(인벤토리)의 레벨(_1, _2)을 파싱하여 스탯 상승폭을 덮어씌웁니다.
  const userMonsters = inventoryIds.map(invId => {
    const [baseId, lvl] = invId.split('_');
    const level = parseInt(lvl || '0', 10);
    const m = allMonsters.find(x => x.id === baseId);
    
    if (!m) return null;
    
    const buff = 1 + (0.2 * level); // 레벨당 스탯 20% 증가
    return {
      ...m,
      hp: Math.round(m.hp * buff),
      attack: Math.round(m.attack * buff),
      name: level > 0 ? `${m.name} +${level}` : m.name
    };
  }).filter(Boolean) as Monster[];
  
  const pool = userMonsters.length > 0 ? userMonsters : allMonsters;
  
  const deck: Monster[] = [];
  for(let i = 0; i < 10; i++) {
    const randomCard = pool[Math.floor(Math.random() * pool.length)];
    const prefix = isOpponent ? 'opponent' : 'player';
    deck.push({ ...randomCard, id: `${prefix}-${randomCard.id}-${i}` }); 
  }
  return deck;
}