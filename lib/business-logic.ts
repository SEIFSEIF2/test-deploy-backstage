// Task lifecycle statuses. The first six render as board columns;
// canceled and duplicate are side-states. Everything else this file once
// held (theme constants, tier lists, project kinds) was dead — the live
// sources of truth are the DB enums via supabase/types.ts.
export type TaskStatus =
  | 'backlog'
  | 'unscoped'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'canceled'
  | 'duplicate'
