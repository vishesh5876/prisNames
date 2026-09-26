# PrisNames — Compliance Architecture

> **Relationship**: Authorized reseller under Dynadot / Global Domain Group LLC (GDG)  
> **Registrar**: GDG is the ICANN-accredited sponsoring registrar  
> **PrisNames**: NOT an ICANN-accredited registrar

---

## 1. Reseller Compliance Framework

### 1.1 PrisNames' Position

PrisNames operates as an authorized reseller. It must NOT present itself or Pristine Internet Services as an ICANN-accredited registrar.

**Correct**: "Domains registered through PrisNames are managed by our upstream registrar partner."

**Wrong**: "PrisNames is an ICANN-accredited registrar."

### 1.2 Registrar/ICANN Flow-Down

Certain ICANN and registrar provisions must flow down into PrisNames' customer-facing terms. These include:

- Domain registration agreement terms required by GDG
- Registrant rights and responsibilities (ICANN Registrants' Rights)
- WHOIS data accuracy requirements
- Transfer policies and inter-registrar transfer rules
- Domain expiration and redemption policies
- UDRP (Uniform Domain-Name Dispute-Resolution Policy) provisions
- Required registrant education links/notices

PrisNames' Terms of Service must incorporate or reference these requirements.

---

## 2. Legal Document Versioning

### 2.1 Documents

| Document | Slug | Required | Purpose |
|----------|------|----------|---------|
| Terms of Service | `terms-of-service` | Yes | General platform terms |
| Privacy Policy | `privacy-policy` | Yes | Data collection and usage |
| Domain Registration Agreement | `registration-agreement` | Yes | Domain-specific registrant obligations |
| Acceptable Use Policy | `acceptable-use` | Yes | Abuse prevention, content policies |
| Refund Policy | `refund-policy` | No | Refund conditions and process |
| Cookie Policy | `cookie-policy` | No | Cookie usage disclosure |

### 2.2 Versioning Model

```
legal_documents
    └── legal_document_versions (version string, content_hash, effective_at, is_active)
        └── user_legal_acceptances (who accepted, when, from which IP, for which order/domain)
```

**Rules:**
- Every version has a SHA-256 content hash to prove document content at acceptance time
- Only one version per document is `is_active = true`
- When a new version becomes active, users may be required to re-accept before critical operations
- Acceptance records are immutable — never deleted

### 2.3 Acceptance Recording

```typescript
interface LegalAcceptance {
  userId: string;
  legalDocumentVersionId: string;
  orderId?: string;          // If accepted during checkout
  domain?: string;           // If domain-specific
  ipAddress: string;
  acceptedAt: Date;
}
```

### 2.4 Consent Flow

```
Registration:
    → Accept Terms of Service + Privacy Policy
    → Record acceptance with IP, timestamp

Domain Purchase:
    → Accept Domain Registration Agreement (if not already for current version)
    → Record acceptance linked to order_id

Policy Update:
    → Notify users of updated terms
    → Block sensitive operations until re-acceptance
    → Record new acceptance
```

---

## 3. Abuse System

### 3.1 Architecture

```
ComplianceModule
    ├── AbuseCaseService
    ├── AbuseEvidenceService
    ├── EscalationService
    └── ComplianceReportingService
```

Contact: `abuse@prisnames.com` (architecture prepared, actual email routing configured at deployment).

### 3.2 Abuse Categories

| Category | Description |
|----------|-------------|
| `PHISHING` | Deceptive pages mimicking legitimate services |
| `MALWARE` | Domains distributing malicious software |
| `FINANCIAL_FRAUD` | Fraudulent financial schemes |
| `IMPERSONATION` | Impersonating individuals or organizations |
| `SPAM` | Unsolicited bulk messaging |
| `TRADEMARK` | Trademark infringement |
| `ILLEGAL_CONTENT` | Content violating applicable laws |
| `OTHER` | Uncategorized abuse |

### 3.3 Abuse Case Lifecycle

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
OPEN → UNDER_REVIEW → AWAITING_INFORMATION → ACTION_REQUIRED
                    │                          │
                    │                          ▼
                    │                   ESCALATED_TO_REGISTRAR
                    │                          │
                    ▼                          ▼
              ┌─────────┐             ┌──────────────┐
              │REJECTED │             │  SUSPENDED   │
              └─────────┘             └──────┬───────┘
                                              │
                                              ▼
                                         RESOLVED
```

### 3.4 Abuse Handling Rules

1. **Do NOT automatically suspend** a domain solely because someone submitted a complaint
2. **Review first**: All abuse reports are reviewed by ABUSE or ADMIN staff
3. **Evidence collection**: Support screenshots, URLs, emails, documents
4. **Customer communication**: Notify domain owner when appropriate (unless law enforcement prohibits)
5. **Registrar escalation**: For serious cases, escalate to GDG/Dynadot
6. **Audit trail**: Every action on an abuse case is logged
7. **Suspension**: Only after review confirms violation, via `DomainService.suspend(domainId, { type: 'abuse', reason })`
   - Sets `domains.is_suspended = true`, `suspension_type = 'abuse'`
   - Does NOT change `lifecycle_status` — domain remains ACTIVE but suspended
   - Dynadot: Set registrar hold if needed via `set_reseller_hold`

### 3.5 Domain Suspension

Domain suspension is an **independent operational flag**, not a lifecycle transition (see ORDER_STATE_MACHINE.md §1.6):

```
domains.is_suspended = true
domains.suspension_type = 'abuse' | 'legal' | 'compliance' | 'registrar_hold'
domains.suspension_reason = "Description of why"
domains.suspended_at = timestamp
```

A domain can be simultaneously:
- `lifecycle_status = ACTIVE` AND `is_suspended = true`
- This means: the domain is registered and not expired, but access/resolution is restricted

---

## 4. Compliance Cases

For non-abuse compliance matters: data requests, legal requests, DMCA, UDRP.

### 4.1 Case Types

| Type | Description |
|------|-------------|
| `data_request` | Subject access request, data export |
| `legal_request` | Subpoena, court order, law enforcement request |
| `dmca` | DMCA takedown notice |
| `udrp` | Uniform Domain-Name Dispute-Resolution Policy proceeding |

### 4.2 Legal Request Handling

```
Legal request received
        ↓
ComplianceCaseService.create({ type: 'legal_request' })
        ↓
LegalRequestService.create({
    requestType: 'subpoena' | 'court_order' | 'law_enforcement',
    requestingAuthority,
    responseDeadline
})
        ↓
Admin review
        ↓
If data disclosure required:
    → DataDisclosureService.create({
        userId, domainId, legalRequestId,
        disclosedTo, dataCategories, disclosedBy
    })
    → Audit log: 'compliance.data_disclosed'
    → Data categories tracked (e.g., ['registrant_name', 'email', 'address'])
```

---

## 5. Data Disclosure Tracking

When customer data must be disclosed (court order, law enforcement, ICANN requirement):

```typescript
interface DataDisclosure {
  userId: string;
  domainId?: string;
  legalRequestId?: string;
  disclosedTo: string;           // Authority name
  dataCategories: string[];       // What was disclosed
  disclosedBy: string;            // Admin who authorized
  createdAt: Date;
}
```

All disclosures are permanently recorded and never deleted.

---

## 6. WHOIS/RDAP Requirements

### 6.1 Registrant Data Accuracy

- ICANN requires accurate registrant information for gTLDs
- PrisNames must collect registrant data during domain registration
- Dynadot may trigger WHOIS verification on contact changes (IRTP)
- PrisNames handles `WHOIS_VERIFICATION_REQUIRED` webhook by notifying the user

### 6.2 WHOIS Privacy

- Offered where TLD and provider support it
- Tracked as `domains.privacy_level` (none, partial, full)
- Privacy does NOT exempt registrant from providing accurate underlying data
- Privacy can be overridden by legal/compliance processes

---

## 7. KYC/Contact Verification

Dynadot sends `CONTACT_KYC_REQUIRED` webhook when contact verification is needed for certain TLDs.

```
CONTACT_KYC_REQUIRED webhook
        ↓
Identify affected domain(s) and user
        ↓
Notify user: "Contact verification required for your domain"
        ↓
User completes verification (Dynadot-managed process)
        ↓
CONTACT_KYC_STATUS_CHANGED webhook
        ↓
Update internal contact verification status
        ↓
Audit log: 'compliance.kyc_status_changed'
```

---

## 8. Record Retention

| Data Type | Minimum Retention | Policy |
|-----------|-------------------|--------|
| Domain records | Indefinite (soft-delete) | Required for compliance provenance |
| Orders | Indefinite (soft-delete) | Financial record |
| Payments | Indefinite | Financial record |
| Refunds | Indefinite | Financial record |
| Invoices | Indefinite | Financial/tax record |
| Audit logs | Indefinite | Compliance requirement |
| Abuse cases | Indefinite | Compliance/legal requirement |
| Legal acceptances | Indefinite | Proves consent at time of registration |
| Compliance cases | Indefinite | Legal requirement |
| Data disclosures | Indefinite | Legal requirement |
| Webhook raw payloads | 90 days (encrypted) | Security investigation window |
| Sessions | 90 days after expiration | Security investigation window |
| Email logs | 1 year | Operational |

Soft-delete (`deleted_at`) is used for records that must be retained. Hard deletion requires explicit policy approval.

---

## 9. Marketing Compliance

### 9.1 Permitted Marketing Claims

```
✅ Privacy-focused
✅ Easy to use
✅ Competitive pricing
✅ Secure infrastructure
✅ Modern experience
✅ Domain management
```

### 9.2 Prohibited Marketing Claims

```
❌ 100% anonymous
❌ No logs
❌ Impossible to trace
❌ Authorities cannot access information
❌ Untraceable domains
❌ ICANN-accredited registrar
```

---

## 10. Evidence Preservation

For abuse cases, legal requests, and compliance investigations:

- Evidence is stored immutably once created
- Supported evidence types: screenshots, emails, URLs, documents
- Evidence is linked to abuse_cases or compliance_cases
- Evidence files are stored outside the database (file storage), referenced by path
- Access to evidence is role-restricted (ABUSE, ADMIN, SUPER_ADMIN) and audit-logged
