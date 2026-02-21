// actions/game-actions.ts
'use server';

import { supabase } from '@/lib/supabase';
import { Monster } from '@/types/game';

// 1. 모든 몬스터 데이터 가져오기 (실시간 즉시 로딩)
export async function getMonsters(): Promise<Monster[]> {
  try {
    const { data, error } = await supabase.from('monsters').select('*');
    
    if (error) {
      console.error('Supabase 몬스터 로딩 실패:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: String(row.id), // 숫자로 오더라도 무조건 문자로 변환
      name: row.name,
      generation: row.generation,
      rarity: row.rarity,
      type: row.type,
      skills: row.skills,
      description: row.description,
      history: row.history,
      image: row.image || '',
      hp: row.hp || 100,
      attack: row.attack || 10,
    }));
  } catch (error) {
    console.error('몬스터 로딩 중 예외 발생:', error);
    return [];
  }
}

// 2. [10코인] 일반 뽑기
export async function pullRandomMonster(): Promise<Monster | null> {
  const monsters = await getMonsters();
  if (monsters.length === 0) return null;

  const rand = Math.random();
  let targetRarity = 'COMMON';

  if (rand > 0.95) targetRarity = 'LEGENDARY'; 
  else if (rand > 0.60) targetRarity = 'RARE';

  const pool = monsters.filter((m) => {
    if (targetRarity === 'LEGENDARY') return m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL';
    return m.rarity === targetRarity;
  });
  
  const finalPool = pool.length > 0 ? pool : monsters;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

// 3. [50코인] 고급 뽑기
export async function pullPremiumMonster(): Promise<Monster | null> {
  const monsters = await getMonsters();
  if (monsters.length === 0) return null;

  const rand = Math.random();
  const isLegendary = rand > 0.85;

  const pool = monsters.filter((m) => {
    if (isLegendary) return m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL';
    return m.rarity === 'RARE';
  });

  const finalPool = pool.length > 0 ? pool : monsters.filter(m => m.rarity !== 'COMMON');
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

// 4. [100코인] 전설 뽑기
export async function pullLegendaryMonster(): Promise<Monster | null> {
  const monsters = await getMonsters();
  const pool = monsters.filter(m => m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL');
  if (pool.length === 0) return null;
  
  return pool[Math.floor(Math.random() * pool.length)];
}

// 5. [200코인] 전설 선택권
export async function getSelectableLegendaries(): Promise<Monster[]> {
  const monsters = await getMonsters();
  return monsters.filter(m => m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL');
}