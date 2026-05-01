import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/ui';
import { formatDate } from '../utils/helpers';
import {
  Camera, Save, Trash2, User as UserIcon, Mail, Phone, Building2,
  Shield, Calendar, Clock, CheckCircle, KeyRound, Eye, EyeOff
} from 'lucide-react';

export default function Profile() {
  const { user, updateUser, organization } = useAuth();
  const data = useData();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Error state
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || '');
    }
  }, [user]);

  if (!user) return null;

  const department = data.departments.getAll().find(d => d.id === user.departmentId);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, GIF, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    setError('');
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(path);
      const avatarUrl = publicData.publicUrl;

      await supabase.from('users').update({ avatar: avatarUrl }).eq('id', user.id);
      updateUser({ avatar: avatarUrl });
      await data.users.update(user.id, { avatar: avatarUrl } as any);
    } catch (err: any) {
      setError('Failed to upload avatar: ' + (err.message || 'Unknown error'));
    } finally {
      setAvatarUploading(false);
      // Reset file input so same file can be re-selected
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarRemoving(true);
    setError('');
    try {
      await supabase.from('users').update({ avatar: null }).eq('id', user.id);
      updateUser({ avatar: undefined });
      await data.users.update(user.id, { avatar: '' } as any);
    } catch (err: any) {
      setError('Failed to remove avatar: ' + (err.message || 'Unknown error'));
    } finally {
      setAvatarRemoving(false);
    }
  };

  const handleProfileSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await data.users.update(user.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      } as any);
      updateUser({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError('Failed to save profile: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Enter your current password');
      return;
    }
    if (currentPassword !== user.password) {
      setPasswordError('Current password is incorrect');
      return;
    }
    if (!newPassword) {
      setPasswordError('Enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setPasswordSaving(true);
    try {
      await data.users.update(user.id, { password: newPassword } as any);
      updateUser({ password: newPassword });
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordSaved(false);
        setShowPasswordSection(false);
      }, 2000);
    } catch (err: any) {
      setPasswordError('Failed to change password: ' + (err.message || 'Unknown error'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <PageHeader title="My Profile" subtitle="Manage your personal information and account settings" />

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Profile updated successfully!
        </div>
      )}

      {/* Avatar Section */}
      <div className="card card-gradient p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Profile Picture
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar Preview */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-4xl font-bold text-white overflow-hidden shadow-lg shadow-emerald-500/20 border-4 border-white dark:border-zinc-700">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 shadow-lg border-2 border-gray-100 dark:border-zinc-600 flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50"
              title="Change photo"
            >
              <Camera className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {avatarUploading ? 'Uploading...' : 'Upload New Photo'}
              </button>
              {user.avatar && (
                <button
                  onClick={handleAvatarRemove}
                  disabled={avatarRemoving}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {avatarRemoving ? 'Removing...' : 'Remove Photo'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Recommended: square image, at least 200x200px. Max 5MB. PNG, JPG, GIF, or WebP.</p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="card card-gradient p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          Personal Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" /> Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Department
            </label>
            <p className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600">
              {department?.name || 'Not assigned'}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleProfileSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {(name !== user.name || email !== user.email || phone !== (user.phone || '')) && (
            <button
              onClick={() => {
                setName(user.name);
                setEmail(user.email);
                setPhone(user.phone || '');
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Discard changes
            </button>
          )}
        </div>
      </div>

      {/* Account Details (Read Only) */}
      <div className="card card-gradient p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          Account Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Role
            </label>
            <p className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-600 capitalize">
              {user.role}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Organization
            </label>
            <p className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-600">
              {organization?.name || 'N/A'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Member Since
            </label>
            <p className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600">
              {formatDate(user.createdAt)}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Last Updated
            </label>
            <p className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-600">
              {formatDate(user.updatedAt)}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl border border-gray-200 dark:border-zinc-600 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</label>
            <p className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-700/50 rounded-xl text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-zinc-600 font-mono truncate">
              {user.id}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card card-gradient p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Change Password
          </h3>
          {!showPasswordSection && (
            <button
              onClick={() => setShowPasswordSection(true)}
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              Change password
            </button>
          )}
        </div>

        {showPasswordSection ? (
          <div className="space-y-4 max-w-md">
            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{passwordError}</p>
            )}
            {passwordSaved && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Password changed successfully!
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 dark:border-zinc-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 dark:border-zinc-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-zinc-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-zinc-700 dark:text-white"
                placeholder="Re-enter new password"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handlePasswordChange}
                disabled={passwordSaving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <KeyRound className="w-4 h-4" /> {passwordSaving ? 'Changing...' : 'Update Password'}
              </button>
              <button
                onClick={() => {
                  setShowPasswordSection(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            It's a good idea to use a strong password that you're not using elsewhere.
          </p>
        )}
      </div>
    </div>
  );
}
