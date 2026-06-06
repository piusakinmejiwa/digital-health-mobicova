import api from './client';

// Supply-side organisation (clinic / pharmacy) admin workspace.

export interface SupplyOverview {
  id: string;
  name: string;
  type: string;
  class: string;
  queueCount: number;
  staffCount: number;
}

export interface SupplyQueueItem {
  id: string;
  member_name: string;
  created_at: string;
  // clinic
  reason?: string;
  status?: string;
  scheduled_at?: string | null;
  diagnosis?: string;
  doctor_name?: string;
  gender?: string;
  date_of_birth?: string | null;
  mode?: string;
  // pharmacy
  medication?: string;
  dosage?: string;
  instructions?: string;
  fulfilment_status?: string;
  fulfilment_method?: string;
  delivery_address?: string;
  tracking_ref?: string;
}

export interface SupplyStaff {
  id: string;
  full_name: string;
  email: string;
  role: string;
  specialty: string;
  is_active: boolean;
  is_primary: boolean;
}

export async function getSupplyOverview(): Promise<SupplyOverview> {
  return (await api.get('/supply/overview')).data;
}

export async function getSupplyQueue(): Promise<{ type: string; queue: SupplyQueueItem[] }> {
  return (await api.get('/supply/queue')).data;
}

export async function getSupplyStaff(): Promise<{ staff: SupplyStaff[] }> {
  return (await api.get('/supply/staff')).data;
}

export async function addSupplyStaff(data: {
  fullName: string; email: string; password: string; specialty?: string;
}): Promise<SupplyStaff> {
  return (await api.post('/supply/staff', data)).data;
}

export async function setSupplyStaffActive(id: string, isActive: boolean): Promise<void> {
  await api.patch(`/supply/staff/${id}`, { isActive });
}
