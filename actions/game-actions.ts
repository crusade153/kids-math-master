// actions/game-actions.ts
'use server';

import { loadSheet } from '@/lib/google-sheets';
import { Monster } from '@/types/game';

// 1. 모든 몬스터 데이터 가져오기 (캐싱 적용 가능)
export async function getMonsters(): Promise<Monster[]> {
  try {
    const doc = await loadSheet();
    const sheet = doc.sheetsByTitle['Pokemon_DB']; // 시트 탭 이름 확인!
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
    }));
  } catch (error) {
    console.error('구글 시트 로딩 실패:', error);
    return [];
  }
}

// 2. 랜덤 몬스터 뽑기 (Server Action)
export async function pullRandomMonster(): Promise<Monster | null> {
  const monsters = await getMonsters();
  if (monsters.length === 0) return null;

  const rand = Math.random();
  let targetRarity = 'COMMON';

  if (rand > 0.95) targetRarity = 'LEGENDARY';
  else if (rand > 0.60) targetRarity = 'RARE';

  const pool = monsters.filter((m) => m.rarity === targetRarity);
  const finalPool = pool.length > 0 ? pool : monsters; // 안전장치

  return finalPool[Math.floor(Math.random() * finalPool.length)];
}