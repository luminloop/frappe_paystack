const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const state = {
  doc: window.doc || {},
  reference: window.reference || "",
  company: window.company || {},
  isProcessing: false,
};

function showEmailError() {
  document.getElementById("payerEmail")?.classList.add("error");
  document.getElementById("emailError")?.classList.add("visible");
}

function hideEmailError() {
  document.getElementById("payerEmail")?.classList.remove("error");
  document.getElementById("emailError")?.classList.remove("visible");
}

function setLoading(isLoading) {
  state.isProcessing = isLoading;
  const btn = document.getElementById("paymentBTN");
  if (!btn) return;
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
}

function payWithPaystack(amount, email) {
  const handler = PaystackPop.setup({
    key: state.doc.public_key,
    amount: amount * 100,
    currency: state.doc.order_currency || "KES",
    email: email,
    metadata: {
      reference_doctype: state.doc.reference_doctype,
      reference_docname: state.doc.reference_docname,
      customer: state.doc.customer,
      reference: state.doc.reference,
      email: email,
    },
    onClose: function () {
      setLoading(false);
      Swal.fire({
        icon: "warning",
        title: "Payment Cancelled",
        text: "You cancelled the payment. You can try again anytime.",
        confirmButtonColor: "#22c55e",
      });
    },
    callback: function (response) {
      setLoading(false);
      Swal.fire({
        icon: "success",
        title: "Payment Successful!",
        html: `
          <div style="text-align: left; margin-top: 16px;">
            <p style="margin-bottom: 8px;">Your payment has been processed successfully.</p>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #718096;">Transaction Ref:</span>
                <span style="font-weight: 600; font-family: monospace;">${response.reference}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #718096;">Amount Paid:</span>
                <span style="font-weight: 600;">${state.doc.order_currency} ${amount.toLocaleString()}</span>
              </div>
            </div>
            <p style="margin-top: 12px; font-size: 13px; color: #718096;">
              A confirmation will be sent to <strong>${email}</strong> shortly.
            </p>
          </div>
        `,
        confirmButtonText: "Done",
        confirmButtonColor: "#22c55e",
        allowOutsideClick: false,
      }).then(() => {
        window.location.reload();
      });
    },
  });

  handler.openIframe();
}

function initiatePayment() {
  if (state.isProcessing) return;

  const emailInput = document.getElementById("payerEmail");
  const amountInput = document.getElementById("payAmount");

  const email = emailInput ? emailInput.value.trim() : state.doc.email;
  const amount = amountInput ? parseFloat(amountInput.value) : state.doc.payment_amount;

  if (!email || !isEmail(email)) {
    showEmailError();
    emailInput?.focus();
    return;
  }
  hideEmailError();

  if (!state.doc.email) state.doc.email = email;

  const maxAmount = state.doc.outstanding_amount || state.doc.payment_amount;

  if (!amount || amount <= 0) {
    Swal.fire({
      icon: "warning",
      title: "Invalid Amount",
      text: "Please enter a valid payment amount greater than zero.",
      confirmButtonColor: "#22c55e",
    });
    return;
  }

  if (amount > maxAmount) {
    Swal.fire({
      icon: "warning",
      title: "Amount Exceeds Balance",
      text: `The amount exceeds your outstanding balance of ${state.doc.order_currency} ${maxAmount.toLocaleString()}.`,
      confirmButtonColor: "#22c55e",
    });
    return;
  }

  setLoading(true);
  payWithPaystack(amount, email);
}

window.initiatePayment = initiatePayment;

document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("payerEmail");
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      if (isEmail(emailInput.value.trim())) hideEmailError();
    });
  }

  const amountInput = document.getElementById("payAmount");
  if (amountInput) {
    amountInput.addEventListener("input", () => {
      const val = parseFloat(amountInput.value);
      if (val < 0) amountInput.value = 0;
    });
  }
});
