declare module '@cashfreepayments/cashfree-js' {
  interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_modal' | HTMLElement;
  }

  interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<void>;
  }

  export function load(options: {
    mode: 'sandbox' | 'production';
  }): Promise<CashfreeInstance | null>;
}