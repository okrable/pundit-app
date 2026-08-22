import { withLambda, type LambdaHandler } from '@netlify/aws-lambda-compat';
import { query, queryWithClient, withTransaction } from './lib/db';
import { assertAuthorizedUser } from './lib/auth';
import { isAvatarId } from '../../shared/avatarCatalog';
import type {
  AchievementSyncEnvelope,
  AvatarChangeAchievementEvent,
} from '../../shared/achievements';
import { getQuizDate } from './lib/quizDate';
import {
  applyServerAchievementAcknowledgements,
  applyServerAchievementEvent,
  getServerAchievementSnapshotForUser,
} from './lib/achievements';

const DISPLAY_NAME_MAX_LENGTH = 50;

const handler: LambdaHandler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      userId,
      displayName,
      avatarId,
      achievementEvent,
      achievementSync,
    }: {
      userId?: string;
      displayName?: unknown;
      avatarId?: unknown;
      achievementEvent?: AvatarChangeAchievementEvent;
      achievementSync?: AchievementSyncEnvelope;
    } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId is required' }),
      };
    }

    // Reject guest users
    if (userId.startsWith('guest_')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Sign in to update profile' }),
      };
    }

    const authError = await assertAuthorizedUser(event, userId, headers, { allowGuest: false });
    if (authError) {
      return authError;
    }

    if (avatarId !== undefined) {
      if (!isAvatarId(avatarId)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid avatar' }),
        };
      }

      const result = await withTransaction(async (client) => {
        const current = await queryWithClient<{ avatar_id: string | null }>(
          client,
          'SELECT avatar_id FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        if (!current[0]) return null;

        const changed = current[0].avatar_id !== avatarId;
        if (changed) {
          await queryWithClient(
            client,
            'UPDATE users SET avatar_id = $2 WHERE id = $1',
            [userId, avatarId]
          );
        }

        const validClientEventId =
          achievementEvent?.kind === 'avatar-change' &&
          typeof achievementEvent.id === 'string' &&
          achievementEvent.id.length > 0 &&
          achievementEvent.id.length <= 200;
        const canonicalEvent: AvatarChangeAchievementEvent = {
          id: validClientEventId
            ? achievementEvent.id
            : `avatar:${userId}:${getQuizDate()}:${Date.now()}`,
          kind: 'avatar-change',
          occurredAt: new Date().toISOString(),
          quizDate: getQuizDate(),
          allowCumulative: true,
        };
        const achievements = changed
          ? await applyServerAchievementEvent(
              client,
              userId,
              canonicalEvent,
              achievementSync
            )
          : await (async () => {
              await applyServerAchievementAcknowledgements(
                client,
                userId,
                achievementSync?.acknowledgedIds
              );
              return {
                snapshot: await getServerAchievementSnapshotForUser(client, userId),
                newlyUnlocked: [],
                rejectedProposedIds: [],
              };
            })();
        return { avatarId: avatarId as string, achievements };
      });
      if (!result) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'User not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          profile: { avatarId: result.avatarId },
          achievementSnapshot: result.achievements.snapshot,
          newlyUnlockedAchievements: result.achievements.newlyUnlocked,
          rejectedAchievementIds: result.achievements.rejectedProposedIds,
        }),
      };
    }

    // Validate display name if provided
    if (displayName !== undefined) {
      if (typeof displayName !== 'string') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid display name' }),
        };
      }

      const trimmedName = displayName.trim();
      if (trimmedName.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: false, error: 'Display name cannot be empty' }),
        };
      }

      if (trimmedName.length > DISPLAY_NAME_MAX_LENGTH) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
          }),
        };
      }

      // Update display name
      await query(
        `UPDATE users SET display_name = $2 WHERE id = $1`,
        [userId, trimmedName]
      );

      // Fetch updated profile
      const updated = await query<{
        display_name: string | null;
        username: string | null;
      }>(
        'SELECT display_name, username FROM users WHERE id = $1',
        [userId]
      );

      if (updated.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'User not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          profile: {
            displayName: updated[0].display_name,
            username: updated[0].username,
          },
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, error: 'No fields to update' }),
    };
  } catch (error) {
    console.error('Error updating profile:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  }
};

export default withLambda(handler);
