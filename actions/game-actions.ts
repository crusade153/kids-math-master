// actions/game-actions.ts
'use server';

import { loadSheet } from '@/lib/google-sheets';
import { Monster } from '@/types/game';

// 1. 모든 몬스터 데이터 가져오기
export async function getMonsters(): Promise<Monster[]> {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByTitle['Pokemon_DB']; 
    if (!sheet) return [];

    const rows = await sheet.getRows();

    return rows.map((row) => ({
      id: row.get('ID'),
      name: row.get('이름'),
      generation: row.get('세대'),
      rarity: row.get('등급') as any,
      type: row.get('타입'),
      skills: row.get('주요 스킬'),
      description: row.get('상세 설명'),
      history: row.get('히스토리/특이사항'),
      image: row.get('이미지 URL') || '',
      hp: parseInt(row.get('HP') || row.get('hp') || '100', 10),
      attack: parseInt(row.get('공격력') || '10', 10),
    }));
  } catch (error) {
    console.error('구글 시트 로딩 실패:', error);
    return [];
  }
}

// 2. [10코인] 일반 뽑기 (낮은 확률로 희귀/전설)
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

// 3. [50코인] 고급 뽑기 (RARE 이상 확정, 약간 높은 확률로 전설)
export async function pullPremiumMonster(): Promise<Monster | null> {
  const monsters = await getMonsters();
  if (monsters.length === 0) return null;

  const rand = Math.random();
  const isLegendary = rand > 0.85; // 15% 확률로 전설 획득

  const pool = monsters.filter((m) => {
    if (isLegendary) return m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL';
    return m.rarity === 'RARE';
  });

  const finalPool = pool.length > 0 ? pool : monsters.filter(m => m.rarity !== 'COMMON');
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

// 4. [100코인] 전설 뽑기 (LEGENDARY 또는 MYTHICAL 확정)
export async function pullLegendaryMonster(): Promise<Monster | null> {
  const monsters = await getMonsters();
  const pool = monsters.filter(m => m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL');
  if (pool.length === 0) return null;
  
  return pool[Math.floor(Math.random() * pool.length)];
}

// 5. [200코인] 전설 선택권용 몬스터 목록 불러오기
export async function getSelectableLegendaries(): Promise<Monster[]> {
  const monsters = await getMonsters();
  return monsters.filter(m => m.rarity === 'LEGENDARY' || m.rarity === 'MYTHICAL');
}