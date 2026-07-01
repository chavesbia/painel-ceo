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
      imports: {
        Row: {
          created_at: string
          filename: string
          id: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          notes: string | null
          rows_imported: number
          rows_skipped: number
          rows_total: number
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          kind: Database["public"]["Enums"]["invoice_kind"]
          notes?: string | null
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          kind?: Database["public"]["Enums"]["invoice_kind"]
          notes?: string | null
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          centro_custos: string | null
          conta_bancaria: string | null
          created_at: string
          criado_por: string | null
          data_cadastro: string | null
          data_competencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          entidade: string | null
          entidade_doc: string | null
          forma_pagamento: string | null
          id: string
          import_id: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          numero: string
          numero_nota: string | null
          origem: string | null
          plano_contas: string | null
          situacao: string | null
          total_fatura: number | null
          unidade_negocio: string | null
          updated_at: string
          valor_pago: number
          valor_parcela: number
        }
        Insert: {
          centro_custos?: string | null
          conta_bancaria?: string | null
          created_at?: string
          criado_por?: string | null
          data_cadastro?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entidade?: string | null
          entidade_doc?: string | null
          forma_pagamento?: string | null
          id?: string
          import_id?: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          numero: string
          numero_nota?: string | null
          origem?: string | null
          plano_contas?: string | null
          situacao?: string | null
          total_fatura?: number | null
          unidade_negocio?: string | null
          updated_at?: string
          valor_pago?: number
          valor_parcela?: number
        }
        Update: {
          centro_custos?: string | null
          conta_bancaria?: string | null
          created_at?: string
          criado_por?: string | null
          data_cadastro?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entidade?: string | null
          entidade_doc?: string | null
          forma_pagamento?: string | null
          id?: string
          import_id?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          numero?: string
          numero_nota?: string | null
          origem?: string | null
          plano_contas?: string | null
          situacao?: string | null
          total_fatura?: number | null
          unidade_negocio?: string | null
          updated_at?: string
          valor_pago?: number
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      invoice_kind: "receivable" | "payable"
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
      invoice_kind: ["receivable", "payable"],
    },
  },
} as const
