/**
 * Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_wallets: {
        Row: {
          address: string
          chain: string | null
          circle_wallet_id: string
          created_at: string
          id: string
          label: string
          status: Database["public"]["Enums"]["admin_wallet_status"]
          supported_assets: string[] | null
          updated_at: string
        }
        Insert: {
          address: string
          chain?: string | null
          circle_wallet_id: string
          created_at?: string
          id?: string
          label: string
          status?: Database["public"]["Enums"]["admin_wallet_status"]
          supported_assets?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: string
          chain?: string | null
          circle_wallet_id?: string
          created_at?: string
          id?: string
          label?: string
          status?: Database["public"]["Enums"]["admin_wallet_status"]
          supported_assets?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          credits: number
          id: string
          user_id: string
        }
        Insert: {
          credits?: number
          id?: string
          user_id: string
        }
        Update: {
          credits?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          chain_id: number
          circle_transaction_id: string | null
          created_at: string
          destination_address: string | null
          id: string
          price_usdc: number
          product_id: string
          product_name: string
          quantity: number
          status: Database["public"]["Enums"]["order_status"]
          tx_hash: string | null
          updated_at: string
          user_id: string
          voucher_inventory_id: string | null
          wallet_address: string | null
        }
        Insert: {
          chain_id: number
          circle_transaction_id?: string | null
          created_at?: string
          destination_address?: string | null
          id?: string
          price_usdc: number
          product_id: string
          product_name: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          voucher_inventory_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          chain_id?: number
          circle_transaction_id?: string | null
          created_at?: string
          destination_address?: string | null
          id?: string
          price_usdc?: number
          product_id?: string
          product_name?: string
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          voucher_inventory_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_inventory_id_fkey"
            columns: ["voucher_inventory_id"]
            isOneToOne: false
            referencedRelation: "voucher_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_usdc: number
          stock_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_usdc: number
          stock_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_usdc?: number
          stock_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_usdc: number
          asset: string
          chain: string
          circle_transaction_id: string | null
          created_at: string
          credit_amount: number | null
          destination_address: string | null
          direction: Database["public"]["Enums"]["transaction_direction"] | null
          exchange_rate: number | null
          fee_usdc: number
          id: string
          idempotency_key: string
          metadata: Json | null
          source_wallet_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          tx_hash: string | null
          updated_at: string
          user_id: string | null
          wallet_id: string
        }
        Insert: {
          amount_usdc: number
          asset?: string
          chain: string
          circle_transaction_id?: string | null
          created_at?: string
          credit_amount?: number | null
          destination_address?: string | null
          direction?: Database["public"]["Enums"]["transaction_direction"] | null
          exchange_rate?: number | null
          fee_usdc?: number
          id?: string
          idempotency_key: string
          metadata?: Json | null
          source_wallet_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          tx_hash?: string | null
          updated_at?: string
          user_id?: string | null
          wallet_id: string
        }
        Update: {
          amount_usdc?: number
          asset?: string
          chain?: string
          circle_transaction_id?: string | null
          created_at?: string
          credit_amount?: number | null
          destination_address?: string | null
          direction?: Database["public"]["Enums"]["transaction_direction"] | null
          exchange_rate?: number | null
          fee_usdc?: number
          id?: string
          idempotency_key?: string
          metadata?: Json | null
          source_wallet_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          tx_hash?: string | null
          updated_at?: string
          user_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_source_wallet_id_fkey"
            columns: ["source_wallet_id"]
            isOneToOne: false
            referencedRelation: "admin_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_events: {
        Row: {
          changed_by: string
          created_at: string
          id: number
          new_status: Database["public"]["Enums"]["transaction_status"]
          old_status: Database["public"]["Enums"]["transaction_status"] | null
          transaction_id: string
        }
        Insert: {
          changed_by?: string
          created_at?: string
          id?: number
          new_status: Database["public"]["Enums"]["transaction_status"]
          old_status?: Database["public"]["Enums"]["transaction_status"] | null
          transaction_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: number
          new_status?: Database["public"]["Enums"]["transaction_status"]
          old_status?: Database["public"]["Enums"]["transaction_status"] | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_webhook_events: {
        Row: {
          circle_event_id: string | null
          circle_transaction_id: string | null
          dedupe_hash: string
          id: number
          mapped_status: Database["public"]["Enums"]["transaction_status"] | null
          raw_payload: Json
          received_at: string
          signature_valid: boolean
          transaction_id: string | null
        }
        Insert: {
          circle_event_id?: string | null
          circle_transaction_id?: string | null
          dedupe_hash: string
          id?: number
          mapped_status?: Database["public"]["Enums"]["transaction_status"] | null
          raw_payload: Json
          received_at?: string
          signature_valid?: boolean
          transaction_id?: string | null
        }
        Update: {
          circle_event_id?: string | null
          circle_transaction_id?: string | null
          dedupe_hash?: string
          id?: number
          mapped_status?: Database["public"]["Enums"]["transaction_status"] | null
          raw_payload?: Json
          received_at?: string
          signature_valid?: boolean
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_inventory: {
        Row: {
          assigned_order_id: string | null
          code_ciphertext: string
          code_hash: string
          created_at: string
          id: string
          product_id: string
          status: Database["public"]["Enums"]["voucher_inventory_status"]
          updated_at: string
        }
        Insert: {
          assigned_order_id?: string | null
          code_ciphertext: string
          code_hash: string
          created_at?: string
          id?: string
          product_id: string
          status?: Database["public"]["Enums"]["voucher_inventory_status"]
          updated_at?: string
        }
        Update: {
          assigned_order_id?: string | null
          code_ciphertext?: string
          code_hash?: string
          created_at?: string
          id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["voucher_inventory_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_inventory_assigned_order_id_fkey"
            columns: ["assigned_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_reveal_events: {
        Row: {
          id: string
          ip_hash: string | null
          order_id: string
          revealed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          ip_hash?: string | null
          order_id: string
          revealed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          ip_hash?: string | null
          order_id?: string
          revealed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_reveal_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_exists: {
        Args: {
          user_email: string
        }
        Returns: boolean
      }
      increment_credits: {
        Args: {
          amount_to_add: number
          user_id_to_update: string
        }
        Returns: number
      }
      refresh_product_stock_count: {
        Args: {
          target_product_id: string
        }
        Returns: undefined
      }
      reserve_voucher_inventory: {
        Args: {
          order_id_to_assign: string
          product_id_to_reserve: string
        }
        Returns: string | null
      }
    }
    Enums: {
      admin_wallet_status: "ENABLED" | "DISABLED" | "ARCHIVED"
      order_status:
        | "pending"
        | "paid"
        | "fulfilled"
        | "revealed"
        | "refunded"
        | "failed"
      transaction_direction: "credit" | "debit"
      transaction_status:
        | "pending"
        | "confirmed"
        | "failed"
        | "complete"
      transaction_type:
        | "USER"
        | "ADMIN"
        | "CCTP_APPROVAL"
        | "CCTP_BURN"
        | "CCTP_MINT"
      voucher_inventory_status:
        | "available"
        | "reserved"
        | "revealed"
        | "disabled"
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
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
