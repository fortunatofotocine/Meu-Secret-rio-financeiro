import { supabase } from '../../lib/supabaseServer';
import { ConversationState, ConversationStatus, Intent, IntentEntities } from './types';

export class ConversationStateService {
  static async get(userId: string): Promise<ConversationState> {
    const { data, error } = await supabase
      .from('conversation_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        userId,
        status: 'idle',
        lastInteraction: new Date().toISOString(),
      };
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

    if (state.status) updateData.status = state.status;
    if (state.pendingIntent) updateData.pending_intent = state.pendingIntent;
    if (state.pendingEntities) updateData.pending_entities = state.pendingEntities;

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
