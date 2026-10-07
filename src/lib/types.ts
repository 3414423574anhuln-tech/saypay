export interface PayPalConfiguration {
  clientId: string;
  clientSecret: string;
  appUrl: string;
}
export interface ManualOrder {
  payeeEmail: string;
  amount: string;
  currency: 'USD';
  description: string;
  reference: string;
}
export interface PayPalOrder {
  id: string;
  status: string;
  intent?: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    description?: string;
    payee?: { email_address?: string };
    amount?: { currency_code: string; value: string };
    payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] };
  }[];
}
export interface PayPalService {
  createOrder(order: ManualOrder, signature: string, requestId: string): Promise<PayPalOrder>;
  getOrder(orderId: string): Promise<PayPalOrder>;
  captureOrder(orderId: string, requestId: string): Promise<PayPalOrder>;
}
export interface OrderStatus {
  orderId: string;
  paypalStatus: string;
  completed: boolean;
  transactionId: string | null;
  submitted: ManualOrder;
}
