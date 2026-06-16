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

export type CrmAccountType   = "super_stockist" | "distributor" | "dealer" | "retailer" | "oem" | "other";
export type CrmAccountStatus = "prospect" | "active" | "dormant" | "lost";
export type CrmLeadStatus    = "new" | "contacted" | "qualified" | "unqualified" | "converted";
export type CrmDealStage     = "new" | "qualified" | "quoted" | "negotiation" | "won" | "lost";
export type CrmActivityType  = "call" | "whatsapp" | "meeting" | "visit" | "email" | "task" | "note";
export type CrmLeadType      = "corporate" | "channel_partner";
export type CrmDripStatus    = "none" | "active" | "done" | "stopped";
export type CrmDripMsgStatus = "pending" | "sent" | "skipped" | "failed" | "cancelled";
export type CrmQuoteStatus   = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type CrmMeetingMode   = "physical" | "zoom" | "phone";
export type CrmMeetingStatus = "scheduled" | "done" | "cancelled" | "no_show";
export type CrmShareType     = "fsr" | "sales_expert" | "ss" | "other";

/** Customer price tier — controls which column of the price list a user sees */
export type PriceTier = "ss" | "dd" | "dealer";

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
          price_tier: PriceTier | null;
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
          price_tier?: PriceTier | null;
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
          price_tier?: PriceTier | null;
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
          tags: string[];
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
          tags?: string[];
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
          tags?: string[];
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
          lead_type: CrmLeadType;
          drip_status: CrmDripStatus;
          drip_started_at: string | null;
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
          tags: string[];
          enquiry_no: string | null;
          enquiry_type: string | null;
          filled_by: string | null;
          sc_name: string | null;
          assigned_name: string | null;
          product_interest: string | null;
          existing_brand: string | null;
          monthly_turnover: string | null;
          investment_amount: string | null;
          priority: string | null;
          external_status: string | null;
          lead_time_days: number | null;
          first_billing_date: string | null;
          first_billing_amount: number | null;
          dream_customer: boolean;
          whatsapp_link: string | null;
          visit_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company?: string | null;
          status?: CrmLeadStatus;
          lead_type?: CrmLeadType;
          drip_status?: CrmDripStatus;
          drip_started_at?: string | null;
          tags?: string[];
          enquiry_no?: string | null;
          enquiry_type?: string | null;
          filled_by?: string | null;
          sc_name?: string | null;
          assigned_name?: string | null;
          product_interest?: string | null;
          existing_brand?: string | null;
          monthly_turnover?: string | null;
          investment_amount?: string | null;
          priority?: string | null;
          external_status?: string | null;
          lead_time_days?: number | null;
          first_billing_date?: string | null;
          first_billing_amount?: number | null;
          dream_customer?: boolean;
          whatsapp_link?: string | null;
          visit_date?: string | null;
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
          lead_type?: CrmLeadType;
          drip_status?: CrmDripStatus;
          drip_started_at?: string | null;
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
          tags?: string[];
          enquiry_no?: string | null;
          enquiry_type?: string | null;
          filled_by?: string | null;
          sc_name?: string | null;
          assigned_name?: string | null;
          product_interest?: string | null;
          existing_brand?: string | null;
          monthly_turnover?: string | null;
          investment_amount?: string | null;
          priority?: string | null;
          external_status?: string | null;
          lead_time_days?: number | null;
          first_billing_date?: string | null;
          first_billing_amount?: number | null;
          dream_customer?: boolean;
          whatsapp_link?: string | null;
          visit_date?: string | null;
          updated_at?: string;
        };
      };
      crm_drip_messages: {
        Row: {
          id: string;
          lead_id: string;
          sequence: CrmLeadType;
          step_no: number;
          channel: string;
          scheduled_for: string;
          body: string;
          status: CrmDripMsgStatus;
          sent_at: string | null;
          error: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          sequence: CrmLeadType;
          step_no: number;
          channel?: string;
          scheduled_for: string;
          body: string;
          status?: CrmDripMsgStatus;
          sent_at?: string | null;
          error?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: CrmDripMsgStatus;
          scheduled_for?: string;
          body?: string;
          sent_at?: string | null;
          error?: string | null;
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
          lost_reason_id: string | null;
          priority: string | null;
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
          lost_reason_id?: string | null;
          priority?: string | null;
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
          lost_reason_id?: string | null;
          priority?: string | null;
          won_at?: string | null;
          lost_at?: string | null;
          source?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      crm_lost_reasons: {
        Row: { id: string; name: string; is_active: boolean; sort_order: number; created_at: string };
        Insert: { id?: string; name: string; is_active?: boolean; sort_order?: number };
        Update: { name?: string; is_active?: boolean; sort_order?: number };
      };
      crm_messages: {
        Row: {
          id: string;
          parent_type: string;
          parent_id: string;
          author_id: string | null;
          kind: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_type: string;
          parent_id: string;
          author_id?: string | null;
          kind?: string;
          body: string;
        };
        Update: { body?: string; kind?: string };
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
      crm_products: {
        Row: {
          id: string;
          name: string;
          sku: string | null;
          category: string | null;
          hsn: string | null;
          unit: string;
          unit_price: number;
          gst_rate: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sku?: string | null;
          category?: string | null;
          hsn?: string | null;
          unit?: string;
          unit_price?: number;
          gst_rate?: number;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          sku?: string | null;
          category?: string | null;
          hsn?: string | null;
          unit?: string;
          unit_price?: number;
          gst_rate?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      crm_quotes: {
        Row: {
          id: string;
          quote_number: string;
          account_id: string | null;
          deal_id: string | null;
          status: CrmQuoteStatus;
          subtotal: number;
          tax_total: number;
          total: number;
          valid_until: string | null;
          notes: string | null;
          terms: string | null;
          owner_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_number: string;
          account_id?: string | null;
          deal_id?: string | null;
          status?: CrmQuoteStatus;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          valid_until?: string | null;
          notes?: string | null;
          terms?: string | null;
          owner_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: CrmQuoteStatus;
          subtotal?: number;
          tax_total?: number;
          total?: number;
          valid_until?: string | null;
          notes?: string | null;
          terms?: string | null;
          updated_at?: string;
        };
      };
      crm_quote_items: {
        Row: {
          id: string;
          quote_id: string;
          product_id: string | null;
          description: string;
          qty: number;
          unit_price: number;
          gst_rate: number;
          line_subtotal: number;
          line_tax: number;
          line_total: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          quote_id: string;
          product_id?: string | null;
          description: string;
          qty?: number;
          unit_price?: number;
          gst_rate?: number;
          line_subtotal?: number;
          line_tax?: number;
          line_total?: number;
          sort_order?: number;
        };
        Update: {
          description?: string;
          qty?: number;
          unit_price?: number;
          gst_rate?: number;
          line_subtotal?: number;
          line_tax?: number;
          line_total?: number;
          sort_order?: number;
        };
      };
      crm_email_templates: {
        Row: {
          id: string;
          name: string;
          subject: string;
          body: string;
          category: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subject: string;
          body: string;
          category?: string | null;
          is_active?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          subject?: string;
          body?: string;
          category?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      crm_meetings: {
        Row: {
          id: string;
          lead_id: string | null;
          account_id: string | null;
          assigned_to: string | null;
          arranged_by: string | null;
          mode: CrmMeetingMode;
          scheduled_at: string;
          location: string | null;
          meeting_link: string | null;
          agenda: string | null;
          conversation_notes: string | null;
          status: CrmMeetingStatus;
          outcome: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          account_id?: string | null;
          assigned_to?: string | null;
          arranged_by?: string | null;
          mode?: CrmMeetingMode;
          scheduled_at: string;
          location?: string | null;
          meeting_link?: string | null;
          agenda?: string | null;
          conversation_notes?: string | null;
          status?: CrmMeetingStatus;
          outcome?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          mode?: CrmMeetingMode;
          scheduled_at?: string;
          location?: string | null;
          meeting_link?: string | null;
          agenda?: string | null;
          conversation_notes?: string | null;
          status?: CrmMeetingStatus;
          outcome?: string | null;
          updated_at?: string;
        };
      };
      crm_lead_shares: {
        Row: {
          id: string;
          lead_id: string;
          share_type: CrmShareType;
          to_user_id: string | null;
          to_account_id: string | null;
          to_name: string | null;
          channel: string;
          message: string | null;
          shared_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          share_type: CrmShareType;
          to_user_id?: string | null;
          to_account_id?: string | null;
          to_name?: string | null;
          channel?: string;
          message?: string | null;
          shared_by?: string | null;
        };
        Update: { message?: string | null };
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
    };
  };
};
