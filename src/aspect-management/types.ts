export type Role = 'owner' | 'developer';
export type TaskType = 'maintenance' | 'development';
export type BillingType = 'retainer' | 'hourly' | 'fixed';

export interface Person {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface PersonWithHours extends Person {
  hoursPreviousWorkday: number;
  hoursThisMonth: number;
  lastReportDate: string | null;
}

export type PersonDraft = Pick<Person, 'name' | 'email' | 'role' | 'active'>;

export interface PersonReports {
  entries: Array<{
    id: number;
    date: string;
    hours: number;
    start: string | null;
    end: string | null;
    taskType: TaskType | null;
    description: string;
    billable: boolean;
    clientName: string | null;
    projectName: string | null;
  }>;
  blockers: Array<{ date: string; body: string }>;
}

export interface Service {
  name: string;
  status: string;
}

export interface Client {
  id: number;
  name: string;
  logoUrl: string | null;
  packageHours: number | null;
  services: Service[];
  nextStep: string | null;
  nextStepDate: string | null;
  billingType: BillingType | null;
  hoursThisMonth: number;
  activeProjects: number;
}

export interface ClientCard extends Omit<Client, 'activeProjects'> {
  projects: Project[];
  openItems: number;
  lastNote: { date: string; body: string; personName: string | null } | null;
}

export type ClientDraft = Pick<Client, 'name' | 'logoUrl' | 'services' | 'nextStep' | 'nextStepDate'> & {
  packageHours: string;
  billingType: BillingType | '';
};

export interface Project {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  hoursBudget: number | null;
  hoursUsed: number;
  dueDate: string | null;
  status: 'active' | 'done';
  amount: number | null;
  /** Null: the client's billing type applies. */
  billingType: BillingType | null;
  clientBillingType: BillingType | null;
  pct: number | null;
  late: boolean;
  lateDays: number;
  over: boolean;
  near: boolean;
}

export interface ProjectDraft {
  clientId: number | '';
  name: string;
  hoursBudget: string;
  dueDate: string;
  status: 'active' | 'done';
  amount: string;
  billingType: BillingType | '';
  quoteId?: number;
}

export interface ReportEntry {
  clientId: number | null;
  projectId: number | null;
  /** 'HH:MM'. Rows sent before start and end existed have neither, only hours. */
  start: string | null;
  end: string | null;
  hours: number;
  taskType: TaskType | null;
  description: string;
  billable: boolean;
}

export interface Report {
  date: string;
  entries: ReportEntry[];
  blocker: string;
  clients: Array<{ id: number; name: string; recent: boolean }>;
  projects: Array<{ id: number; clientId: number; name: string }>;
}

export interface ReportDraft {
  personId: number;
  date: string;
  entries: ReportEntry[];
  blocker: string;
}

export type QuoteStatus = 'preparing' | 'sent' | 'pending' | 'won' | 'lost';

export interface Quote {
  id: number;
  clientId: number;
  clientName: string;
  subject: string;
  amount: number;
  status: QuoteStatus;
  sentDate: string | null;
  lastFollowupDate: string | null;
  closedDate: string | null;
  projectId: number | null;
  ageDays: number;
}

export interface QuoteDraft {
  clientId: number | '';
  subject: string;
  amount: string;
  status: QuoteStatus;
  sentDate: string;
  lastFollowupDate: string;
}

export interface QuotesView {
  open: Quote[];
  openTotal: number;
  closed: Quote[];
}

export interface Alert {
  kind: 'late' | 'over' | 'near' | 'no_report' | 'no_followup' | 'blocker';
  severity: 'action' | 'attention';
  action: string;
  name: string;
  line: string;
  detail?: string;
  target: { type: 'project' | 'person' | 'quote'; id: number };
}

export interface Morning {
  today: string;
  alerts: Alert[];
  clientCount: number;
}

/** One month's hours, summed per developer x client x project x task type. */
export interface MonthHoursRow {
  personId: number;
  personName: string;
  clientId: number | null;
  clientName: string | null;
  projectId: number | null;
  projectName: string | null;
  billingType: BillingType | null;
  taskType: TaskType | null;
  hours: number;
  billableHours: number;
}

export interface MonthHours {
  month: string;
  rows: MonthHoursRow[];
}
