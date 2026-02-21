// app/page.tsx
import { getMonsters } from '@/actions/game-actions';
import MainClient from '@/components/home/main-client';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // ⭐️ Server First 전략: 서버 컴포넌트에서 무거운 DB 통신(사전 연산)을 완료
  // 클라이언트는 받은 데이터를 그리기만 하는 '도시락 패턴' 적용
  const initialMonsters = await getMonsters();

  return <MainClient initialMonsters={initialMonsters} />;
}