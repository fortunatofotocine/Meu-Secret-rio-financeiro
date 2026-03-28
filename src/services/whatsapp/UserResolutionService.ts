import { supabase } from '../../lib/supabaseServer';
import { UserContext } from './types';

export class UserResolutionService {
  static async resolve(whatsappNumber: string): Promise<UserContext> {
    const normalized = this.normalizePhone(whatsappNumber);
    const lastDigits = normalized.slice(-8);

    const { data: profile, error } = await supabase
      .from('profiles')
      .ilike('whatsapp_number', `%${lastDigits}`)
      .limit(1)
      .single();

    if (error || !profile) {
      return {
        userId: '',
        profileName: 'Visitante',
        whatsappNumber: normalized,
        isRegistered: false,
      };
    }

    return {
      userId: profile.id,
      profileName: profile.full_name || 'Usuário',
      whatsappNumber: normalized,
      isRegistered: true,
    };
  }

  private static normalizePhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  }
}
