declare module 'react-native-razorpay' {
  export type RazorpayOptions = {
    description?: string;
    image?: string;
    currency: string;
    key: string;
    amount: string;
    name: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: {
      color?: string;
    };
  };

  export type RazorpaySuccessResponse = {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
  };

  export default RazorpayCheckout;
}
