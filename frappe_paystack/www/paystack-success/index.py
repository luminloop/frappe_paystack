import frappe
from frappe.utils import fmt_money

PAYMENT_LOG = "Paystack Payment Log"

def get_context(context):
    context.title = "Payment Receipt"
    reference = frappe.form_dict.reference
    
    if not reference:
        context.reference = None
        return context
    
    if frappe.db.exists(PAYMENT_LOG, {"name": reference}):
        doc = frappe.get_doc(PAYMENT_LOG, reference)
        context.doc = doc.get_data()
        context.reference = reference
        
        # Fetch company branding
        company = frappe.get_doc("Company", doc.company)
        context.company = {
            "name": company.company_name,
            "logo": company.company_logo or "",
            "address": company.address or "",
            "phone": company.phone_no or "",
            "email": company.email or "",
        }
    else:
        context.reference = None

    return context
