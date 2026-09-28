'use client';

import React, { useState, useEffect } from 'react';
import { SettingsLayout } from '../../../components/settings-layout';
import { useBranch, Branch } from '../../../context/branch-context';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import {
  CheckCircleIcon,
  PhoneIcon,
  XIcon,
  PlusIcon,
  PencilIcon,
  AlertTriangleIcon,
} from '../../../components/icons';

export default function BranchesSettingsPage() {
  const { branches, activeBranch, setActiveBranch, refreshBranches } = useBranch();
  const [user, setUser] = useState<any>(null);

  // Modal & Async Loading State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const u = await getCurrentUser();
      setUser(u);
    }
    loadUser();
  }, []);

  const openAddModal = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchCode('');
    setAddress('');
    setPhone('');
    setCity('');
    setStateName('');
    setPincode('');
    setIsActive(true);
    setErrorMessage(null);
    setModalErrorMessage(null);
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchName(branch.name || '');
    setBranchCode(branch.code || '');
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setCity(branch.city || '');
    setStateName((branch as any).state || '');
    setPincode((branch as any).pincode || '');
    setIsActive(branch.is_active ?? true);
    setErrorMessage(null);
    setModalErrorMessage(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (branch: Branch) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Rule 1: Main branch can NEVER be deactivated anywhere
    if (branch.code === 'MAIN') {
      setErrorMessage('The Primary Main Branch location cannot be deactivated.');
      return;
    }

    const activeCount = branches.filter((b) => b.is_active).length;
    if (branch.is_active && activeCount <= 1) {
      setErrorMessage('Your clinic must have at least one active branch location.');
      return;
    }

    try {
      setTogglingBranchId(branch.id);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      const res = await fetch('/api/branches', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: branch.id,
          is_active: !branch.is_active,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to update branch status.');
      } else {
        setSuccessMessage(`Branch ${branch.is_active ? 'deactivated' : 'activated'} successfully.`);
        
        // If the deactivated branch was currently selected as active in the topbar, switch active branch to MAIN or first active
        if (branch.is_active && activeBranch?.id === branch.id) {
          const remainingActive = branches.filter(b => b.id !== branch.id && b.is_active);
          const mainOrFirst = remainingActive.find(b => b.code === 'MAIN') || remainingActive[0];
          if (mainOrFirst) {
            setActiveBranch(mainOrFirst);
          }
        }

        await refreshBranches();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating branch status.');
    } finally {
      setTogglingBranchId(null);
    }
  };

  // Strict Form Field Validation
  const validateForm = (): string | null => {
    const trimmedName = branchName.trim();
    if (!trimmedName || trimmedName.length < 3) {
      return 'Branch Name is required and must be at least 3 characters long.';
    }

    const trimmedCode = branchCode.trim();
    if (!trimmedCode || trimmedCode.length < 2) {
      return 'Branch Short Code is required (minimum 2 characters, e.g. MAIN or ADJ).';
    }

    // Phone Validation (Optional, but if entered MUST be exactly 10 digits)
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (phone.trim() && cleanPhone.length !== 10) {
      return 'Please enter a valid 10-digit mobile/contact phone number.';
    }

    // Pincode Validation (Optional, but if entered must be 6 digits)
    if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      return 'Please enter a valid 6-digit Indian PIN Code (e.g. 395004).';
    }

    // City & State Validation
    if (city.trim() && /[\d!@#$%^&*()_+={}\[\]:;<>?,./]/.test(city.trim())) {
      return 'City name should only contain letters and spaces.';
    }

    if (stateName.trim() && /[\d!@#$%^&*()_+={}\[\]:;<>?,./]/.test(stateName.trim())) {
      return 'State name should only contain letters and spaces.';
    }

    return null;
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Rule: Deactivated branch cannot be updated
    if (editingBranch && !editingBranch.is_active) {
      setModalErrorMessage('This branch is currently deactivated. Please activate the branch first to update its details.');
      return;
    }

    // Strict Client Validation Check
    const validationError = validateForm();
    if (validationError) {
      setModalErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }

      const method = editingBranch ? 'PUT' : 'POST';
      const payload: any = {
        name: branchName.trim(),
        code: editingBranch?.code === 'MAIN' ? 'MAIN' : branchCode.trim().toUpperCase(),
        address: address.trim() || null,
        phone: phone.trim() ? phone.trim().replace(/[^0-9+ ]/g, '') : null,
        city: city.trim() || null,
        state: stateName.trim() || null,
        pincode: pincode.trim() || null,
        is_active: editingBranch?.code === 'MAIN' ? true : isActive,
      };

      if (editingBranch) {
        payload.id = editingBranch.id;
      }

      const res = await fetch('/api/branches', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setModalErrorMessage(data.error || 'Failed to save branch. Please check inputs.');
        return;
      }

      setSuccessMessage(
        editingBranch
          ? 'Branch details updated successfully!'
          : 'New branch added successfully!'
      );
      setModalOpen(false);
      await refreshBranches();
    } catch (err: any) {
      setModalErrorMessage(err?.message || 'Error saving branch. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout
      user={user}
      activeTab="branches"
      title="Hospital & Clinic Branches"
      description="Manage branch locations. Each branch has its own address, city, state, pincode, reception queue, contact numbers, and scoped staff."
      action={
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-none shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add New Branch</span>
        </button>
      }
    >

      {/* Page Alert Banners */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch: Branch) => {
          const isCurrent = branch.id === activeBranch?.id;
          const isMain = branch.code === 'MAIN';
          const isToggling = togglingBranchId === branch.id;
          const branchState = (branch as any).state || 'Gujarat';
          const branchPincode = (branch as any).pincode || '';

          return (
            <div
              key={branch.id}
              className={`bg-white rounded-2xl border transition-all p-6 flex flex-col justify-between ${
                isCurrent
                  ? 'border-[#009fe3] ring-2 ring-[#009fe3]/15 shadow-sm'
                  : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div>
                {/* Top Tag & Status Button */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {branch.code}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    {/* Clean Inline Active / Deactive Badge Button with Loading Spinner */}
                    <button
                      onClick={() => handleToggleStatus(branch)}
                      disabled={isMain || isToggling}
                      title={isMain ? 'Primary Main Branch cannot be deactivated' : branch.is_active ? 'Click to Deactivate Branch' : 'Click to Activate Branch'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        isMain
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed opacity-90'
                          : branch.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 hover:bg-emerald-100/80 cursor-pointer'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/90 hover:bg-rose-100/80 cursor-pointer'
                      } ${isToggling ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {isToggling ? (
                        <>
                          <svg className="animate-spin w-3 h-3 text-current shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${branch.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <span>{branch.is_active ? 'Active' : 'Deactivated'}</span>
                        </>
                      )}
                    </button>

                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-[#009fe3] border border-sky-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#009fe3] animate-pulse" />
                        Current
                      </span>
                    )}
                  </div>
                </div>

                {/* Branch Name */}
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {branch.name}
                </h3>

                {/* Address, City, State & Pincode */}
                <div className="text-xs text-slate-500 leading-relaxed mb-4 min-h-[36px]">
                  {branch.address ? (
                    <span>
                      {branch.address}, {branch.city || 'Surat'}, {branchState} {branchPincode ? `- ${branchPincode}` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">No street address configured</span>
                  )}
                </div>

                {/* Contact Phone */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-600 flex items-center gap-2 mb-6">
                  <PhoneIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium">
                    {branch.phone || 'No phone number'}
                  </span>
                </div>
              </div>

              {/* Card Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openEditModal(branch)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PencilIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit Details</span>
                </button>

                {!isCurrent && branch.is_active && (
                  <button
                    onClick={() => setActiveBranch(branch)}
                    className="text-xs font-bold text-[#009fe3] hover:text-[#008bc7] px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer"
                  >
                    Set as Active →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Fixed Header */}
            <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editingBranch ? 'Edit Branch Details' : 'Add New Branch Location'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-4 flex-1">
              
              {/* Modal In-App Error Banner */}
              {modalErrorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalErrorMessage}</span>
                </div>
              )}

              {/* Top Warning Banner if branch is deactivated */}
              {editingBranch && !editingBranch.is_active && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>This branch is currently deactivated. You must activate the branch first to update its details.</span>
                </div>
              )}

              <form onSubmit={handleSaveBranch} className="space-y-4" autoComplete="off" data-form-type="other">
                {/* Branch Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Helix Care Main"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-xs sm:text-sm text-slate-900 outline-none transition-all"
                  />
                </div>

                {/* Branch Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Branch Code (Short Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    disabled={editingBranch?.code === 'MAIN'}
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 10))}
                    placeholder="e.g. MAIN or ADJ"
                    className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-mono font-bold outline-none transition-all uppercase ${
                      editingBranch?.code === 'MAIN'
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-slate-900'
                    }`}
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {editingBranch?.code === 'MAIN'
                      ? 'Primary Main Branch short code (MAIN) cannot be changed.'
                      : 'Used on queue tokens and invoice numbers (e.g. ADJ-001).'}
                  </span>
                </div>

                {/* Street Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Physical Street Address
                  </label>
                  <textarea
                    rows={2}
                    autoComplete="off"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 101, Medical Enclave, Ring Road"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-xs sm:text-sm text-slate-900 outline-none transition-all resize-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Automatically prints at the top of receipts and prescriptions issued at this branch.
                  </span>
                </div>

                {/* City, State, Pincode Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={city}
                      onChange={(e) => setCity(e.target.value.replace(/[\d!@#$%^&*()_+={}\[\]:;<>?,./]/g, ''))}
                      placeholder="e.g. Mumbai"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#009fe3] text-xs text-slate-900 outline-none"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value.replace(/[\d!@#$%^&*()_+={}\[\]:;<>?,./]/g, ''))}
                      placeholder="e.g. Maharashtra"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#009fe3] text-xs text-slate-900 outline-none"
                    />
                  </div>

                  {/* Pincode */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Pincode (6 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoComplete="off"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="400001"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-[#009fe3] text-xs font-mono text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Branch Contact Phone (10 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    autoComplete="off"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-xs sm:text-sm font-mono text-slate-900 outline-none transition-all"
                  />
                </div>

                {/* Active / Inactive Status Toggle (Clean Inline Redesign - Shown ONLY when branch is active!) */}
                {(!editingBranch || editingBranch.is_active) && (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 mt-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Branch Status</span>
                      <span className="text-[11px] text-slate-400">
                        {editingBranch?.code === 'MAIN'
                          ? 'Primary Main Branch cannot be deactivated.'
                          : 'Deactivated branches are hidden from staff token queues.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={editingBranch?.code === 'MAIN'}
                      onClick={() => setIsActive(!isActive)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                        editingBranch?.code === 'MAIN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed opacity-90'
                          : isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100/80'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer hover:bg-rose-100/80'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span>{isActive ? 'Active' : 'Deactivated'}</span>
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || (editingBranch !== null && !editingBranch.is_active)}
                    className={`text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-none ${
                      editingBranch !== null && !editingBranch.is_active
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-[#009fe3] hover:bg-[#008bc7] cursor-pointer'
                    }`}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Saving Branch...</span>
                      </>
                    ) : editingBranch ? (
                      'Update Branch'
                    ) : (
                      'Create Branch'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </SettingsLayout>
  );
}
