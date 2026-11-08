/** The part of an RTK Query result the billing tables read (owner space and admin) */
export type BillingQuery<T> = { data?: T; isLoading: boolean; error?: unknown };
