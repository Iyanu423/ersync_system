import { createContext, useContext } from 'react';
import type { UserRole } from '../types';

export interface WorkspaceCtx {
  role: UserRole;
  hospitalId: string;
}

export const WorkspaceContext = createContext<WorkspaceCtx>({ role: 'ADMIN', hospitalId: 'hosp_lagos_central' });
export const useWorkspace = () => useContext(WorkspaceContext);
