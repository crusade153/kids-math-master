// hooks/use-global-lobby.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types/game';

export function useGlobalLobby(currentUser: UserProfile | null) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [incomingInvite, setIncomingInvite] = useState<{ hostId: string, hostName: string, gameType: 'ARENA' | 'BOMB' } | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('global_lobby', {
      config: { presence: { key: currentUser.id } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setOnlineUsers(Object.keys(state));
    });

    channel.on('broadcast', { event: 'battle_invite' }, (payload) => {
      if (payload.payload.targetId === currentUser.id) {
        setIncomingInvite({ 
          hostId: payload.payload.hostId, 
          hostName: payload.payload.hostName,
          gameType: payload.payload.gameType || 'ARENA'
        });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ name: currentUser.name });
    });

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  return { onlineUsers, incomingInvite, setIncomingInvite };
}