export type Cart = {
  quantities: Record<string, number>;
  artwork?: Record<string, string>;
  requestId: string;
};
