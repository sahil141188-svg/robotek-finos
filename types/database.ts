/** Roles available in the UI. COO exists in DB enum but is not used. */
export type UserRole = "ceo" | "cfo" | "accounts" | "ca";

/** All granular module permissions — stored as JSONB on each user row */
export type UserPermissions = {
  view_dashboard:  boolean;
  import_data:     boolean;
  view_compliance: boolean;
  manage_tasks:    boolean;
  view_payables:   boolean;
  view_receivables:boolean;
  view_banking:    boolean;  // Module 8 — Bank Statement Dashboard
  view_review:     boolean;
  view_alerts:     boolean;
  admin_users:     boolean;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          is_active: boolean;
          permissions: UserPermissions;
          whatsapp_number: string | null;
          notify_whatsapp: boolean;
          notify_email: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          role: UserRole;
          is_active?: boolean;
          permissions?: UserPermissions;
          whatsapp_number?: string | null;
          notify_whatsapp?: boolean;
          notify_email?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          is_active?: boolean;
          permissions?: UserPermissions;
          whatsapp_number?: string | null;
          notify_whatsapp?: boolean;
          notify_email?: boolean;
          updated_at?: string;
        };
      };
      companies: {
        Row: {
          id:               string;
          name:             string;
          short_name:       string;
          type:             string;
          city:             string;
          gstin:            string;
          color_class:      string;
          status:           "active" | "dormant";
          monthly_revenue:  number;
          ap_outstanding:   number;
          ar_outstanding:   number;
          cash_balance:     number;
          net_pl_monthly:   number;
          compliance_score: number;
          employee_count:   number;
          sort_order:       number;
          created_at:       string;
          updated_at:       string;
        };
        Insert: {
          id?:              string;
          name:             string;
          short_name:       string;
          type?:            string;
          city?:            string;
          gstin?:           string;
          color_class?:     string;
          status?:          "active" | "dormant";
          monthly_revenue?: number;
          ap_outstanding?:  number;
          ar_outstanding?:  number;
          cash_balance?:    number;
          net_pl_monthly?:  number;
          compliance_score?:number;
          employee_count?:  number;
          sort_order?:      number;
        };
        Update: {
          name?:            string;
          short_name?:      string;
          type?:            string;
          city?:            string;
          gstin?:           string;
          color_class?:     string;
          status?:          "active" | "dormant";
          monthly_revenue?: number;
          ap_outstanding?:  number;
          ar_outstanding?:  number;
          cash_balance?:    number;
          net_pl_monthly?:  number;
          compliance_score?:number;
          employee_count?:  number;
          sort_order?:      number;
          updated_at?:      string;
        };
      };
      transactions: {
        Row: {
          id: string;
          transaction_date: string;
          voucher_number: string | null;
          voucher_type: string;
          ledger_name: string;
          amount: number;
          dr_cr: "DR" | "CR";
          narration: string | null;
          financial_year: string;
          import_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_date: string;
          voucher_number?: string | null;
          voucher_type: string;
          ledger_name: string;
          amount: number;
          dr_cr: "DR" | "CR";
          narration?: string | null;
          financial_year: string;
          import_id?: string | null;
          created_at?: string;
        };
        Update: {
          transaction_date?: string;
          voucher_number?: string | null;
          voucher_type?: string;
          ledger_name?: string;
          amount?: number;
          dr_cr?: "DR" | "CR";
          narration?: string | null;
          financial_year?: string;
          import_id?: string | null;
        };
      };
      vendors: {
        Row: {
          id: string;
          name: string;
          gstin: string | null;
          pan: string | null;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          payment_terms_days: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          gstin?: string | null;
          pan?: string | null;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          payment_terms_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          gstin?: string | null;
          pan?: string | null;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          payment_terms_days?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string;
          gstin: string | null;
          pan: string | null;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          credit_limit: number;
          payment_terms_days: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          gstin?: string | null;
          pan?: string | null;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          credit_limit?: number;
          payment_terms_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          gstin?: string | null;
          pan?: string | null;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          credit_limit?: number;
          payment_terms_days?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      compliance_items: {
        Row: {
          id: string;
          category: string;
          title: string;
          description: string | null;
          due_date: string;
          status: "pending" | "filed" | "paid" | "overdue" | "not_applicable";
          financial_year: string;
          period: string | null;
          assigned_to: string | null;
          filed_date: string | null;
          acknowledgement_number: string | null;
          notes: string | null;
          is_recurring: boolean;
          recurrence_rule: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          title: string;
          description?: string | null;
          due_date: string;
          status?: "pending" | "filed" | "paid" | "overdue" | "not_applicable";
          financial_year: string;
          period?: string | null;
          assigned_to?: string | null;
          filed_date?: string | null;
          acknowledgement_number?: string | null;
          notes?: string | null;
          is_recurring?: boolean;
          recurrence_rule?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          title?: string;
          description?: string | null;
          due_date?: string;
          status?: "pending" | "filed" | "paid" | "overdue" | "not_applicable";
          financial_year?: string;
          period?: string | null;
          assigned_to?: string | null;
          filed_date?: string | null;
          acknowledgement_number?: string | null;
          notes?: string | null;
          is_recurring?: boolean;
          recurrence_rule?: string | null;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
          priority: "low" | "medium" | "high" | "urgent";
          assigned_to: string | null;
          assigned_by: string | null;
          due_date: string | null;
          completed_at: string | null;
          compliance_item_id: string | null;
          module: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
          priority?: "low" | "medium" | "high" | "urgent";
          assigned_to?: string | null;
          assigned_by?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          compliance_item_id?: string | null;
          module?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
          priority?: "low" | "medium" | "high" | "urgent";
          assigned_to?: string | null;
          assigned_by?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          compliance_item_id?: string | null;
          module?: string | null;
          updated_at?: string;
        };
      };
      file_imports: {
        Row: {
          id: string;
          file_name: string;
          file_type: "xlsx" | "xls" | "csv" | "pdf";
          module: string;
          uploaded_by: string;
          status: "pending" | "processing" | "completed" | "failed" | "rolled_back";
          rows_imported: number;
          rows_failed: number;
          error_log: string | null;
          financial_year: string;
          can_rollback: boolean;
          rolled_back_at: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          file_name: string;
          file_type: "xlsx" | "xls" | "csv" | "pdf";
          module: string;
          uploaded_by: string;
          status?: "pending" | "processing" | "completed" | "failed" | "rolled_back";
          rows_imported?: number;
          rows_failed?: number;
          error_log?: string | null;
          financial_year: string;
          can_rollback?: boolean;
          rolled_back_at?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          status?: "pending" | "processing" | "completed" | "failed" | "rolled_back";
          rows_imported?: number;
          rows_failed?: number;
          error_log?: string | null;
          can_rollback?: boolean;
          rolled_back_at?: string | null;
          completed_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          table_name: string | null;
          record_id: string | null;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          table_name?: string | null;
          record_id?: string | null;
          old_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
    };
  };
};
