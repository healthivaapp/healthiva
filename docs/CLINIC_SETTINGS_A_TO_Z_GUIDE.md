# Healthiva Clinic Settings — Complete A-to-Z Architecture & Functional Guide

This document is the complete, end-to-end reference for **all 4 Clinic Settings modules** in Healthiva, including their UI workflows, business rules, governance hierarchy, frontend state management, API routes, and Supabase database architecture.

---

## 1. High-Level Architecture & Shared Settings Shell

Healthiva's Clinic Settings are organized into **4 dedicated modules** accessible from the collapsible **Settings** menu in the left navigation sidebar (`apps/web/components/portal-sidebar.tsx`) and the **Clinic Setup Modules** card on the Owner Dashboard (`apps/web/components/dashboards/owner-dashboard.tsx`):

| # | Module Name | Route Path | Frontend Page File | Primary API Routes | Database Tables |
|---|---|---|---|---|---|
| **1** | **Manage Branch** | `/settings/branches` | `apps/web/app/settings/branches/page.tsx` | `/api/branches` | `clinics`, `membership_clinic_scopes` |
| **2** | **Branding & Fees** | `/organization-settings` | `apps/web/app/organization-settings/page.tsx` | `/api/organization-settings`, `/api/organization-settings/upload-logo` | `organizations`, `organization_settings`, Storage (`clinic-assets`) |
| **3** | **Staff & Scopes** | `/settings/staff` | `apps/web/app/settings/staff/page.tsx` | `/api/staff`, `/api/staff/send-email`, `/api/staff/transfer-ownership`, `/api/invite` | `memberships`, `membership_roles`, `membership_clinic_scopes`, `staff_invitations`, `profiles`, `auth.users` |
| **4** | **Role Capabilities** | `/settings/roles` | `apps/web/app/settings/roles/page.tsx` | `/api/roles`, `/api/roles/permissions` | `roles`, `permissions`, `role_permissions`, `organization_role_permissions` |

---

### 1.1 Shared Components & Context (`SettingsLayout`, `OwnerRouteGuard`, `BranchProvider`)

1. **`BranchProvider` (`apps/web/context/branch-context.tsx`)**:
   - Mounted at the root of the application.
   - Calls `GET /api/branches` with the user's Supabase JWT token to resolve:
     - `branches` (scoped branches for regular staff; all clinic branches for Owner/Co-Owner)
     - `activeBranch` (persisted per user in `localStorage` under `healthiva_active_branch_id_<userId>`)
     - `isPrimaryOwner` (`true` only for the clinic founder / current primary owner)
     - `isAdministrator` (`true` for Co-Owners with `org_authority = 'administrator'`)
     - `isOwner` (`true` for both Primary Owner and Co-Owner so both have full administrative UI access)
     - `userRole`, `userPermissions`, `organizationName`, `logoUrl`, `specialty`, and `isSuspended`.
   - **Zero-Flicker Tab Switch Architecture**:
     - Uses `hasHydratedRef` and `hydratedUserIdRef` so `loading = true` is **only** set on the very first initial load (or if a different user logs in).
     - When switching browser tabs or applications, both `visibilitychange` and Supabase's internal `onAuthStateChange('SIGNED_IN' | 'TOKEN_REFRESHED' | 'USER_UPDATED')` run **silently (`isSilent = true`)** in the background without ever showing a full-screen loader or unmounting forms.

2. **`SettingsLayout` (`apps/web/components/settings-layout.tsx`) & `OwnerRouteGuard` (`apps/web/components/owner-route-guard.tsx`)**:
   - Every settings page is wrapped in `<SettingsLayout>`, which wraps the page in `<OwnerRouteGuard>`.
   - During initial hydration (`loading === true`), `<OwnerRouteGuard>` displays `<HealthivaScreenLoader message="Verifying clinic permissions..." />`.
   - Once hydrated, if `!isOwner && !isAdministrator` (i.e., regular Doctor, Receptionist, or Pharmacist with `org_authority = 'none'`), `<OwnerRouteGuard>` blocks access and renders the **"Access Restricted: Owner Only"** screen with a button to return to their portal.

3. **3-Tier Governance Hierarchy across Settings**:
   - **Tier 1 — Primary Owner (`org_authority = 'primary_owner'`, `is_primary_owner = true`)**:
     - Full unrestricted control over all 4 settings modules.
     - Can edit their own Primary Owner profile.
     - Exclusive right to promote/demote **Co-Owners (`administrator`)**, suspend/remove Co-Owners, and **Transfer Primary Ownership** to an active Co-Owner.
   - **Tier 2 — Co-Owner / Administrator (`org_authority = 'administrator'`)**:
     - Full administrative access to all 4 settings modules (can manage branches, update branding/fees/modules, configure role capabilities, and invite/edit/suspend/remove regular operational staff).
     - **Restrictions**:
       - Cannot edit, suspend, or remove the **Primary Owner** (sees a read-only `Protected` lock badge on the Primary Owner row).
       - Cannot edit, suspend, or remove **other Co-Owners** (sees a read-only `Protected` lock badge).
       - On their **own** row in Staff Directory, can only click **`Edit Profile`** (cannot suspend or remove themselves, and cannot alter their own governance authority).
   - **Tier 3 — Operational Staff (`org_authority = 'none'`)**:
     - Assigned a clinical/operational role (`Doctor`, `Receptionist`, `Pharmacist`, or a Custom Role) and scoped to specific branches.
     - Blocked from all `/settings/*` and `/organization-settings` pages by `OwnerRouteGuard` and backend API checks.

---

## 2. Setting 1: Manage Branch (`/settings/branches`)

* **Frontend File**: `apps/web/app/settings/branches/page.tsx`
* **Backend API**: `apps/web/app/api/branches/route.ts`
* **Database Tables**: `public.clinics`, `public.membership_clinic_scopes`

### 2.1 What It Does
Allows the Clinic Owner and Co-Owners to create, edit, activate/deactivate, and switch between multiple physical clinic locations (branches) under the same organization.

### 2.2 UI Components & Features
1. **Top Summary Banner**:
   - Displays total registered branches, count of active branches, and the currently selected **Active Working Branch**.
   - **+ Add New Branch** CTA button in the header.
2. **Branch Cards Grid**:
   - Each branch card displays:
     - **Branch Name** and **Short Code badge** (e.g., `MAIN`, `VESU`, `ADAJAN`).
     - **Primary Main Branch badge** (if `code === 'MAIN'`) and **Currently Selected badge** (if `activeBranch.id === branch.id`).
     - **Status badge**: `Active` (emerald) or `Inactive` (slate/rose).
     - **Address, City, State, Pincode, and Phone Number**.
   - **Card Actions**:
     - **Select as Active Branch**: Switches the topbar's active branch (`setActiveBranch(branch)`) and persists it in `localStorage` under `healthiva_active_branch_id_<userId>`.
     - **Edit Branch (`PencilIcon`)**: Opens the modal pre-populated with the branch's details.
     - **Deactivate / Activate Toggle**: Toggles `is_active` for non-`MAIN` branches.
3. **Add / Edit Branch Modal**:
   - Fields:
     - **Branch Name** (required, e.g., `Helix Care - Adajan Branch`)
     - **Short Branch Code** (required, auto-uppercased & sanitized to `[A-Z0-9_-]`, locked to `MAIN` for the primary branch)
     - **Phone Number** (10-digit validation)
     - **Street Address**, **City**, **State**, **Pincode** (with `autoComplete="off"` and generic healthcare placeholders)
     - **Branch Active Status Checkbox** (locked to `true` for the `MAIN` branch).

### 2.3 Business Rules & Guardrails
1. **Rule 1 — Primary Main Branch Protection (`code === 'MAIN'`)**:
   - The `MAIN` branch can **never** be deactivated (`is_active` is locked to `true`), and its short code `MAIN` cannot be changed.
2. **Rule 2 — Minimum 1 Active Branch**:
   - If only 1 active branch remains, attempting to deactivate it is blocked with: *"Your clinic must have at least one active branch location."*
3. **Rule 3 — Automatic Active Branch Fallback on Deactivation**:
   - If the user deactivates the branch they currently have selected in the topbar, the app automatically switches `activeBranch` to the `MAIN` branch (or the first remaining active branch).
4. **Rule 4 — Automatic Scope Assignment on Creation**:
   - When `POST /api/branches` creates a new row in `public.clinics`, it automatically inserts a row into `public.membership_clinic_scopes` linking the creator's `membership_id` to the new `clinic_id`.
5. **Rule 5 — Duplicate Short Code Prevention**:
   - Database constraint `uq_clinic_org_code` prevents two branches in the same organization from sharing the same short code, returning a friendly error message.

---

## 3. Setting 2: Branding & Fees (`/organization-settings`)

* **Frontend File**: `apps/web/app/organization-settings/page.tsx`
* **Compression Utility**: `apps/web/lib/image-compression.ts`
* **Backend APIs**:
  - `apps/web/app/api/organization-settings/route.ts` (`GET`, `POST`)
  - `apps/web/app/api/organization-settings/upload-logo/route.ts` (`POST`)
* **Database Table & Storage**: `public.organization_settings`, `public.organizations`, Supabase Storage bucket `clinic-assets`

### 3.1 What It Does
Configures the organization's visual identity (logo & prescription print header), standard OPD consultation fees, queue token numbering format, and active clinic modules. It also supports an `?onboarding=true` mode for newly registered clinics.

### 3.2 The 4 Internal Configuration Tabs

#### Tab 1: Branding & Logo (`activeTab === 'branding'`)
1. **In-Browser WebP Logo Compression Pipeline (`compressClinicLogo`)**:
   - When the user selects an image (`PNG`, `JPG`, `WEBP`, `SVG`), the browser loads it into an HTML5 `<canvas>` before uploading.
   - Downscales dimensions proportionally to a maximum of **`400px` width × `150px` height** using high-quality bicubic smoothing (`imageSmoothingQuality = 'high'`).
   - Encodes the canvas to **`image/webp` at `0.8` (80%) quality**, shrinking 5–10 MB camera/designer files down to **~15–30 KB**.
   - Displays a green compression summary badge showing `Original KB → Compressed KB` and final pixel dimensions.
2. **Supabase Storage Upload (`/api/organization-settings/upload-logo`)**:
   - Uploads the compressed WebP binary to Supabase Storage bucket `clinic-assets` at deterministic path `org/<organizationId>/logo.webp` with `upsert: true`.
   - Saves the public URL inside `organization_settings.brand_json.logo_url` and returns a cache-busted URL (`?v=<timestamp>`).
   - Dispatches `window.dispatchEvent(new CustomEvent('healthiva:logo_updated', { detail: { logoUrl } }))` and calls `updateLogoUrl` + `refreshBranches` so the left `PortalSidebar` updates immediately without page reload.
3. **Adaptive Sidebar Logo Rendering (`portal-sidebar.tsx`)**:
   - Measures the uploaded logo's natural aspect ratio (`naturalWidth / naturalHeight`):
     - **Square / Icon Logo (`aspectRatio < 1.4`)**: Renders inside a `44×44px` rounded frame beside the bold Clinic Name and *"CLINIC PORTAL"* subtitle.
     - **Horizontal / Wide Banner Logo (`aspectRatio >= 1.4`)**: Renders full-width (`w-40 h-11`) above the Clinic Name.
4. **Print Header & Live Letterhead Preview**:
   - Configures `printHeader` (stored in `brand_json.print_header`) and renders a live preview of how the logo, clinic name, specialty template, and header appear on printed OPD prescriptions and invoices.

#### Tab 2: Fees & Pricing (`activeTab === 'fees'`)
- Configures 3 standard fee tiers:
  1. **First / New Consultation Fee (`₹`)** (default: `₹300`)
  2. **Follow-up Visit Fee (`₹`)** (default: `₹150`)
  3. **Emergency / Priority Fee (`₹`)** (default: `₹500`)
- **Rupees ⇄ Paise Conversion**:
  - Displayed and edited in **Rupees (`₹`)** in the UI (`consultationFeeRupees`, `followupFeeRupees`, `emergencyFeeRupees`).
  - Converted to **integer Paise (`Math.round(rupees * 100)`)** in `POST /api/organization-settings` and stored in `organization_settings.workflow_json` (`consultation_fee`, `followup_fee`, `emergency_fee`) to prevent floating-point precision errors.

#### Tab 3: Tokens & Queue Rules (`activeTab === 'tokens'`)
- **Token Numbering Format (`tokenStyle`)**:
  - Supports preset patterns (`T-###`, `OPD-###`, `A-###`, `TOKEN-###`) or custom patterns where `###` is replaced with the zero-padded sequence number.
  - Displays a live **Sample Token Sequence Preview** (`T-001 → T-002 → T-003`).
- **Daily Auto-Reset (`resetDaily`)**:
  - Boolean toggle (`workflow_json.reset_daily`) controlling whether token numbers reset back to `001` every morning at midnight.

#### Tab 4: Active Clinic Modules (`activeTab === 'modules'`)
- Toggle cards stored in `organization_settings.modules_json`:
  1. **Reception & Queue Desk (`reception`)**: Front-desk registration and token queue management.
  2. **Billing & Fee Collection (`billing`)**: Invoice generation, UPI/Cash tracking, and receipts.
  3. **WhatsApp Automated Reminders (`whatsapp_reminders`)**: Automated appointment and follow-up notifications.
  4. **In-House Pharmacy & Inventory (`pharmacy`)**: Prescription dispensing counter and stock tracking.
- **Preserving Role Overrides on Save**:
  - When `POST /api/organization-settings` updates `workflow_json`, it merges `existingWorkflow` and preserves `workflow_json.role_overrides` so saving branding or fees never overwrites role permission templates.

---

## 4. Setting 3: Staff & Scopes (`/settings/staff`)

* **Frontend File**: `apps/web/app/settings/staff/page.tsx`
* **Invitation Acceptance Page**: `apps/web/app/invite/accept/page.tsx`
* **Backend APIs**:
  - `apps/web/app/api/staff/route.ts` (`GET`, `POST`, `PUT`, `DELETE`)
  - `apps/web/app/api/staff/send-email/route.ts` (`POST`)
  - `apps/web/app/api/staff/transfer-ownership/route.ts` (`POST`)
  - `apps/web/app/api/invite/route.ts` (`GET`, `POST`)

### 4.1 Directory Tabs, Filters & Skeleton Loading
1. **Two Directory Tabs**:
   - **Active Staff Members (`activeDirectoryTab === 'active'`)**: Lists all active and suspended clinic members (`isInvitation === false`), sorted with Primary Owner first, Co-Owners second, and operational staff by join date.
   - **Pending Invitations (`activeDirectoryTab === 'pending'`)**: Lists all unaccepted invitations (`status === 'pending'`), showing days remaining (`Expires in Xd`) or an `Expired` badge with a 1-click **Renew (7d)** button.
2. **Search & Multi-Filter Bar**:
   - **Search Input**: Filters by full name, 10-digit mobile number, or email address.
   - **Role Filter Dropdown**: Includes `All Roles`, `Owner / Co-Owner` (matches `isOwner`, `isPrimaryOwner`, or `orgAuthority === 'administrator'`), system roles (`Doctor`, `Receptionist`, `Pharmacist`), and any custom clinic roles fetched from `/api/roles`.
   - **Branch Filter Dropdown**: Filters staff by assigned branch ID (Primary Owner and Co-Owners match all branches).
3. **Shimmer Loading (`<StaffTableSkeleton rows={4} />`)**:
   - Renders a 4-row animated skeleton matching the table columns during initial fetch.

---

### 4.2 Governance & Row Actions Permission Matrix

Both the **Desktop Table** and **Mobile Touch Cards** (as well as `PUT /api/staff` and `DELETE /api/staff` on the backend) enforce the following strict governance matrix:

| Target Row in Staff Directory | When Logged in as **Primary Owner** (`isPrimaryOwner = true`) | When Logged in as **Co-Owner** (`orgAuthority = 'administrator'`, `isPrimaryOwner = false`) |
|---|---|---|
| **Primary Owner Row** (`Mohit vora`) | `Edit Profile` button (can update own name, email, mobile) | `Protected` lock badge (no `Edit Profile` button; backend returns `403` if attempted) |
| **Co-Owner's Own Row** (`staff.userId === user.id`) | N/A | `Edit Profile` button only (can update own contact info/default branch; `Suspend`, `Remove`, and `Authority` radio buttons are hidden & blocked on backend) |
| **Another Co-Owner Row** (`orgAuthority = 'administrator'`) | `Transfer Ownership`, `Edit`, `Suspend` / `Reactivate`, `Remove (X)` | `Protected` lock badge (cannot edit, suspend, or remove another Co-Owner; backend returns `403`) |
| **Operational Staff Row** (`Doctor`, `Receptionist`, `Pharmacist`, Custom) | `Edit`, `Suspend` / `Reactivate`, `Remove (X)` | `Edit`, `Suspend` / `Reactivate`, `Remove (X)` |
| **Pending Invitation Row** | `Share`, `Edit`, `Renew (7d)`, `Revoke (X)` | `Share`, `Edit`, `Renew (7d)`, `Revoke (X)` |

---

### 4.3 End-to-End Staff & Co-Owner Invitation Flow

1. **Step 1 — Generating the Invitation (`POST /api/staff`)**:
   - Validates 10-digit mobile number, email, role, and branch selection.
   - **NMC Registration Check**: If the role has `can_prescribe = true` (e.g., `Doctor`) and `visits.sign` is enabled, `doctorRegNo` is required.
   - **Co-Owner Authority**: Only the Primary Owner (`authResult.isPrimaryOwner`) can set `org_authority = 'administrator'`. When `administrator` is selected, all clinic branches are automatically assigned.
   - Generates:
     - `invite_token`: 64-character cryptographic hex token (`crypto.randomBytes(32).toString('hex')`).
     - `auth_code`: 6-character unambiguous uppercase alphanumeric code (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
     - `expires_at`: 7 days from creation.
   - Saves to `public.staff_invitations` and immediately triggers `POST /api/staff/send-email` via Resend (while also opening the **Share Invitation Modal** with WhatsApp share, Email resend, and Copy Link).

2. **Step 2 — Accepting the Invitation (`/invite/accept` & `/api/invite`)**:
   - `GET /api/invite?token=...` validates that the invitation exists, has `status = 'pending'`, and has not expired, returning the clinic's real name, logo, assigned role, `orgAuthority`, assigned branch names, and `requiresAuthCode`.
   - On submit (`POST /api/invite`):
     - Uses `SUPABASE_SERVICE_ROLE_KEY` admin client to bypass RLS safely during onboarding.
     - Verifies the 6-character `auth_code` (case-insensitive) and minimum 6-character password.
     - Creates (or updates if the email already exists in `auth.users`) the Supabase Auth user with `email_confirm: true`.
     - Upserts `public.profiles`, `public.memberships` (preserving `org_authority: 'administrator' | 'none'`), `public.membership_roles`, and `public.membership_clinic_scopes`.
     - Updates `public.staff_invitations` to `status = 'accepted'` and clears `auth_code = null` (keeping `invite_token` intact to satisfy the PostgreSQL `NOT NULL` constraint).
     - Signs the user in via `supabase.auth.signInWithPassword` and redirects to `/dashboard` (for Co-Owner/Owner), `/doctor`, `/reception`, or `/pharmacy`.

---

### 4.4 Editing, Suspending, Reactivating & Removing Staff
1. **Editing Active Staff (`PUT /api/staff`)**:
   - Updates `memberships` (`permission_mode`, `custom_permissions`, `default_clinic_id`, and `org_authority` if Primary Owner).
   - Updates `profiles` (`full_name`, `email`, `mobile`, `doctor_reg_no`) **AND** simultaneously updates `auth.users` email via `adminClient.auth.admin.updateUserById(userId, { email, email_confirm: true })` so the staff member can log in with their updated email immediately.
   - Replaces `membership_roles` and `membership_clinic_scopes`.
2. **Suspending & Reactivating (`PUT /api/staff` with `status: 'suspended' | 'active'`)**:
   - When a staff member or Co-Owner is suspended (`status = 'suspended'`), `/api/branches` returns `{ isSuspended: true }` and `PortalLayout` immediately locks their screen with the **"ACCOUNT ACCESS SUSPENDED — Staff Portal Access Blocked"** view.
   - Clicking **Reactivate** sets `status = 'active'` and restores access immediately.
3. **Removing Staff (`DELETE /api/staff?membershipId=...`)**:
   - Calls the `remove_staff_member` RPC (with manual cascade fallback) to delete `membership_clinic_scopes`, `membership_roles`, and `memberships`.
   - Checks if the user belongs to any other clinic organization (`hasOtherOrgs`). If they have no other clinic memberships, deletes their row in `public.profiles` and deletes their login from `auth.users` (`adminClient.auth.admin.deleteUser(targetUserId)`).

---

### 4.5 Primary Ownership Transfer (`POST /api/staff/transfer-ownership`)
- Available exclusively to the **Primary Owner** on any active **Co-Owner (`org_authority = 'administrator'`)** row.
- Opens the **Transfer Primary Clinic Ownership Modal**:
  1. Requires the Primary Owner to enter their **current account password** (verified on the backend via `signInWithPassword`).
  2. Requires checking the explicit confirmation checkbox acknowledging that they will become a Co-Owner (`Administrator`).
- Executes `transfer_primary_ownership` RPC (with direct fallback):
  1. Updates `organizations.primary_owner_user_id = targetUserId`.
  2. Sets target Co-Owner's membership to `is_primary_owner = true, org_authority = 'primary_owner'`.
  3. Sets former Primary Owner's membership to `is_primary_owner = false, org_authority = 'administrator'`.

---

## 5. Setting 4: Role Capabilities (`/settings/roles`)

* **Frontend File**: `apps/web/app/settings/roles/page.tsx`
* **Master Permissions Library**: `apps/web/lib/permissions.ts`
* **Backend APIs**:
  - `apps/web/app/api/roles/route.ts` (`GET`, `POST`, `DELETE`)
  - `apps/web/app/api/roles/permissions/route.ts` (`GET`, `POST`)
* **Database Tables**: `public.roles`, `public.permissions`, `public.role_permissions`, `public.organization_role_permissions`, `public.organization_settings`

### 5.1 The 11 Canonical Permissions & 5 Categories

| Category | Permission Code | Title | Default System Roles | Security / Invariant Rules |
|---|---|---|---|---|
| **1. Clinical & OPD Consultation** (`clinical`) | `patient.register` | Register & Search Patients | Doctor, Receptionist | Core OPD intake |
| | `queue.manage` | OPD Queue & Token Assignment | Doctor, Receptionist | Token & waiting room control |
| | `visit.read` | View Medical History & Past Visits | Doctor, Receptionist, Pharmacist | Read-only patient clinical history |
| | `visit.write` | Write OPD Consultation Notes | Doctor | Draft vitals, symptoms, notes |
| | `visits.sign` | Sign & Lock Electronic Prescriptions | Doctor | **NMC Invariant**: Locked to `Doctor` (`can_prescribe=true`) + requires `doctor_reg_no` |
| **2. Pharmacy Desk** (`pharmacy`) | `pharmacy.dispense` | Dispense Prescriptions & Counter Stock | Pharmacist | Dispensing counter & inventory |
| **3. Billing & Fee Collections** (`billing`) | `billing.collect` | Collect Consultation Fees & Issue Receipts | Receptionist | Cash/UPI collection & receipts |
| | `billing.refund` | Authorize Invoice Refunds & Cancellations | *(Optional)* | High-Risk financial permission |
| **4. Clinic Analytics & Reports** (`analytics`) | `reports.read` | View Clinic Revenue Reports & Analytics | *(Optional)* | High-Risk financial turnover access |
| **5. Clinic Administration** (`administration`) | `org.manage` | Manage Clinic Configuration & Branding | Owner / Co-Owner only | **Blocked** from all operational & custom roles |
| | `staff.manage` | Manage Staff Members & Role Scopes | Owner / Co-Owner only | High-Risk administrative permission |

---

### 5.2 UI Features & Matrix Layout
1. **Sticky Horizontal Matrix for 3–10+ Roles**:
   - The left **`Capability Details`** column is pinned (`sticky left-0 z-30` with subtle drop shadow) so permission names and descriptions remain visible while scrolling horizontally across many custom roles.
   - Each role header card has a uniform `195px` width, role icon, role badge (`System Role` vs. `Custom Role`), active capability count, and per-role actions.
2. **System Roles vs. Custom Roles**:
   - **3 System Roles (`Doctor`, `Receptionist`, `Pharmacist`)**:
     - Cannot be deleted.
     - Have **Core Capabilities** (recommended defaults) and **Optional Capabilities** that the clinic can toggle on/off.
     - Include a **Restore Blueprint** button to reset the role back to Healthiva's factory defaults (`DEFAULT_ROLE_PERMISSIONS`), a **Discard** button when unsaved edits exist, and an individual **Save** button.
   - **Custom Clinic Roles (e.g., `Nurse`, `Lab Technician`, `Optometrist`)**:
     - Created via the **+ Create Custom Role** modal (Name, Description, Icon selector, and initial capability checkboxes).
     - Automatically have `is_custom = true` and `can_prescribe = false` (`visits.sign` and `org.manage` are stripped/locked).
     - Can be deleted via the **Delete Custom Role (`TrashIcon`)** confirmation modal, which checks that no active staff member or pending invitation is currently assigned to that role before deleting.
3. **Dual-Persistence & Cross-Tab Synchronization**:
   - Saving role permissions (`POST /api/roles/permissions`) persists the updated permission codes to **both**:
     1. `public.organization_role_permissions` (relational junction table linking `organization_id`, `role_id`, `permission_id`), and
     2. `public.organization_settings.workflow_json.role_overrides` (fast JSONB lookup fallback).
   - Writes `localStorage.setItem('healthiva_roles_updated', Date.now().toString())` so if the `/settings/staff` page is open in another browser tab, it automatically reloads the updated role templates.

---

### 5.3 How Effective Permissions Are Resolved at Runtime

When any user logs in or loads `/api/branches` (`apps/web/app/api/branches/route.ts`):
1. **Owner / Co-Owner (`isOwnerOrAdmin === true`)**:
   - Receives all 11 permissions (`ALL_PERMISSIONS`), subject to the NMC prescribing check below.
2. **Staff with `permission_mode === 'custom'`**:
   - Receives the exact array stored in `memberships.custom_permissions`.
3. **Staff with `permission_mode === 'template'` (Role Defaults)**:
   - First checks `public.organization_role_permissions` for clinic-specific role overrides.
   - Next checks `organization_settings.workflow_json.role_overrides`.
   - Falls back to `DEFAULT_ROLE_PERMISSIONS[roleName]`.
4. **NMC Medical Prescribing Invariant (Final Gate)**:
   - For any non-Primary-Owner user, if `!role.can_prescribe` OR `!profile.doctor_reg_no?.trim()`, the `visits.sign` permission is automatically stripped from `userPermissions`.

---

## 6. Database Schema, Triggers & RPC Reference

| Database Object | Type | Purpose |
|---|---|---|
| `public.organizations` | Table | Stores clinic organization identity (`id`, `name`, `slug`, `primary_owner_user_id`, `status`). |
| `public.organization_settings` | Table | Stores `specialty_template`, `brand_json` (`logo_url`, `print_header`), `workflow_json` (fees in paise, `token_style`, `reset_daily`, `role_overrides`), and `modules_json`. |
| `public.clinics` | Table | Stores clinic branches (`id`, `organization_id`, `name`, `code`, `address`, `city`, `state`, `pincode`, `phone`, `is_active`). |
| `public.memberships` | Table | Links `user_id` to `organization_id` with `status` (`active`, `suspended`), `is_primary_owner`, `org_authority` (`primary_owner`, `administrator`, `none`), `permission_mode` (`template`, `custom`), `custom_permissions`, and `default_clinic_id`. |
| `public.membership_roles` | Table | Maps `membership_id` to `role_id`. |
| `public.membership_clinic_scopes` | Table | Maps `membership_id` to allowed `clinic_id` branches. |
| `public.staff_invitations` | Table | Stores pending/accepted invitations (`full_name`, `email`, `mobile`, `role_id`, `branch_ids`, `specialty`, `doctor_reg_no`, `permission_mode`, `custom_permissions`, `org_authority`, `invite_token`, `auth_code`, `status`, `expires_at`). |
| `public.roles` | Table | Stores system roles (`organization_id IS NULL`) and custom clinic roles (`organization_id = <uuid>`, `is_custom = true`, `can_prescribe`). |
| `public.organization_role_permissions` | Table | Stores per-organization customized permission mappings for system and custom roles. |
| `fn_guard_membership_owner_projection` | Trigger Function | Blocks direct tampering with `is_primary_owner` unless `healthiva.rbac_internal_sync = 'on'`, while allowing the Primary Owner or `service_role` to manage `org_authority = 'administrator'`. |
| `get_staff_invitation_details(p_token)` | RPC | Validates a pending invitation token and returns clinic branding, role, branches, and `requiresAuthCode`. |
| `accept_staff_invitation(p_invite_token, p_user_id, p_auth_code)` | RPC | Verifies `auth_code`, confirms user email, upserts profile/membership/roles/scopes, marks invitation `accepted`, and purges `auth_code = NULL`. |
| `get_organization_staff(p_org_id)` | RPC | Returns all active/suspended staff members and pending invitations for the organization in a single query. |
| `remove_staff_member(p_membership_id, p_org_id)` | RPC | Atomically removes a staff member's scopes, roles, and membership, and cleans up their profile if they belong to no other organization. |
| `transfer_primary_ownership(p_org_id, p_initiator_user_id, p_new_primary_owner_user_id)` | RPC | Atomically transfers Primary Ownership to an active Co-Owner (`administrator`) and transitions the former Primary Owner to Co-Owner. |
