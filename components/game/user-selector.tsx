// components/game/user-selector.tsx
'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/types/game';
import { getUsers } from '@/actions/user-actions';
import { motion } from 'framer-motion';

interface UserSelectorProps {
  onSelect: (user: UserProfile) => void;
}

export default function UserSelector({ onSelect }: UserSelectorProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50">
        <div className="text-4xl animate-bounce">🥚</div>
        <p className="mt-4 font-bold text-gray-500">사용자 정보를 불러오고 있어요...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50 p-4">
      <h1 className="text-3xl font-black text-blue-600 mb-8">누구세요? 👋</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {users.map((user) => (
          <motion.button
            key={user.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(user)}
            className="bg-white p-6 rounded-3xl shadow-xl border-4 border-transparent hover:border-blue-300 transition-all flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-4">
              {user.id === 'user3' ? '👑' : '👦'}
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
            <div className="mt-2 flex gap-2 text-sm font-bold text-gray-500">
              <span>🪙 {user.coins}</span>
              <span>📚 {user.score}점</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}