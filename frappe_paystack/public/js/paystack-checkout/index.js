const isEmail = str => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const { createApp } = Vue

createApp({
  delimiters: ['[%', '%]'],
  data() {
    return {
      id: '',
      payment_data: {},
      gateway: '',
      showDiv: false,
      doc: window.doc,
      isProcessing: false,
      emailError: false,
    }
  },
  methods: {
    payWithPaystack(amount, email){
        let me = this;
        
        if (!amount || amount <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Amount',
                text: 'Please enter a valid payment amount.',
                confirmButtonColor: '#0ba4db'
            });
            return;
        }

        if (!email || !isEmail(email)) {
            this.showEmailError();
            return;
        }

        this.hideEmailError();
        this.setLoading(true);

        let handler = PaystackPop.setup({
            key: me.doc.public_key, 
            amount: amount * 100,
            currency: me.doc.order_currency || 'KES',
            email: email,
            metadata: {
                reference_doctype: me.doc.reference_doctype,
                reference_docname: me.doc.reference_docname,
                customer: me.doc.customer,
                reference: me.doc.reference,
                email: email
            },
            onClose: function(){
                me.setLoading(false);
                Swal.fire({
                    icon: 'warning',
                    title: 'Payment Cancelled',
                    text: 'You cancelled the payment. You can try again anytime.',
                    confirmButtonColor: '#0ba4db'
                });
            },
            callback: function(response){
                me.setLoading(false);
                console.log(response);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Payment Successful!',
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
                                    <span style="font-weight: 600;">${me.doc.order_currency} ${amount.toLocaleString()}</span>
                                </div>
                            </div>
                            <p style="margin-top: 12px; font-size: 13px; color: #718096;">
                                A confirmation will be sent to <strong>${email}</strong> shortly.
                            </p>
                        </div>
                    `,
                    confirmButtonText: 'Done',
                    confirmButtonColor: '#28a745',
                    allowOutsideClick: false
                }).then(() => {
                    window.location.reload();
                });
            }
        });

        handler.openIframe();
    },
    
    initiatePayment() {
        let me = this;
        
        if (me.isProcessing) return;
        
        const emailInput = document.getElementById('payerEmail');
        const amountInput = document.getElementById('payAmount');
        
        let email = emailInput ? emailInput.value.trim() : me.doc.email;
        let amount = amountInput ? parseFloat(amountInput.value) : me.doc.payment_amount;
        
        // Validate email first
        if (!email || !isEmail(email)) {
            me.showEmailError();
            emailInput.focus();
            return;
        }
        
        me.hideEmailError();
        
        // If email was not pre-filled, save it
        if (!me.doc.email) {
            me.doc.email = email;
        }
        
        // Validate amount
        const maxAmount = me.doc.outstanding_amount || me.doc.payment_amount;
        if (amount <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Amount',
                text: 'Please enter a valid payment amount greater than zero.',
                confirmButtonColor: '#0ba4db'
            });
            return;
        }
        
        if (amount > maxAmount) {
            Swal.fire({
                icon: 'warning',
                title: 'Amount Exceeds Balance',
                text: `The amount exceeds your outstanding balance of ${me.doc.order_currency} ${maxAmount.toLocaleString()}.`,
                confirmButtonColor: '#0ba4db'
            });
            return;
        }
        
        // Process payment
        me.payWithPaystack(amount, email);
    },
    
    showEmailError() {
        this.emailError = true;
        const emailInput = document.getElementById('payerEmail');
        const errorDiv = document.getElementById('emailError');
        if (emailInput) emailInput.classList.add('error');
        if (errorDiv) errorDiv.classList.add('visible');
    },
    
    hideEmailError() {
        this.emailError = false;
        const emailInput = document.getElementById('payerEmail');
        const errorDiv = document.getElementById('emailError');
        if (emailInput) emailInput.classList.remove('error');
        if (errorDiv) errorDiv.classList.remove('visible');
    },
    
    setLoading(isLoading) {
        this.isProcessing = isLoading;
        const btn = document.getElementById('paymentBTN');
        if (btn) {
            if (isLoading) {
                btn.classList.add('loading');
                btn.disabled = true;
            } else {
                btn.classList.remove('loading');
                btn.disabled = false;
            }
        }
    },
    
    formatCurrency(amount, currency){
        if(currency){
            return Intl.NumberFormat('en-US', {currency:currency, style:'currency'}).format(amount);
        } else {
            return Intl.NumberFormat('en-US').format(amount);
        }
    }
  },
  mounted(){
    // Auto-validate email on input
    const emailInput = document.getElementById('payerEmail');
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            if (this.emailError && isEmail(emailInput.value.trim())) {
                this.hideEmailError();
            }
        });
    }
    
    // Validate amount on input
    const amountInput = document.getElementById('payAmount');
    if (amountInput) {
        amountInput.addEventListener('input', () => {
            const val = parseFloat(amountInput.value);
            if (val < 0) amountInput.value = 0;
        });
    }
  }
}).mount('#app')

// Global function for onclick
function initiatePayment() {
    const vm = document.querySelector('#app').__vue_app__._instance.proxy;
    if (vm) {
        vm.initiatePayment();
    }
}
