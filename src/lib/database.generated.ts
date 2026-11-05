export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
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
      profiles: {
        Row: {
          display_name: string
          id: string
          role: Database['public']['Enums']['user_role']
        }
        ComputedFields: never
        Insert: {
          display_name: string
          id: string
          role: Database['public']['Enums']['user_role']
        }
        Update: {
          display_name?: string
          id?: string
          role?: Database['public']['Enums']['user_role']
        }
        Relationships: []
      }
      projects: {
        Row: {
          address: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          revision: number
        }
        ComputedFields: never
        Insert: {
          address: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          revision?: number
        }
        Update: {
          address?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          revision?: number
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          actor_id: string
          actor_name: string
          comment: string | null
          created_at: string
          from_status: Database['public']['Enums']['task_status'] | null
          id: number
          task_id: string
          to_status: Database['public']['Enums']['task_status']
        }
        ComputedFields: never
        Insert: {
          actor_id: string
          actor_name: string
          comment?: string | null
          created_at?: string
          from_status?: Database['public']['Enums']['task_status'] | null
          id?: never
          task_id: string
          to_status: Database['public']['Enums']['task_status']
        }
        Update: {
          actor_id?: string
          actor_name?: string
          comment?: string | null
          created_at?: string
          from_status?: Database['public']['Enums']['task_status'] | null
          id?: never
          task_id?: string
          to_status?: Database['public']['Enums']['task_status']
        }
        Relationships: [
          {
            foreignKeyName: 'task_status_history_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_status_history_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string
          assignee_name: string
          author_id: string
          author_name: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          project_id: string
          revision: number
          status: Database['public']['Enums']['task_status']
          title: string
        }
        ComputedFields: never
        Insert: {
          assignee_id: string
          assignee_name: string
          author_id: string
          author_name: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          project_id: string
          revision?: number
          status?: Database['public']['Enums']['task_status']
          title: string
        }
        Update: {
          assignee_id?: string
          assignee_name?: string
          author_id?: string
          author_name?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          project_id?: string
          revision?: number
          status?: Database['public']['Enums']['task_status']
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_task_status: {
        Args: {
          p_comment?: string
          p_expected_status: Database['public']['Enums']['task_status']
          p_target_status: Database['public']['Enums']['task_status']
          p_task_id: string
        }
        Returns: {
          assignee_id: string
          assignee_name: string
          author_id: string
          author_name: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          project_id: string
          revision: number
          status: Database['public']['Enums']['task_status']
          title: string
        }
        SetofOptions: {
          from: '*'
          to: 'tasks'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_project: {
        Args: { p_address: string; p_name: string }
        Returns: {
          address: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          revision: number
        }
        SetofOptions: {
          from: '*'
          to: 'projects'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_task: {
        Args: { p_assignee_id: string; p_description: string; p_project_id: string; p_title: string }
        Returns: {
          assignee_id: string
          assignee_name: string
          author_id: string
          author_name: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          project_id: string
          revision: number
          status: Database['public']['Enums']['task_status']
          title: string
        }
        SetofOptions: {
          from: '*'
          to: 'tasks'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_project: { Args: { p_project_id: string }; Returns: undefined }
      delete_task: { Args: { p_task_id: string }; Returns: undefined }
      update_project: {
        Args: { p_address: string; p_expected_revision: number; p_name: string; p_project_id: string }
        Returns: {
          address: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          revision: number
        }
        SetofOptions: {
          from: '*'
          to: 'projects'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_task: {
        Args: {
          p_assignee_id: string
          p_description: string
          p_expected_revision: number
          p_project_id: string
          p_task_id: string
          p_title: string
        }
        Returns: {
          assignee_id: string
          assignee_name: string
          author_id: string
          author_name: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          project_id: string
          revision: number
          status: Database['public']['Enums']['task_status']
          title: string
        }
        SetofOptions: {
          from: '*'
          to: 'tasks'
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      task_status: 'new' | 'in_progress' | 'review' | 'accepted' | 'rework'
      user_role: 'dispatcher' | 'executor'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      task_status: ['new', 'in_progress', 'review', 'accepted', 'rework'],
      user_role: ['dispatcher', 'executor'],
    },
  },
} as const
