import { createHash } from 'node:crypto';
import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import type { PoolClient } from 'pg';
import { chooseAvailableGeneratedUsername } from '../../../shared/username';
import { chooseIdentityProvisioningAction } from '../../../shared/identityPolicy';
import { authorizeUser, type Auth0UserInfo } from './auth';
import { queryWithClient, withTransaction } from './db';

export type IdentityIntent = 'signup' | 'login' | 'restore';
export type IdentityOnboardingStatus = 'username_required' | 'complete';

interface IdentityRow {
  id: string;
  username: string | null;
  onboarding_status: IdentityOnboardingStatus;
}

export interface SyncedIdentity {
  username: string | null;
  usernameRequired: boolean;
  onboardingStatus: IdentityOnboardingStatus;
}

function getUsernameSuffixes(userId: string): string[] {
  return Array.from({ length: 8 }, (_, attempt) =>
    createHash('sha256')
      .update(attempt === 0 ? userId : `${userId}:${attempt}`)
      .digest('hex')
      .slice(0, 8)
  );
}

async function generateAvailableUsername(
  client: PoolClient,
  user: Auth0UserInfo
): Promise<string> {
  return chooseAvailableGeneratedUsername(
    user.email,
    getUsernameSuffixes(user.sub),
    async (candidate) => {
      const matchingUsers = await queryWithClient<{ id: string }>(
        client,
        `SELECT id
         FROM users
         WHERE username_normalized = $1
           AND id != $2
         LIMIT 1`,
        [candidate, user.sub]
      );
      return matchingUsers.length > 0;
    }
  );
}

function isRetryableIdentityRace(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }
  const code = String(error.code);
  return code === '40001' || code === '23505';
}

async function updateVerifiedProfile(
  client: PoolClient,
  user: Auth0UserInfo
): Promise<void> {
  await queryWithClient(
    client,
    `UPDATE users
     SET
       email = COALESCE($2, email),
       avatar_url = COALESCE($3, avatar_url)
     WHERE id = $1`,
    [user.sub, user.email || null, user.picture || null]
  );
}

async function syncIdentityRecordOnce(
  user: Auth0UserInfo,
  intent: IdentityIntent
): Promise<SyncedIdentity> {
  return withTransaction(async (client) => {
    const existing = await queryWithClient<IdentityRow>(
      client,
      `SELECT id, username, onboarding_status
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [user.sub]
    );
    const current = existing[0];
    const action = chooseIdentityProvisioningAction({
      hasUserRow: Boolean(current),
      hasUsername: Boolean(current?.username),
      onboardingStatus: current?.onboarding_status,
      intent,
    });

    if (current) {
      await updateVerifiedProfile(client, user);

      if (action === 'use_existing' && current.username) {
        if (current.onboarding_status !== 'complete') {
          await queryWithClient(
            client,
            `UPDATE users SET onboarding_status = 'complete' WHERE id = $1`,
            [user.sub]
          );
        }
        return {
          username: current.username,
          usernameRequired: false,
          onboardingStatus: 'complete',
        };
      }

      if (action === 'require_username') {
        return {
          username: null,
          usernameRequired: true,
          onboardingStatus: 'username_required',
        };
      }

      const generated = await generateAvailableUsername(client, user);
      await queryWithClient(
        client,
        `UPDATE users
         SET
           username = $2,
           username_normalized = $2,
           username_last_changed_at = NULL,
           onboarding_status = 'complete'
         WHERE id = $1`,
        [user.sub, generated]
      );
      return {
        username: generated,
        usernameRequired: false,
        onboardingStatus: 'complete',
      };
    }

    if (action === 'require_username') {
      await queryWithClient(
        client,
        `INSERT INTO users (
           id,
           email,
           avatar_url,
           onboarding_status,
           created_at
         )
         VALUES ($1, $2, $3, 'username_required', NOW())`,
        [user.sub, user.email || null, user.picture || null]
      );
      return {
        username: null,
        usernameRequired: true,
        onboardingStatus: 'username_required',
      };
    }

    const generated = await generateAvailableUsername(client, user);
    await queryWithClient(
      client,
      `INSERT INTO users (
         id,
         email,
         avatar_url,
         username,
         username_normalized,
         username_last_changed_at,
         onboarding_status,
         created_at
       )
       VALUES ($1, $2, $3, $4, $4, NULL, 'complete', NOW())`,
      [user.sub, user.email || null, user.picture || null, generated]
    );
    return {
      username: generated,
      usernameRequired: false,
      onboardingStatus: 'complete',
    };
  });
}

export async function syncIdentityRecord(
  user: Auth0UserInfo,
  intent: IdentityIntent
): Promise<SyncedIdentity> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await syncIdentityRecordOnce(user, intent);
    } catch (error) {
      if (attempt === 2 || !isRetryableIdentityRace(error)) {
        throw error;
      }
    }
  }

  throw new Error('Identity synchronization did not complete');
}

export type CompletedIdentityResult =
  | { identity: { username: string; user: Auth0UserInfo }; response: null }
  | { identity: null; response: HandlerResponse };

export async function requireCompletedIdentity(
  event: HandlerEvent,
  userId: string,
  headers: Record<string, string>
): Promise<CompletedIdentityResult> {
  const authorization = await authorizeUser(event, userId, headers);
  if (authorization.response) {
    return { identity: null, response: authorization.response };
  }

  const synced = await syncIdentityRecord(authorization.user, 'login');
  if (!synced.username || synced.usernameRequired) {
    return {
      identity: null,
      response: {
        statusCode: 428,
        headers,
        body: JSON.stringify({
          error: 'A username is required to continue',
          code: 'USERNAME_REQUIRED',
        }),
      },
    };
  }

  return {
    identity: {
      username: synced.username,
      user: authorization.user,
    },
    response: null,
  };
}
