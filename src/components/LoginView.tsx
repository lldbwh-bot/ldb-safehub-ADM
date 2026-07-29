/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, User, Landmark, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { UserAccount } from '../types';
import { getSavedBranches, getSavedUsers } from '../dataStore';
import { isCentralApiAvailable, loginCentral } from '../apiClient';
// @ts-ignore
import loginBg from '../assets/images/ldb_login_background_1782897048880.jpg';

interface LoginViewProps {
  onLoginSuccess: (user: UserAccount) => void | Promise<void>;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branch, setBranch] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usersList = React.useMemo(() => getSavedUsers(), []);
  const branchOptions = React.useMemo(
    () => Array.from(new Set(getSavedBranches().map((item) => item.ສາຂາ).filter(Boolean))).sort(),
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ');
      return;
    }

    if (!branch) {
      setError('ກະລຸນາເລືອກສາຂາ');
      return;
    }

    if (isCentralApiAvailable()) {
      setIsSubmitting(true);
      try {
        const result = await loginCentral(
          username.trim(),
          password.trim(),
          branch,
        );
        await onLoginSuccess(result.user);
        return;
      } catch {
        setError('ບໍ່ສາມາດຕິດຕໍ່ລະບົບ Login ໄດ້ ກະລຸນາລອງໃໝ່');
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    // File and Demo/UAT previews intentionally keep browser-local authentication.
    const user = usersList.find(
      (acc) => acc.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user) {
      setError('ບໍ່ພົບຊື່ຜູ້ໃຊ້ນີ້ໃນລະບົບ');
      return;
    }

    if (String(user.password_raw) !== password.trim()) {
      setError('ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
      return;
    }

    if (user.branch !== branch) {
      setError(`ບັນຊີນີ້ບໍ່ໄດ້ສັງກັດຢູ່ ສາຂາ ${branch}. ກະລຸນາກວດສອບສາຂາຄືນໃໝ່.`);
      return;
    }

    onLoginSuccess(user);
  };

  return (
    <div 
      className="min-h-screen bg-[#050a14] bg-ldb-brand flex items-center justify-center bg-cover bg-center relative select-none px-4 py-12 sm:px-6 lg:px-8"
      style={{ backgroundImage: `linear-gradient(rgba(5, 10, 20, 0.78), rgba(5, 10, 20, 0.88)), url(${loginBg})` }}
    >
      <div className="max-w-md w-full space-y-8 bg-[#0a1120]/85 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-blue-900/40 text-slate-100 relative z-10">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-[#0e1426] border-2 border-[#C5A059] flex items-center justify-center text-[#C5A059] shadow-lg shadow-blue-950/50 transform transition hover:scale-105">
            <Landmark className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-3xl font-display font-bold tracking-tight text-white">
            LDB SafeHub
          </h2>
          <p className="mt-2 text-sm text-slate-300 font-medium">
            ລະບົບຄວາມປອດໄພ ແລະ ບຳລຸງຮັກສາອາຄານ
          </p>
          <div className="mt-1 text-xs text-[#C5A059] font-mono tracking-wider">
            Lao Development Bank (LDB)
          </div>
        </div>

        {error && (
          <div className="bg-red-950/60 border-l-4 border-red-500 p-4 rounded-lg text-sm text-red-200 font-medium border border-red-900/30">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                ຊື່ຜູ້ໃຊ້ (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059] focus:border-transparent sm:text-sm text-slate-900 font-medium"
                  placeholder="ປ້ອນຊື່ຜູ້ໃຊ້ຂອງທ່ານ"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                ລະຫັດຜ່ານ (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Key className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-12 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C5A059] focus:border-transparent sm:text-sm text-slate-900 font-medium"
                  placeholder="ປ້ອນລະຫັດຜ່ານຂອງທ່ານ"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
                  title={showPassword ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-[#C5A059] focus:outline-none focus:text-[#C5A059] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                ສາຂາ (Branch)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Landmark className="h-5 w-5" />
                </div>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="block w-full pl-10 pr-8 py-2.5 border border-slate-300 rounded-xl leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-[#C5A059] focus:border-transparent sm:text-sm text-slate-900 font-medium cursor-pointer appearance-none"
                >
                  <option value="" className="bg-white text-slate-900">-- ກະລຸນາເລືອກສາຂາ (Select Branch) --</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b} className="bg-white text-slate-900">
                      {b}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-[#050a14] bg-gradient-to-r from-[#C5A059] to-[#b38f4d] hover:from-[#d1ad66] hover:to-[#c5a059] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C5A059] transition-all shadow-lg shadow-[#C5A059]/20"
          >
            <Shield className="h-5 w-5 mr-2 text-[#050a14]" />
            {isSubmitting ? 'ກຳລັງກວດສອບ...' : 'ເຂົ້າສູ່ລະບົບ (Sign In)'}
          </button>
        </form>

      </div>
    </div>
  );
}
