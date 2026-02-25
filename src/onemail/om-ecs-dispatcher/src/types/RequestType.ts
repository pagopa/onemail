export type AsStringQuery<T> = {
  [K in keyof T]: null extends T[K] ? string | null : string;
};
