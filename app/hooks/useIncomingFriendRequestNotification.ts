import { useAuthStore } from '../state/useAuthStore';
import { useSocialStore } from '../state/useSocialStore';
import { hasPendingIncomingFriendRequests } from '../../shared/socialPolicy';

export default function useIncomingFriendRequestNotification(): boolean {
  const currentUserId = useAuthStore((state) => state.user?.sub ?? null);

  return useSocialStore((state) => hasPendingIncomingFriendRequests({
    ownerId: state.ownerId,
    currentUserId,
    incomingCount: state.incoming.length,
  }));
}
