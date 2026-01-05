declare module "@cashfreepayments/cashfree-js" {
  interface CashfreeConfig {
    mode: "sandbox" | "production";
  }

  interface CheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_parent" | "_top";
  }

  interface Cashfree {
    checkout(options: CheckoutOptions): Promise<any>;
  }

  export function load(config: CashfreeConfig): Promise<Cashfree>;
}
