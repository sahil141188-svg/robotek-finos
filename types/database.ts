/** Roles available in the UI. Bug #6 fix: added "coo" which exists in DB enum. */
export type UserRole = "ceo" | "cfo" | "coo" | "accounts" | "ca";

/** CRM department — which sales team owns a record */
export type CrmDepartment = "crr" | "nbd";

/** Sales-team role, layered on top of the finance UserRole (nullable per user) */
export type CrmTeamRole =
  | "lead_gen"
  | "sales_coordinator"
  | "sales_expert"
  | "crm"
  | "fsr"
  | "sales_head";

export type CrmAccountType   = "dealer" | "distributor" | "retailer" | "oem" | "other";
export type CrmAccountStatus = "prospect" | "active" | "dormant" | "lost";
export type CrmLeadStatus    = "new" | "contacted" | "qualified" | "unqualified" | "converted";
export type CrmDealStage     = "new" | "qualified" | "quoted" | "negotiation" | "won" | "lost";
export type CrmActivityType  = "call" | "whatsapp" | "meeting" | "visit" | "email" | "task" | "note";

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
  view_crm:        boolean;  // CRM module — view leads, pipeline, accounts
  manage_crm:      boolean;  // CRM module — create/edit leads, deals, accounts
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
          crm_department: CrmDepartment | null;
          crm_team_role: CrmTeamRole | null;
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
          crm_department?: CrmDepartment | null;
          crm_team_role?: CrmTeamRole | null;
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
          crm_department?: CrmDepartment | null;
          crm_team_role?: CrmTeamRole | null;
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
          company_id: string;
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
          company_id?: string;
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
          company_id?: string;
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
          company_id: string;
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
          company_id?: string;
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
          company_id?: string;
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
          company_id: string;
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
          company_id?: string;
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
          company_id?: string;
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
          company_id: string;
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
          company_id?: string;
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
          company_id?: string;
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
          company_id: string;
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
          company_id?: string;
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
          company_id?: string;
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
          company_id: string | null;
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
          company_id?: string | null;
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
          company_id?: string | null;
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
      // ── AI Sales Coordinator (Module 9) — sales_* namespace ──
      sales_customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          segment: string | null;
          first_order_at: string | null;
          last_order_at: string | null;
          total_orders: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          segment?: string | null;
          first_order_at?: string | null;
          last_order_at?: string | null;
          total_orders?: number;
          notes?: string | null;
        };
        Update: {
          name?: string;
          phone?: string | null;
          segment?: string | null;
          first_order_at?: string | null;
          last_order_at?: string | null;
          total_orders?: number;
          notes?: string | null;
          updated_at?: string;
        };
      };
      sales_products: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          is_breakeven: boolean;
          monthly_target_qty: number | null;
          total_qty_sold: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          is_breakeven?: boolean;
          monthly_target_qty?: number | null;
          total_qty_sold?: number;
        };
        Update: {
          name?: string;
          category?: string | null;
          is_breakeven?: boolean;
          monthly_target_qty?: number | null;
          total_qty_sold?: number;
          updated_at?: string;
        };
      };
      sales_orders: {
        Row: {
          id: string;
          order_no: string;
          customer_id: string;
          ordered_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_no: string;
          customer_id: string;
          ordered_at: string;
          source?: string;
        };
        Update: {
          order_no?: string;
          customer_id?: string;
          ordered_at?: string;
          source?: string;
        };
      };
      sales_order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          qty: number;
          stock_at_order: number | null;
          remarks: string | null;
          raw_item_name: string | null;
          line_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          qty: number;
          stock_at_order?: number | null;
          remarks?: string | null;
          raw_item_name?: string | null;
          line_hash: string;
        };
        Update: {
          qty?: number;
          stock_at_order?: number | null;
          remarks?: string | null;
          raw_item_name?: string | null;
        };
      };
      sales_customer_item_targets: {
        Row: {
          id: string;
          customer_id: string;
          product_id: string;
          monthly_target_qty: number;
          avg_monthly_qty: number | null;
          months_active: number;
          total_qty: number;
          last_qty: number | null;
          last_ordered_at: string | null;
          is_focus: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          product_id: string;
          monthly_target_qty: number;
          avg_monthly_qty?: number | null;
          months_active?: number;
          total_qty?: number;
          last_qty?: number | null;
          last_ordered_at?: string | null;
          is_focus?: boolean;
        };
        Update: {
          monthly_target_qty?: number;
          avg_monthly_qty?: number | null;
          months_active?: number;
          total_qty?: number;
          last_qty?: number | null;
          last_ordered_at?: string | null;
          is_focus?: boolean;
          updated_at?: string;
        };
      };
      crm_accounts: {
        Row: {
          id: string;
          name: string;
          type: CrmAccountType;
          department: CrmDepartment;
          status: CrmAccountStatus;
          owner_id: string | null;
          gstin: string | null;
          phone: string | null;
          email: string | null;
          city: string | null;
          state: string | null;
          address: string | null;
          notes: string | null;
          handed_off_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: CrmAccountType;
          department?: CrmDepartment;
          status?: CrmAccountStatus;
          owner_id?: string | null;
          gstin?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          state?: string | null;
          address?: string | null;
          notes?: string | null;
          handed_off_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          type?: CrmAccountType;
          department?: CrmDepartment;
          status?: CrmAccountStatus;
          owner_id?: string | null;
          gstin?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          state?: string | null;
          address?: string | null;
          notes?: string | null;
          handed_off_at?: string | null;
          updated_at?: string;
        };
      };
      crm_contacts: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          designation: string | null;
          phone: string | null;
          email: string | null;
          is_primary: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          designation?: string | null;
          phone?: string | null;
          email?: string | null;
          is_primary?: boolean;
          notes?: string | null;
        };
        Update: {
          account_id?: string;
          name?: string;
          designation?: string | null;
          phone?: string | null;
          email?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
      };
      crm_leads: {
        Row: {
          id: string;
          name: string;
          company: string | null;
          status: CrmLeadStatus;
          source: string | null;
          phone: string | null;
          email: string | null;
          city: string | null;
          state: string | null;
          est_value: number;
          assigned_to: string | null;
          notes: string | null;
          converted_account_id: string | null;
          converted_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company?: string | null;
          status?: CrmLeadStatus;
          source?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          state?: string | null;
          est_value?: number;
          assigned_to?: string | null;
          notes?: string | null;
          converted_account_id?: string | null;
          converted_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          company?: string | null;
          status?: CrmLeadStatus;
          source?: string | null;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          state?: string | null;
          est_value?: number;
          assigned_to?: string | null;
          notes?: string | null;
          converted_account_id?: string | null;
          converted_at?: string | null;
          updated_at?: string;
        };
      };
      crm_deals: {
        Row: {
          id: string;
          title: string;
          account_id: string | null;
          department: CrmDepartment;
          stage: CrmDealStage;
          value: number;
          probability: number;
          owner_id: string | null;
          expected_close: string | null;
          lost_reason: string | null;
          won_at: string | null;
          lost_at: string | null;
          source: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          account_id?: string | null;
          department?: CrmDepartment;
          stage?: CrmDealStage;
          value?: number;
          probability?: number;
          owner_id?: string | null;
          expected_close?: string | null;
          lost_reason?: string | null;
          won_at?: string | null;
          lost_at?: string | null;
          source?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          account_id?: string | null;
          department?: CrmDepartment;
          stage?: CrmDealStage;
          value?: number;
          probability?: number;
          owner_id?: string | null;
          expected_close?: string | null;
          lost_reason?: string | null;
          won_at?: string | null;
          lost_at?: string | null;
          source?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      crm_activities: {
        Row: {
          id: string;
          type: CrmActivityType;
          subject: string;
          body: string | null;
          due_at: string | null;
          done: boolean;
          done_at: string | null;
          owner_id: string | null;
          account_id: string | null;
          lead_id: string | null;
          deal_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type?: CrmActivityType;
          subject: string;
          body?: string | null;
          due_at?: string | null;
          done?: boolean;
          done_at?: string | null;
          owner_id?: string | null;
          account_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          type?: CrmActivityType;
          subject?: string;
          body?: string | null;
          due_at?: string | null;
          done?: boolean;
          done_at?: string | null;
          owner_id?: string | null;
          account_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
    };
  };
};
