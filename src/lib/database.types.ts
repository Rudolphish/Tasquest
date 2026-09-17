// このファイルは自動生成される。直接編集しないこと。
// 再生成: npm run gen:types
// 生成元: supabase/migrations/0001_init.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_runs: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          model: string;
          purpose: string;
          status: Database["public"]["Enums"]["ai_run_status"];
          target_on: string;
          prompt_summary: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          model: string;
          purpose: string;
          status: Database["public"]["Enums"]["ai_run_status"];
          target_on: string;
          prompt_summary?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          model?: string;
          purpose?: string;
          status?: Database["public"]["Enums"]["ai_run_status"];
          target_on?: string;
          prompt_summary?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      goal_phases: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          phase_no: number;
          name: string;
          intent: string | null;
          quests_required: number;
          status: Database["public"]["Enums"]["phase_status"];
          edited_by_user: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          phase_no: number;
          name: string;
          intent?: string | null;
          quests_required?: number;
          status?: Database["public"]["Enums"]["phase_status"];
          edited_by_user?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          phase_no?: number;
          name?: string;
          intent?: string | null;
          quests_required?: number;
          status?: Database["public"]["Enums"]["phase_status"];
          edited_by_user?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_phases_goal_id_user_id_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          why: string | null;
          status: Database["public"]["Enums"]["goal_status"];
          active_slot: number | null;
          share_with_external_ai: boolean;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          background: string | null;
          background_updated_at: string | null;
          background_updated_by: Database["public"]["Enums"]["content_author"];
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          why?: string | null;
          status?: Database["public"]["Enums"]["goal_status"];
          active_slot?: number | null;
          share_with_external_ai?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          background?: string | null;
          background_updated_at?: string | null;
          background_updated_by?: Database["public"]["Enums"]["content_author"];
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          why?: string | null;
          status?: Database["public"]["Enums"]["goal_status"];
          active_slot?: number | null;
          share_with_external_ai?: boolean;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          background?: string | null;
          background_updated_at?: string | null;
          background_updated_by?: Database["public"]["Enums"]["content_author"];
        };
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          quest_id: string | null;
          body: string;
          logged_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          quest_id?: string | null;
          body: string;
          logged_on?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          quest_id?: string | null;
          body?: string;
          logged_on?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logs_goal_id_user_id_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "logs_quest_id_user_id_fkey";
            columns: ["quest_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      player: {
        Row: {
          user_id: string;
          display_name: string | null;
          rest_tokens: number;
          rest_tokens_granted_on: string | null;
          current_streak: number;
          longest_streak: number;
          last_logged_on: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          rest_tokens?: number;
          rest_tokens_granted_on?: string | null;
          current_streak?: number;
          longest_streak?: number;
          last_logged_on?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          rest_tokens?: number;
          rest_tokens_granted_on?: string | null;
          current_streak?: number;
          longest_streak?: number;
          last_logged_on?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      quests: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          phase_id: string | null;
          title: string;
          why: string | null;
          effort: Database["public"]["Enums"]["quest_effort"];
          xp_value: number;
          status: Database["public"]["Enums"]["quest_status"];
          due_on: string;
          generated_by: Database["public"]["Enums"]["quest_source"];
          generated_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id: string;
          phase_id?: string | null;
          title: string;
          why?: string | null;
          effort: Database["public"]["Enums"]["quest_effort"];
          status?: Database["public"]["Enums"]["quest_status"];
          due_on: string;
          generated_by?: Database["public"]["Enums"]["quest_source"];
          generated_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string;
          phase_id?: string | null;
          title?: string;
          why?: string | null;
          effort?: Database["public"]["Enums"]["quest_effort"];
          status?: Database["public"]["Enums"]["quest_status"];
          due_on?: string;
          generated_by?: Database["public"]["Enums"]["quest_source"];
          generated_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quests_goal_id_user_id_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "quests_phase_id_user_id_fkey";
            columns: ["phase_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goal_phases";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      retrospectives: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          kind: Database["public"]["Enums"]["retro_kind"];
          status: Database["public"]["Enums"]["retro_status"];
          trigger_quest_ids: string[];
          insight: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          kind: Database["public"]["Enums"]["retro_kind"];
          status?: Database["public"]["Enums"]["retro_status"];
          trigger_quest_ids?: string[];
          insight?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          kind?: Database["public"]["Enums"]["retro_kind"];
          status?: Database["public"]["Enums"]["retro_status"];
          trigger_quest_ids?: string[];
          insight?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retrospectives_goal_id_user_id_fkey";
            columns: ["goal_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "retrospectives_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_events: {
        Row: {
          id: string;
          user_id: string;
          source: Database["public"]["Enums"]["xp_source"];
          quest_id: string | null;
          amount: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: Database["public"]["Enums"]["xp_source"];
          quest_id?: string | null;
          amount: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: Database["public"]["Enums"]["xp_source"];
          quest_id?: string | null;
          amount?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "xp_events_quest_id_user_id_fkey";
            columns: ["quest_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "xp_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      player_progress: {
        Row: {
          user_id: string | null;
          total_xp: number | null;
          level: number | null;
          next_level_xp: number | null;
          current_streak: number | null;
          longest_streak: number | null;
          rest_tokens: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      app_today: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      level_for_xp: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      propose_phases: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      propose_quests: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      record_insight: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      xp_for_level: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      ai_run_status: "succeeded" | "failed" | "partial";
      content_author: "user" | "cowork" | "gemini";
      goal_status: "active" | "backlog" | "done" | "abandoned";
      phase_status: "locked" | "active" | "done";
      quest_effort: "S" | "M" | "L";
      quest_source: "manual" | "cowork" | "gemini";
      quest_status: "open" | "done" | "missed";
      retro_kind: "miss" | "weekly";
      retro_status: "open" | "resolved";
      xp_source: "quest" | "streak_bonus" | "adjustment";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
