import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Variáveis de ambiente do Supabase não encontradas! Verifique o VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder');

export type Transaction = {
  id: string;
  created_at: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  receipt_url?: string;
  fixed_expense_id?: string;
  fixed_expense_instance_id?: string;
  user_id: string;
};

export type Event = {
  id: string;
  created_at: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  completed: boolean;
};

export type WhatsAppMessage = {
  id: string;
  created_at: string;
  whatsapp_id: string;
  sender_number: string;
  message_text: string;
  status: 'received' | 'processed' | 'pending_confirmation' | 'error';
  interpretation?: any;
};

export type FixedExpenseType = 'fixed' | 'installment' | 'one_time';
export type FixedExpenseStatus = 'pending' | 'paid' | 'overdue';

export type FixedExpense = {
  id: string;
  created_at: string;
  updated_at: string;
  description: string;
  amount: number;
  category: string;
  due_day: number;
  active: boolean;
  user_id: string;
  type: FixedExpenseType;
  total_amount?: number;
  installment_count?: number;
  installment_amount?: number;
  start_date: string;
  end_date?: string;
  notify_whatsapp: boolean;
};

export type FixedExpenseInstance = {
  id: string;
  user_id: string;
  fixed_expense_id: string;
  type: FixedExpenseType;
  installment_number?: number;
  installment_label?: string;
  amount: number;
  due_date: string;
  status: FixedExpenseStatus;
  paid_at?: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  created_at: string;
  whatsapp_number: string;
  full_name: string;
  monthly_income: number;
};
