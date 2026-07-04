// Split by the 2026-07-04 audit: each panel now owns its file. This
// barrel keeps old import paths alive; new code should import the panel
// files directly (DashboardShell's dynamic() calls already do, so each
// panel stays its own chunk).
export { ProjectsPanel } from './ProjectsPanel'
export { UpdatesPanel } from './UpdatesPanel'
export { SettingsPanel } from './SettingsPanel'
