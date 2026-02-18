// components/ui/motion-card.tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  delay?: number; // 등장 지연 시간
}

export default function MotionCard({ children, className, delay = 0 }: MotionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }} // 시작: 작고 투명하고 아래에 있음
      animate={{ opacity: 1, scale: 1, y: 0 }}    // 끝: 원래 크기, 제자리
      transition={{ 
        type: "spring", // 스프링 물리 엔진 적용
        stiffness: 300, // 튕기는 강도
        damping: 20,    // 멈추는 저항
        delay: delay 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}