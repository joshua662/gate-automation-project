import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { adminAuthApi } from '../../services/adminApi'
import { guardApi, type GuardUser } from '../../services/guardApi'
import { formatPlateInput } from '../../utils/plateFormat'
import { formatDateShort } from '../../utils/formatDate'
import { useModalAnimation } from '../../hooks/useModalAnimation'
import GuardActivityLogs from './GuardActivityLogs'
import { MemberCardModal } from './MemberCard'

interface GuardDetailsProps {
  isOpen: boolean
  user: GuardUser | null
  onClose: () => void
  onUpdate?: () => void
}

const roleLabel = (role: string) => (role === 'resident' ? 'Resident' : 'Security Guard')

const userFullName = (user: GuardUser) =>
  [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')

const LockIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const ShieldCheckIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const RfidSection = ({ user, onUpdate }: { user: GuardUser; onUpdate?: () => void }) => {
  const [rfidInput, setRfidInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedUid, setSavedUid] = useState(user.rfid_card_uid ?? '')
  const isLocked = !!savedUid

  const handleSave = async () => {
    const trimmed = rfidInput.trim()
    if (!trimmed) {
      setError('Please enter an RFID UID.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await guardApi.updateResidentRfid(user.user_id, trimmed)
      setSavedUid(res.data.resident.rfid_card_uid ?? trimmed)
      setRfidInput('')
      onUpdate?.()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || 'Failed to save RFID UID.')
    } finally {
      setSaving(false)
    }
  }

  if (isLocked) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <ShieldCheckIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">RFID UID</p>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-300">{savedUid}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-400">
            <LockIcon />
            Permanently Assigned
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Assign RFID UID</p>
      <p className="mt-1 text-sm text-zinc-400">
        Enter the RFID card UID for this resident. Once assigned, it <strong className="text-amber-400">cannot be changed</strong>.
      </p>
      <div className="mt-4 flex gap-3">
        <input
          type="text"
          value={rfidInput}
          onChange={(e) => { setRfidInput(e.target.value); setError('') }}
          placeholder="e.g. A3 B2 C1 D0"
          maxLength={50}
          className="flex-1 rounded-lg border border-white/10 bg-[#121212] px-4 py-2.5 font-mono text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-[#C5A073] focus:ring-1 focus:ring-[#C5A073]/40"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !rfidInput.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#C5A073] px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-[#d4b589] disabled:opacity-50"
        >
          {saving ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : 'Assign RFID'}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
    </div>
  )
}

const GuardDetailsModal = ({ isOpen, user, onClose, onUpdate }: GuardDetailsProps) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen)
  const [cardOpen, setCardOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [genders, setGenders] = useState<{ gender_id: number; gender: string }[]>([])

  const [form, setForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix_name: '',
    username: '',
    email: '',
    contact_number: '',
    birth_date: '',
    gender: '',
    address: '',
    plate_number: '',
    car_model: '',
    car_color: '',
  })

  useEffect(() => {
    if (!user) return
    setIsEditing(false)
    setIsDeleting(false)
    setError('')
    setForm({
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      last_name: user.last_name || '',
      suffix_name: '',
      username: user.username || '',
      email: user.email || '',
      contact_number: user.contact_number || '',
      birth_date: user.birth_date ? user.birth_date.split('T')[0] : '',
      gender: String(user.gender?.gender_id || ''),
      address: user.address || '',
      plate_number: user.plate_number || '',
      car_model: user.car_model || '',
      car_color: user.car_color || '',
    })
  }, [user])

  const loadGendersIfNeeded = async () => {
    if (genders.length > 0) return
    try {
      const res = await adminAuthApi.loadGenders()
      setGenders(res.data?.genders ?? [])
    } catch {
      // Ignore fallback
    }
  }

  const handleStartEdit = () => {
    loadGendersIfNeeded()
    setIsEditing(true)
    setError('')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError('')

    const isResident = user.role === 'resident'

    try {
      const payload: Record<string, any> = {
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        username: form.username,
        email: form.email,
        contact_number: form.contact_number,
        birth_date: form.birth_date,
        gender: form.gender,
      }

      if (isResident) {
        payload.address = form.address
        payload.plate_number = form.plate_number
        payload.car_model = form.car_model
        payload.car_color = form.car_color
      } else {
        payload.suffix_name = form.suffix_name || null
      }

      await guardApi.updateUser(user.user_id, payload, isResident)
      setIsEditing(false)
      onUpdate?.()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const resp = axiosErr.response?.data
      if (resp?.errors) {
        setError(Object.values(resp.errors).flat().join(' '))
      } else {
        setError(resp?.message || 'Failed to update details.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!user) return
    setDeleting(true)
    setError('')
    try {
      await guardApi.deleteUser(user.user_id, user.role === 'resident')
      setIsDeleting(false)
      onUpdate?.()
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message || 'Failed to delete account.')
    } finally {
      setDeleting(false)
    }
  }

  if (!shouldRender || !user) return null

  const isResident = user.role === 'resident'

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={onClose}>
      <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
      <div
        className={`relative flex h-[min(92vh,960px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#18181e]/80 backdrop-blur-xl shadow-2xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-6 sm:px-8">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-zinc-100 sm:text-2xl">{roleLabel(user.role)} Details</h2>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && !isDeleting && (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  <EditIcon />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDeleting(true); setError('') }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                >
                  <TrashIcon />
                  Delete
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close staff details"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {isDeleting ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center backdrop-blur-md">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                <TrashIcon />
              </div>
              <h3 className="mt-4 text-lg font-bold text-zinc-100">Confirm Deletion</h3>
              <p className="mt-2 text-sm text-zinc-400 max-w-md mx-auto">
                Are you sure you want to delete <strong className="text-zinc-200">{userFullName(user)}</strong>? This action will deactivate the account.
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleting(false)}
                  disabled={deleting}
                  className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete Account'}
                </button>
              </div>
            </div>
          ) : isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Edit Account Information</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#C5A073] px-5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-[#d4b589] disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">First Name</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Middle Name</label>
                  <input
                    type="text"
                    value={form.middle_name}
                    onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Last Name</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Username</label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Email</label>
                  <input
                    type="email"
                    required={isResident}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Contact Number</label>
                  <input
                    type="text"
                    required={isResident}
                    value={form.contact_number}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                    maxLength={11}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                  >
                    <option value="">Select Gender</option>
                    {genders.length > 0 ? (
                      genders.map((g) => (
                        <option key={g.gender_id} value={g.gender_id}>
                          {g.gender}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                        <option value="3">Prefer Not to Say</option>
                      </>
                    )}
                  </select>
                </div>

                {isResident && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">Address</label>
                    <input
                      type="text"
                      required
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                    />
                  </div>
                )}
              </div>

              {isResident && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">Plate Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABC 1234"
                      value={form.plate_number}
                      onChange={(e) => setForm({ ...form, plate_number: formatPlateInput(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073] placeholder:text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">Vehicle Model</label>
                    <input
                      type="text"
                      required
                      value={form.car_model}
                      onChange={(e) => setForm({ ...form, car_model: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">Vehicle Color</label>
                    <input
                      type="text"
                      required
                      value={form.car_color}
                      onChange={(e) => setForm({ ...form, car_color: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#121212] px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[#C5A073]"
                    />
                  </div>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
                <div>
                  <h1 className="text-2xl font-bold text-zinc-100 sm:text-3xl">{userFullName(user)}</h1>
                  <p className="mt-1 text-sm text-zinc-500">
                    {roleLabel(user.role)} - @{user.username}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Member Card</p>
                      <p className="mt-2 text-sm text-zinc-300">Created by admin for this account role.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCardOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V4h12v5M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6v-7z" />
                      </svg>
                      Print
                    </button>
                  </div>
                </div>
              </div>

              {isResident && <RfidSection user={user} onUpdate={onUpdate} />}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Email" value={user.email ?? 'N/A'} />
                <Detail label="Username" value={user.username} />
                <Detail label="Date of Birth" value={formatDateShort(user.birth_date)} />
                <Detail label="Gender" value={user.gender?.gender ?? 'N/A'} />
                <Detail label="Contact Number" value={user.contact_number ?? 'N/A'} />
                <Detail label="Age" value={String(user.age ?? 'N/A')} />
                {isResident && (
                  <>
                    <Detail label="Plate Number" value={user.plate_number ?? 'N/A'} />
                    <Detail label="Vehicle" value={[user.car_color, user.car_model].filter(Boolean).join(' ') || 'N/A'} />
                  </>
                )}
              </div>

              <GuardActivityLogs userId={user.user_id} title={`Login / Logout History - ${user.first_name}`} />
            </div>
          )}
        </div>
      </div>

      <MemberCardModal isOpen={cardOpen} user={user} onClose={() => setCardOpen(false)} />
    </div>,
    document.body,
  )
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-white/5 bg-black/25 p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
  </div>
)

export default GuardDetailsModal
