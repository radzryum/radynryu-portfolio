import { createContext } from 'react'

// Carries the branch-switch request from the header BranchSwitcher up to
// StaffLayout (which owns the overlay + workspace remount). A direct
// context call — never a window event — so the request cannot get lost
// between the dropdown and the layout.
export const BranchSwitchContext = createContext(null)
