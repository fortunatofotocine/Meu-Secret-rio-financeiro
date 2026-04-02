import { supabase } from '../../lib/supabaseServer.js';
import { ConversationState, ConversationStatus, Intent, IntentEntities } from './types.js';

export class ConversationStateService {
  static async get(userId: string): Promise<ConversationState | null> {
    const { data, error } = await supabase
      .from('conversation_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // 1-hour Expiration Policy
    const lastUpdate = new Date(data.updated_at).getTime();
    const now = new Date().getTime();
    const oneHour = 60 * 60 * 1000;

    if (now - lastUpdate > oneHour) {
      console.log(`[ConversationState] State for ${userId} expired (> 1h).`);
      return null;
    }

    return {
      userId: data.user_id,
      status: data.status as ConversationStatus,
      pendingIntent: data.pending_intent as Intent,
      pendingEntities: data.pending_entities as IntentEntities,
      lastInteraction: data.updated_at,
    };
  }

  static async set(userId: string, state: Partial<ConversationState>): Promise<void> {
    const updateData: any = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    updateData.status = state.status || 'idle';
    updateData.pending_intent = state.pendingIntent || null;
    updateData.pending_entities = state.pendingEntities || null;

    const { error } = await supabase
      .from('conversation_state')
      .upsert(updateData);

    if (error) {
      console.error(`[ConversationState] Error setting state for ${userId}:`, error);
    }
  }

  static async clear(userId: string): Promise<void> {
    await this.set(userId, {
      status: 'idle',
      pendingIntent: undefined,
      pendingEntities: undefined
    });
  }
}
