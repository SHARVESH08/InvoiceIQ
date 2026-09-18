export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: Json | null
          company_type: Database["public"]["Enums"]["company_type_enum"]
          created_at: string
          gst_type: Database["public"]["Enums"]["gst_type_enum"]
          gstin: string | null
          id: string
          name: string
          state_code: string
        }
        Insert: {
          address?: Json | null
          company_type: Database["public"]["Enums"]["company_type_enum"]
          created_at?: string
          gst_type?: Database["public"]["Enums"]["gst_type_enum"]
          gstin?: string | null
          id?: string
          name: string
          state_code: string
        }
        Update: {
          address?: Json | null
          company_type?: Database["public"]["Enums"]["company_type_enum"]
          created_at?: string
          gst_type?: Database["public"]["Enums"]["gst_type_enum"]
          gstin?: string | null
          id?: string
          name?: string
          state_code?: string
        }
        Relationships: []
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role_enum"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address: Json | null
          company_id: string
          created_at: string
          credit_limit: number
          customer_profile_id: string | null
          customer_type: string
          email: string | null
          gstin: string | null
          id: string
          name: string
          phone: string | null
          shipping_address: Json | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          company_id: string
          created_at?: string
          credit_limit?: number
          customer_profile_id?: string | null
          customer_type?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          phone?: string | null
          shipping_address?: Json | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          company_id?: string
          created_at?: string
          credit_limit?: number
          customer_profile_id?: string | null
          customer_type?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          phone?: string | null
          shipping_address?: Json | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      godowns: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "godowns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gst_period_data: {
        Row: {
          company_id: string
          created_at: string
          data: Json | null
          filed_at: string | null
          fy: string
          id: string
          period: string
          period_type: Database["public"]["Enums"]["gst_period_type_enum"]
          status: Database["public"]["Enums"]["gst_period_status_enum"]
        }
        Insert: {
          company_id: string
          created_at?: string
          data?: Json | null
          filed_at?: string | null
          fy: string
          id?: string
          period: string
          period_type: Database["public"]["Enums"]["gst_period_type_enum"]
          status?: Database["public"]["Enums"]["gst_period_status_enum"]
        }
        Update: {
          company_id?: string
          created_at?: string
          data?: Json | null
          filed_at?: string | null
          fy?: string
          id?: string
          period?: string
          period_type?: Database["public"]["Enums"]["gst_period_type_enum"]
          status?: Database["public"]["Enums"]["gst_period_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "gst_period_data_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          company_id: string
          godown_id: string
          id: string
          product_id: string
          quantity: number
          reorder_level: number
          reserved_qty: number
          updated_at: string
        }
        Insert: {
          company_id: string
          godown_id: string
          id?: string
          product_id: string
          quantity?: number
          reorder_level?: number
          reserved_qty?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          godown_id?: string
          id?: string
          product_id?: string
          quantity?: number
          reorder_level?: number
          reserved_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role_enum"]
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role_enum"]
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          cgst_amount: number
          cgst_rate: number
          company_id: string
          created_at: string
          description: string | null
          discount_percent: number
          hsn_code: string | null
          id: string
          igst_amount: number
          igst_rate: number
          invoice_id: string
          product_id: string | null
          quantity: number
          sgst_amount: number
          sgst_rate: number
          tax_rate: number
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          cgst_amount?: number
          cgst_rate?: number
          company_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          igst_rate?: number
          invoice_id: string
          product_id?: string | null
          quantity?: number
          sgst_amount?: number
          sgst_rate?: number
          tax_rate?: number
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Update: {
          cgst_amount?: number
          cgst_rate?: number
          company_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number
          hsn_code?: string | null
          id?: string
          igst_amount?: number
          igst_rate?: number
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          sgst_amount?: number
          sgst_rate?: number
          tax_rate?: number
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          company_id: string
          fy: string
          last_seq: number
        }
        Insert: {
          company_id: string
          fy: string
          last_seq?: number
        }
        Update: {
          company_id?: string
          fy?: string
          last_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          buyer_state_code: string | null
          cgst_amount: number
          company_id: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_phone: string | null
          discount_amount: number
          doc_type: string
          due_date: string | null
          id: string
          igst_amount: number
          invoice_date: string
          invoice_number: string | null
          invoice_type: Database["public"]["Enums"]["invoice_type_enum"]
          notes: string | null
          paid_amount: number
          payment_link_url: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          pdf_url: string | null
          public_id: string
          reference_invoice_id: string | null
          seller_state_code: string | null
          sgst_amount: number
          state_code: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          taxable_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_state_code?: string | null
          cgst_amount?: number
          company_id: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          discount_amount?: number
          doc_type?: string
          due_date?: string | null
          id?: string
          igst_amount?: number
          invoice_date?: string
          invoice_number?: string | null
          invoice_type?: Database["public"]["Enums"]["invoice_type_enum"]
          notes?: string | null
          paid_amount?: number
          payment_link_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          pdf_url?: string | null
          public_id?: string
          reference_invoice_id?: string | null
          seller_state_code?: string | null
          sgst_amount?: number
          state_code?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          buyer_state_code?: string | null
          cgst_amount?: number
          company_id?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          discount_amount?: number
          doc_type?: string
          due_date?: string | null
          id?: string
          igst_amount?: number
          invoice_date?: string
          invoice_number?: string | null
          invoice_type?: Database["public"]["Enums"]["invoice_type_enum"]
          notes?: string | null
          paid_amount?: number
          payment_link_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          pdf_url?: string | null
          public_id?: string
          reference_invoice_id?: string | null
          seller_state_code?: string | null
          sgst_amount?: number
          state_code?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_reference_invoice_id_fkey"
            columns: ["reference_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          razorpay_payment_id: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
          razorpay_payment_id?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
          razorpay_payment_id?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type_enum"]
          company_id: string
          created_at: string
          godown_id: string | null
          id: string
          is_active: boolean
          product_id: string
          threshold: number | null
          triggered_at: string | null
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type_enum"]
          company_id: string
          created_at?: string
          godown_id?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          threshold?: number | null
          triggered_at?: string | null
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type_enum"]
          company_id?: string
          created_at?: string
          godown_id?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          threshold?: number | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_alerts_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          hsn_code: string | null
          id: string
          name: string
          purchase_price: number
          reorder_level: number
          selling_price: number
          tax_rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          hsn_code?: string | null
          id?: string
          name: string
          purchase_price?: number
          reorder_level?: number
          selling_price?: number
          tax_rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          hsn_code?: string | null
          id?: string
          name?: string
          purchase_price?: number
          reorder_level?: number
          selling_price?: number
          tax_rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string
          id: string
          po_id: string
          product_id: string
          quantity_ordered: number
          quantity_received: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          company_id: string
          id?: string
          po_id: string
          product_id: string
          quantity_ordered?: number
          quantity_received?: number
          total_amount?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          id?: string
          po_id?: string
          product_id?: string
          quantity_ordered?: number
          quantity_received?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          expected_delivery: string | null
          id: string
          po_number: string | null
          status: Database["public"]["Enums"]["po_status_enum"]
          supplier_id: string
          total_amount: number
        }
        Insert: {
          company_id: string
          created_at?: string
          expected_delivery?: string | null
          id?: string
          po_number?: string | null
          status?: Database["public"]["Enums"]["po_status_enum"]
          supplier_id: string
          total_amount?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_delivery?: string | null
          id?: string
          po_number?: string | null
          status?: Database["public"]["Enums"]["po_status_enum"]
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          approved_by: string | null
          company_id: string
          created_at: string
          from_godown_id: string
          id: string
          notes: string | null
          product_id: string
          qty: number
          requested_by: string
          status: string
          to_godown_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          company_id: string
          created_at?: string
          from_godown_id: string
          id?: string
          notes?: string | null
          product_id: string
          qty: number
          requested_by: string
          status?: string
          to_godown_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          company_id?: string
          created_at?: string
          from_godown_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          qty?: number
          requested_by?: string
          status?: string
          to_godown_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_godown_id_fkey"
            columns: ["from_godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_godown_id_fkey"
            columns: ["to_godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: Json | null
          company_id: string
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          name: string
          phone: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          company_id: string
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          phone?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          company_id?: string
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          phone?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          cart: Json | null
          company_id: string
          conversation_id: string | null
          created_at: string
          customer_phone: string
          expires_at: string | null
          id: string
          last_message_at: string | null
          state: string
          status: Database["public"]["Enums"]["wa_session_status_enum"]
        }
        Insert: {
          cart?: Json | null
          company_id: string
          conversation_id?: string | null
          created_at?: string
          customer_phone: string
          expires_at?: string | null
          id?: string
          last_message_at?: string | null
          state?: string
          status?: Database["public"]["Enums"]["wa_session_status_enum"]
        }
        Update: {
          cart?: Json | null
          company_id?: string
          conversation_id?: string | null
          created_at?: string
          customer_phone?: string
          expires_at?: string | null
          id?: string
          last_message_at?: string | null
          state?: string
          status?: Database["public"]["Enums"]["wa_session_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      low_stock_summary: {
        Row: {
          available_qty: number | null
          company_id: string | null
          godown_id: string | null
          godown_name: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reorder_level: number | null
          reserved_qty: number | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_godown_id_fkey"
            columns: ["godown_id"]
            isOneToOne: false
            referencedRelation: "godowns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_transfer: {
        Args: { p_company_id: string; p_transfer_id: string }
        Returns: undefined
      }
      create_invoice_with_items: {
        Args: { p_company_id: string; p_invoice: Json; p_items: Json }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      generate_invoice_number: {
        Args: { p_company_id: string; p_date?: string }
        Returns: string
      }
      get_company_id: { Args: never; Returns: string }
      get_company_role: { Args: never; Returns: string }
      get_indian_fy: { Args: { p_date?: string }; Returns: string }
      mark_invoice_sent: {
        Args: { p_company_id: string; p_invoice_id: string }
        Returns: string
      }
      reject_transfer: {
        Args: { p_company_id: string; p_transfer_id: string }
        Returns: undefined
      }
      reserve_transfer_qty: {
        Args: {
          p_company_id: string
          p_from_godown_id: string
          p_product_id: string
          p_qty: number
          p_transfer_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      alert_type_enum: "low_stock" | "price_change"
      company_type_enum: "OEM" | "Distributor" | "Retailer"
      gst_period_status_enum: "draft" | "ready" | "filed"
      gst_period_type_enum: "GSTR-1" | "GSTR-3B" | "GSTR-9"
      gst_type_enum: "regular" | "composition" | "unregistered"
      invoice_type_enum: "B2B" | "B2CS" | "B2CL"
      payment_method_enum:
        | "cash"
        | "upi"
        | "bank_transfer"
        | "razorpay"
        | "cheque"
      payment_status_enum: "unpaid" | "partial" | "paid"
      po_status_enum: "draft" | "sent" | "partial" | "received" | "cancelled"
      user_role_enum: "admin" | "accountant" | "salesperson" | "ca"
      wa_session_status_enum: "active" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_type_enum: ["low_stock", "price_change"],
      company_type_enum: ["OEM", "Distributor", "Retailer"],
      gst_period_status_enum: ["draft", "ready", "filed"],
      gst_period_type_enum: ["GSTR-1", "GSTR-3B", "GSTR-9"],
      gst_type_enum: ["regular", "composition", "unregistered"],
      invoice_type_enum: ["B2B", "B2CS", "B2CL"],
      payment_method_enum: [
        "cash",
        "upi",
        "bank_transfer",
        "razorpay",
        "cheque",
      ],
      payment_status_enum: ["unpaid", "partial", "paid"],
      po_status_enum: ["draft", "sent", "partial", "received", "cancelled"],
      user_role_enum: ["admin", "accountant", "salesperson", "ca"],
      wa_session_status_enum: ["active", "closed"],
    },
  },
} as const
