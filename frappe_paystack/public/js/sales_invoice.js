frappe.ui.form.on("Sales Invoice", {
  refresh(frm) {
    if (!frm.doc.company) return;

    const can_pay =
      frm.doc.docstatus === 1 && flt(frm.doc.outstanding_amount || 0) > 0;

    frappe
      .call({
        method: "frappe_paystack.api.is_enabled_for_company",
        args: { company: frm.doc.company },
      })
      .then((r) => {
        const enabled = !!r.message;
        if (!enabled) {
          frm.dashboard.add_comment(
            __("Paystack disabled or not configured"),
            "red",
            true,
          );
          return;
        }

        if (can_pay) {
          frm.dashboard.add_comment(
            __("Paystack enabled. Use the actions below to collect payment."),
            "green",
            true,
          );

          // Pay Now - opens checkout directly
          frm.add_custom_button(
            __("Pay Now"),
            () => {
              make_paystack_link(frm, {
                doctype: frm.doc.doctype,
                docname: frm.doc.name,
                amount: flt(frm.doc.outstanding_amount || 0),
                currency: frm.doc.currency || "NGN",
              });
            },
            __("Paystack"),
          );

          // Send Payment Link via Email
          frm.add_custom_button(
            __("Send Payment Link"),
            () => {
              frappe
                .call("frappe_paystack.utils.get_customer_email", {
                  customer: frm.doc.customer,
                })
                .then((res) => {
                  if (!res.message) {
                    frappe.throw(
                      "Please set customer Email ID in Customer Doctype",
                    );
                  } else {
                    make_paystack_link(
                      frm,
                      {
                        doctype: frm.doc.doctype,
                        docname: frm.doc.name,
                        amount: flt(frm.doc.outstanding_amount || 0),
                        currency: frm.doc.currency || "NGN",
                      },
                      { send: true, email: res.message },
                    );
                  }
                });
            },
            __("Paystack"),
          );

          // Partial Payment
          frm.add_custom_button(
            __("Partial Payment"),
            () => {
              const max_amount = flt(frm.doc.outstanding_amount || 0);
              const partial_dialog = new frappe.ui.Dialog({
                title: __("Partial Payment"),
                fields: [
                  {
                    fieldtype: "HTML",
                    fieldname: "info",
                    options: `
                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <span style="color: #166534; font-size: 13px;">Outstanding Amount</span>
                          <span style="color: #166534; font-weight: 700; font-size: 18px;">${frm.doc.currency} ${max_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    `,
                  },
                  {
                    fieldtype: "Currency",
                    fieldname: "amount",
                    label: __("Payment Amount"),
                    options: frm.doc.currency,
                    reqd: 1,
                    description: __("Enter amount to pay (max: {0})", [max_amount.toLocaleString()]),
                  },
                  {
                    fieldtype: "Select",
                    fieldname: "mode",
                    label: __("Action"),
                    options: ["Pay Now", "Send Payment Link"],
                    default: "Pay Now",
                    reqd: 1,
                  },
                ],
                primary_action_label: __("Continue"),
                primary_action(values) {
                  if (
                    values.amount > 0 &&
                    values.amount <= max_amount
                  ) {
                    if (values.mode === "Pay Now") {
                      make_paystack_link(frm, {
                        doctype: frm.doc.doctype,
                        docname: frm.doc.name,
                        amount: flt(values.amount || 0),
                        currency: frm.doc.currency || "NGN",
                      });
                      partial_dialog.hide();
                    } else {
                      frappe
                        .call("frappe_paystack.utils.get_customer_email", {
                          customer: frm.doc.customer,
                        })
                        .then((res) => {
                          if (!res.message) {
                            frappe.throw(
                              "Please set customer Email ID in Customer Doctype",
                            );
                          } else {
                            make_paystack_link(
                              frm,
                              {
                                doctype: frm.doc.doctype,
                                docname: frm.doc.name,
                                amount: flt(values.amount || 0),
                                currency: frm.doc.currency || "NGN",
                              },
                              { send: true, email: res.message },
                            );
                            partial_dialog.hide();
                          }
                        });
                    }
                  } else {
                    frappe.throw(
                      __("Amount must be greater than 0 and not exceed {0}", [
                        max_amount.toLocaleString(),
                      ])
                    );
                  }
                },
              });
              partial_dialog.show();
            },
            __("Paystack"),
          );
        }
      });
  },
});

function make_paystack_link(frm, { doctype, docname, amount, currency }, opts = {}) {
  const payment_link = () =>
    frappe.call({
      method: "frappe_paystack.api.create_payment_link",
      args: { doctype, docname, amount, currency },
    });

  frappe.show_alert({
    message: __("Generating payment link..."),
    indicator: "blue",
  });

  payment_link()
    .catch((err) => {
      frappe.msgprint({
        title: __("Error"),
        message: __("Could not generate Paystack link. Please try again."),
        indicator: "red",
      });
    })
    .then((res) => {
      const url = res?.message;
      if (!url) {
        frappe.msgprint(__("Could not generate Paystack link."));
        return;
      }

      show_link_dialog(frm, url, opts);
    });
}

function show_link_dialog(frm, url, opts) {
  if (opts && opts.send) {
    prompt_send_email(frm, url, opts);
  } else {
    const d = new frappe.ui.Dialog({
      title: __("Pay via Paystack"),
      size: "large",
      fields: [
        {
          fieldtype: "HTML",
          fieldname: "info",
          options: `
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0ba4db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <h5 style="margin: 0 0 4px 0; color: #0c4a6e;">Payment Link Generated</h5>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Share this link with the customer to collect payment securely</p>
            </div>
          `,
        },
        {
          fieldtype: "Data",
          fieldname: "link",
          label: __("Payment Link"),
          read_only: 1,
          default: url,
          bold: 1,
        },
      ],
      primary_action_label: __("Open Payment Page"),
      primary_action: () => {
        window.open(url, "_blank");
        d.hide();
      },
    });

    d.set_secondary_action_label(__("Copy Link"));
    d.set_secondary_action(() => {
      const val = d.get_value("link");
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(val)
          .then(() =>
            frappe.show_alert({ message: __("Link copied to clipboard!"), indicator: "green" }),
          );
      } else {
        frappe.msgprint(__("Copy this link") + ":<br>" + val);
      }
    });

    d.show();
  }
}

function prompt_send_email(frm, url, opts) {
  const email_dialog = new frappe.ui.Dialog({
    title: __("Send Payment Link"),
    size: "large",
    fields: [
      {
        fieldtype: "HTML",
        fieldname: "info",
        options: `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 13px; color: #166534;">
              <strong>Invoice:</strong> ${frm.doc.name} &nbsp;|&nbsp; 
              <strong>Amount:</strong> ${frm.doc.currency} ${flt(frm.doc.outstanding_amount).toLocaleString()}
            </p>
          </div>
        `,
      },
      {
        fieldtype: "Data",
        fieldname: "to",
        label: __("To (Email)"),
        reqd: 1,
        default: opts.email,
      },
      {
        fieldtype: "Data",
        fieldname: "subject",
        label: __("Subject"),
        default: __("School Fees Payment{0} - Invoice {1}", [
          frm.doc.student_name ? ` for ${frm.doc.student_name}` : "",
          frm.doc.name,
        ]),
      },
      {
        fieldtype: "Small Text",
        fieldname: "message",
        label: __("Message"),
        default:
          __("Dear Parent / Guardian,") +
          "<br><br>" +
          __("This is a reminder to settle the outstanding school fees{0}.", [
            frm.doc.student_name ? ` for <strong>${frm.doc.student_name}</strong>` : "",
          ]) +
          "<br><br>" +
          `<table style="border-collapse: collapse; font-size: 14px; margin: 8px 0;">
             <tr><td style="padding: 4px 12px 4px 0; color: #475569;">${__("Invoice")}</td><td style="padding: 4px 0;"><strong>${frm.doc.name}</strong></td></tr>
             <tr><td style="padding: 4px 12px 4px 0; color: #475569;">${__("Amount Due")}</td><td style="padding: 4px 0;"><strong>${frm.doc.currency} ${flt(frm.doc.outstanding_amount).toLocaleString()}</strong></td></tr>
             ${frm.doc.due_date ? `<tr><td style="padding: 4px 12px 4px 0; color: #475569;">${__("Due Date")}</td><td style="padding: 4px 0;">${frm.doc.due_date}</td></tr>` : ""}
           </table>` +
          "<br>" +
          __("Click the button below to pay securely via Paystack.") +
          "<br><br>" +
          `<a href="${url}" target="_blank" style="display: inline-block; background: #0ba4db; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">${__("Pay School Fees")}</a>` +
          "<br><br>" +
          __("If the button does not work, copy and paste this link into your browser:") +
          "<br>" +
          `<code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${url}</code>` +
          "<br><br>" +
          __("If you have already paid, please ignore this message.") +
          "<br><br>" +
          __("Thank you,") +
          "<br>" +
          __("The School Administration"),
      },
    ],
    primary_action_label: __("Send Email"),
    primary_action(values) {
      frappe
        .call({
          method: "frappe.core.doctype.communication.email.make",
          args: {
            recipients: values.to,
            subject: values.subject,
            content: values.message,
            doctype: frm.doc.doctype,
            name: frm.doc.name,
            send_email: 1,
          },
        })
        .then(() => {
          frappe.show_alert({ message: __("Payment link email sent successfully"), indicator: "green" });
          email_dialog.hide();
        });
    },
  });
  email_dialog.show();
}
