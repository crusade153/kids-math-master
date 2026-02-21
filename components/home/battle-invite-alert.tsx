// components/home/battle-invite-alert.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface BattleInviteAlertProps {
  invite: { hostId: string; hostName: string } | null;
  onAccept: () => void;
  onDecline: () => void;
}

export default function BattleInviteAlert({ invite, onAccept, onDecline }: BattleInviteAlertProps) {
  return (
    <AnimatePresence>
      {invite && (
        <motion.div 
          initial={{ y: -100, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          exit={{ y: -100, opacity: 0 }} 
          className="fixed top-10 w-full max-w-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-6 rounded-3xl shadow-2xl z-[100] flex flex-col items-center border-4 border-yellow-400"
        >
          <div className="text-4xl mb-2 animate-bounce">⚔️</div>
          <span className="font-black text-xl mb-6 text-center leading-tight">
            <span className="text-yellow-300">{invite.hostName}</span>님이<br/>실시간 대결을 신청했습니다!
          </span>
          <div className="flex gap-3 w-full">
            <button 
              onClick={onAccept} 
              className="flex-1 bg-yellow-400 text-yellow-900 font-black px-6 py-4 rounded-2xl hover:scale-105 active:scale-95 shadow-lg transition-transform"
            >
              수락하기 🔥
            </button>
            <button 
              onClick={onDecline} 
              className="flex-1 bg-gray-800 text-white font-black px-6 py-4 rounded-2xl hover:scale-105 active:scale-95 shadow-lg transition-transform"
            >
              도망가기 🏃
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}