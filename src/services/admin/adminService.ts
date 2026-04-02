import { supabase, Profile, AdminLog } from '../../lib/supabase';
import { addDays } from 'date-fns';

export class AdminService {
  /**
   * Helper to log an admin action
   */
  private static async logAction(
    adminId: string,
    targetUserId: string,
    action: AdminLog['action'],
    details: any
  ) {
    const { error } = await supabase.from('admin_logs').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action,
      details
    });

    if (error) console.error('Error logging admin action:', error);
  }

  /**
   * Block a user from accessing the system
   */
  static async blockUser(adminId: string, targetUser: Profile, reason?: string) {
    if (adminId === targetUser.id) throw new Error('Você não pode bloquear a si mesmo.');

    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: true })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'block', {
      old_blocked: targetUser.is_blocked,
      new_blocked: true,
      reason
    });
  }

  /**
   * Unblock a user
   */
  static async unblockUser(adminId: string, targetUser: Profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: false })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'unblock', {
      old_blocked: targetUser.is_blocked,
      new_blocked: false
    });
  }

  /**
   * Reset trial period to +30 days
   */
  static async resetTrial(adminId: string, targetUser: Profile) {
    const newTrialEnd = addDays(new Date(), 30).toISOString();
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        trial_ends_at: newTrialEnd,
        subscription_status: 'trialing'
      })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'reset_trial', {
      old_trial_end: targetUser.trial_ends_at,
      new_trial_end: newTrialEnd,
      old_status: targetUser.subscription_status,
      new_status: 'trialing'
    });
  }

  /**
   * Manually activate a subscription (Infinite or 1-year access)
   */
  static async activateManually(adminId: string, targetUser: Profile) {
    const newEnd = addDays(new Date(), 365).toISOString(); // 1 year manual boost
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        subscription_status: 'active',
        subscription_ends_at: newEnd,
        is_blocked: false // Automatically unblock if manually activated? User decision pending but common logic
      })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'manual_activation', {
      old_status: targetUser.subscription_status,
      new_status: 'active',
      old_end: targetUser.subscription_ends_at,
      new_end: newEnd
    });
  }

  /**
   * Soft delete a user (deactivate)
   */
  static async softDelete(adminId: string, targetUser: Profile) {
    if (adminId === targetUser.id) throw new Error('Você não pode desativar sua própria conta.');

    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: timestamp })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'soft_delete', {
      old_deleted_at: targetUser.deleted_at,
      new_deleted_at: timestamp
    });
  }

  /**
   * Restore a soft-deleted user
   */
  static async restoreUser(adminId: string, targetUser: Profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'restore', {
      old_deleted_at: targetUser.deleted_at,
      new_deleted_at: null
    });
  }

  /**
   * Change user role (Admin only action)
   */
  static async changeRole(adminId: string, targetUser: Profile, newRole: 'user' | 'admin') {
    if (adminId === targetUser.id && newRole !== 'admin') {
      throw new Error('Você não pode remover seu próprio acesso administrativo.');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUser.id);

    if (error) throw error;

    await this.logAction(adminId, targetUser.id, 'change_role', {
      old_role: targetUser.role,
      new_role: newRole
    });
  }
}
