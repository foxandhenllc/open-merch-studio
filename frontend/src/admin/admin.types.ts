export type StoreValues = {
  imageModel: string;
  dailyAiBudgetCents: number;
  perSessionBudgetCents: number;
  freeDraftLimit: number;
};
export type SettingsSnapshot = {
  values: StoreValues;
  revision: number;
  storage: 'database' | 'fixture';
};
export type ConnectionField = {
  key: string;
  label: string;
  secret?: boolean;
  options?: string[];
  hint?: string;
  configured: boolean;
  selection?: string;
};
export type Connection = {
  id: string;
  name: string;
  purpose: string;
  accountUrl: string;
  fields: ConnectionField[];
};
export type AdminSetup = {
  content?: { empty: boolean };
  store: { name: string; url: string; supportEmail: string };
  settings: SettingsSnapshot | null;
  models: Array<{ id: string; name: string; description: string; transparent: boolean }>;
  connections: Connection[];
  hosting: { available: boolean; redeployAvailable: boolean; pending: boolean; status: string };
  commerce: {
    checkoutAccessMode: string;
    paymentsAuthorized: boolean;
    fulfillmentAuthorized: boolean;
    autoConfirm: boolean;
  };
};
export type AdminSection =
  | 'overview'
  | 'orders'
  | 'artwork'
  | 'connections'
  | 'installation'
  | 'profile'
  | 'collections';
export type AdminRequest = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
export type AdminBinaryRequest = (path: string) => Promise<Blob>;
export type ConnectionFormProps = {
  connection: Connection;
  available: boolean;
  busy: boolean;
  save: (id: string, values: Record<string, string>) => Promise<boolean>;
};
