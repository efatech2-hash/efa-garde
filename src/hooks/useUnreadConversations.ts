import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUnreadConversationsCount,
  subscribeToStore,
  getSupabaseClient,
  getOrCreateClientId,
} from '../services/store';
import { playNotificationSound } from '../services/sound';

export function useUnreadConversations(
  role: 'client' | 'pharma' | 'pharma_active' | 'pharma_pending',
  activePharmaId?: string
) {
  const isPharma =
    role === 'pharma' || role === 'pharma_active' || role === 'pharma_pending';
  const currentUid = isPharma ? activePharmaId || 'pharma-1' : getOrCreateClientId();

  const [unreadCount, setUnreadCount] = useState<number>(() => {
    return getUnreadConversationsCount(
      currentUid,
      isPharma ? 'pharma' : 'client',
      activePharmaId
    );
  });

  const currentUidRef = useRef(currentUid);
  currentUidRef.current = currentUid;

  const isPharmaRef = useRef(isPharma);
  isPharmaRef.current = isPharma;

  const activePharmaIdRef = useRef(activePharmaId);
  activePharmaIdRef.current = activePharmaId;

  // Calcul du nombre de conversations non lues
  const refetch = useCallback(() => {
    const count = getUnreadConversationsCount(
      currentUidRef.current,
      isPharmaRef.current ? 'pharma' : 'client',
      activePharmaIdRef.current
    );
    setUnreadCount(count);
    return count;
  }, []);

  // Demande de permission Notification système
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Demande douce
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // Écoute locale + BroadcastChannel cross-onglets
  useEffect(() => {
    refetch();

    const unsub = subscribeToStore(() => {
      refetch();
    });

    const channel =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('efa_garde_realtime_bus')
        : null;

    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === 'NEW_MESSAGE') {
          const { receiverId, content, sender } = event.data;
          const targetUid = currentUidRef.current;
          const isTargetReceiver =
            receiverId === targetUid ||
            (isPharmaRef.current && sender === 'client' && (receiverId === activePharmaIdRef.current || receiverId === 'pharma-1')) ||
            (!isPharmaRef.current && sender === 'pharma');

          if (isTargetReceiver) {
            playNotificationSound();

            // Si en arrière-plan, déclencher la notification système
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted' &&
              (document.hidden || !document.hasFocus())
            ) {
              try {
                new Notification('EFA Garde', {
                  body: content || 'Nouveau message reçu',
                  icon: '/icon-512.png',
                });
              } catch {
                // ignore
              }
            }
          }
          refetch();
        } else if (
          event.data?.type === 'BLOCK_UPDATE' ||
          event.data?.type === 'SYNC'
        ) {
          refetch();
        }
      };
    }

    // Écoute Supabase Realtime
    let sbChannel: any = null;
    try {
      const sb = getSupabaseClient();
      if (sb && typeof sb.channel === 'function') {
        sbChannel = sb
          .channel('conversations_unread_tracker')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'conversations' },
            () => {
              refetch();
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload: any) => {
              const newMsg = payload.new;
              if (newMsg) {
                const targetUid = currentUidRef.current;
                const isTarget =
                  newMsg.receiver_id === targetUid ||
                  (isPharmaRef.current && newMsg.sender === 'client');

                if (isTarget) {
                  playNotificationSound();
                  if (
                    typeof window !== 'undefined' &&
                    'Notification' in window &&
                    Notification.permission === 'granted' &&
                    (document.hidden || !document.hasFocus())
                  ) {
                    try {
                      new Notification('EFA Garde', {
                        body: newMsg.content || newMsg.text || 'Nouveau message',
                        icon: '/icon-512.png',
                      });
                    } catch {}
                  }
                }
              }
              refetch();
            }
          )
          .subscribe();
      }
    } catch {
      // mode autonome
    }

    return () => {
      unsub();
      if (channel) {
        channel.close();
      }
      if (sbChannel) {
        try {
          const sb = getSupabaseClient();
          if (sb) sb.removeChannel(sbChannel);
        } catch {}
      }
    };
  }, [refetch]);

  return { unreadCount, refetch };
}
