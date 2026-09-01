// C:\Users\devpr\OneDrive\Desktop\Claude\glory-momo\shared\razorpay.js
// Razorpay integration

export async function createRazorpayOrder(amount) {
  // In a real app this would call a server function.
  // For client-side Firebase only (less secure but works without server),
  // you must use standard Razorpay checkout using standard keys.

  return new Promise((resolve, reject) => {
    // We mock the order creation as we don't have a node server generating real orders
    // DO NOT DO THIS IN PRODUCTION IF NOT SECURE - this is a client workaround
    const options = {
      key: "YOUR_RAZORPAY_KEY",
      amount: amount * 100, // Amount in paise
      currency: "INR",
      name: "Glory Momo",
      description: "Momo Order",
      image: "https://example.com/your_logo",
      handler: function (response){
          resolve(response);
      },
      prefill: {
          name: "Customer Name",
          email: "customer@example.com",
          contact: "9999999999"
      },
      theme: {
          color: "#C4441C"
      }
    };

    // Check if Razorpay script is loaded
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp1 = new window.Razorpay(options);
        rzp1.open();
      };
      script.onerror = () => reject(new Error('Razorpay load failed'));
      document.body.appendChild(script);
    } else {
      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    }
  });
}