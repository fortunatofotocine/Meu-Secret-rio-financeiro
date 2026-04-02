import { supabase } from '../../lib/supabaseServer.js';
import { UserContext } from './types.js';

export class UserResolutionService {
  static async resolve(whatsappNumber: string): Promise<UserContext> {
    const normalized = this.normalizePhone(whatsappNumber);
    const lastDigits = normalized.slice(-8);

    // 1. Check confirmed or pending users
    // Try confirmed first
    let { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, trial_ends_at, subscription_status, whatsapp_number, pending_whatsapp')
      .ilike('whatsapp_number', `%${lastDigits}`)
      .limit(1)
      .maybeSingle();

    // If not found, try pending
    if (!profile) {
      const { data: pendingProfile } = await supabase
        .from('profiles')
        .select('id, full_name, trial_ends_at, subscription_status, whatsapp_number, pending_whatsapp')
        .ilike('pending_whatsapp', `%${lastDigits}`)
        .limit(1)
        .maybeSingle();
      profile = pendingProfile;
    }

    if (!profile) {
      return {
        userId: '',
        profileName: 'Visitante',
        whatsappNumber: normalized,
        isRegistered: false,
        state: {
          userId: '',
          status: 'idle',
          lastInteraction: new Date().toISOString()
        }
      };
    }

    return {
      userId: profile.id,
      profileName: profile.full_name || 'Usuário',
      whatsappNumber: normalized,
      isRegistered: !!profile.whatsapp_number,
      isPending: !!profile.pending_whatsapp,
      trialEndsAt: profile.trial_ends_at,
      subscriptionStatus: profile.subscription_status,
      state: undefined // Force fetch from DB in WebhookService
    };
  }

  private static normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    // If it's a Brazilian number (starts with 55), keep it as is.
    // The .ilike('%' + last8) match in resolve() handles the rest.
    return cleaned;
  }
}
