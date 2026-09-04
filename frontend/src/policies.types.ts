export type PolicyRoute = {
  title: string;
  eyebrow: string;
  summary: string;
  sections: ReadonlyArray<{ readonly heading: string; readonly body: string }>;
};
