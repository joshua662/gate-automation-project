import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminNotificationsApi, type NotificationEntry } from '../services/adminApi'
import { formatDate } from '../utils/formatDate'
import { useModalAnimation } from '../hooks/useModalAnimation'
import ToastMessage from '../components/ToastMessage/ToastMessage'
import { MaskedEmail } from '../components/MaskedEmail/MaskedEmail'

interface ConfirmationModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  type: 'accept' | 'reject'
  loading: boolean
}

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  type,
  loading,
}: ConfirmationModalProps) => {
  const { shouldRender, isAnimatingOut } = useModalAnimation(isOpen)
  if (!shouldRender) return null

  const isReject = type === 'reject'
  const actionBtnClass = isReject
    ? 'bg-red-600 hover:bg-red-500 text-white'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white'

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={onCancel}
    >
      <div className={`fixed inset-0 bg-black/70 backdrop-blur-md ${isAnimatingOut ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop-in'}`} />
      <div
        className={`relative w-full max-w-md rounded-xl bg-[#1e1e24]/80 p-6 shadow-2xl border border-white/10 backdrop-blur-xl ${isAnimatingOut ? 'animate-modal-panel-out' : 'animate-modal-panel-in'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#2a2a2a] hover:text-white transition cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-sm text-zinc-300 mb-6 leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${actionBtnClass}`}
          >
            {loading ? 'Processing...' : isReject ? 'Reject Request' : 'Accept Request'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'accept' | 'reject'
    notificationId: number
  } | null>(null)

  const fetchNotifications = (silent = false) => {
    if (!silent) setLoading(true)
    adminNotificationsApi.getNotifications()
      .then((res) => {
        const list = Array.isArray(res.data.notifications) 
          ? res.data.notifications 
          : (res.data.notifications as any).data ?? []
        setNotifications(list)
      })
      .catch(() => setNotifications([]))
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }

  useEffect(() => {
    fetchNotifications()
    const intervalId = setInterval(() => {
      fetchNotifications(true)
    }, 5000)
    return () => clearInterval(intervalId)
  }, [])

  const handleApproveClick = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Accept Registration Request',
      message: 'Are you sure you want to accept this registration request and send credentials to user? This will send their account details via their provided email address.',
      type: 'accept',
      notificationId: id,
    })
  }

  const handleRejectClick = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Reject Registration Request',
      message: 'Are you sure you want to reject this registration request? The user account will be rejected and deleted.',
      type: 'reject',
      notificationId: id,
    })
  }

  const handleMarkAllRead = async () => {
    try {
      await adminNotificationsApi.markAllRead()
      fetchNotifications()
      window.dispatchEvent(new Event('notifications_updated'))
    } catch (err) {}
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-500">View recent system and security notifications.</p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      <ToastMessage
        isVisible={!!message}
        title={message?.isError ? "Action failed" : (message?.text?.includes('rejected') ? "Request rejected" : "Registration approved")}
        message={message?.text || ""}
        isFailed={message?.isError || message?.text?.includes('rejected')}
        onClose={() => setMessage(null)}
        autoCloseMs={3000}
        size="default"
        overlay={true}
      />

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-[#18181b] p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-48 rounded bg-zinc-800" />
                  <div className="h-3.5 w-24 rounded bg-zinc-800" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-16 rounded bg-zinc-800" />
                  <div className="h-8 w-16 rounded bg-zinc-800" />
                </div>
              </div>
              <div className="h-28 rounded-lg bg-zinc-900/50 border border-white/5 p-4" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-[#18181b] p-12 text-center">
          <p className="text-sm font-medium text-zinc-500">You&apos;re all caught up. No new notifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => {
            let details: any = null
            if (n.type === 'registration_approval') {
              try {
                details = JSON.parse(n.message)
              } catch (e) {}
            }

            return (
              <div
                key={n.notification_id}
                className={`rounded-xl border border-white/5 bg-[#18181b] p-5 transition ${!n.is_read ? 'ring-1 ring-[#C5A073]/30' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-200">{n.title}</span>
                      {!n.is_read && (
                        <span className="inline-block h-2 w-2 rounded-full bg-[#C5A073]" />
                      )}
                    </div>
                    <span className="block text-[11px] text-zinc-500">{formatDate(n.created_at)}</span>
                  </div>

                  {/* Buttons moved inside Request Details */}
                </div>

                <div className="mt-4 text-sm text-zinc-300">
                  {n.type === 'registration_approval' && details ? (
                    <div className="rounded-lg bg-zinc-900/50 p-4 border border-white/5">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Request Details</p>
                      
                      <div className="flex flex-col gap-3 text-zinc-300 text-[13.5px]">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-500 w-12">Name:</span> 
                          <span className="font-medium text-zinc-200">{details.name}</span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-500 w-12">Role:</span> 
                            <span className="capitalize font-medium text-zinc-200">{details.role.replace('_', ' ')}</span>
                          </div>
                          <div className="flex gap-3 shrink-0">
                            <button
                              onClick={() => handleApproveClick(n.notification_id)}
                              disabled={actionLoading !== null}
                              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                              Approve Request
                            </button>
                            <button
                              onClick={() => handleRejectClick(n.notification_id)}
                              disabled={actionLoading !== null}
                              className="rounded-lg bg-red-600/90 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                              Reject Request
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-zinc-500 w-12">Email:</span> 
                          <MaskedEmail email={details.email} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-300">{n.message}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmState?.isOpen ?? false}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        type={confirmState?.type ?? 'accept'}
        loading={confirmState ? actionLoading === confirmState.notificationId : false}
        onCancel={() => setConfirmState(prev => prev ? { ...prev, isOpen: false } : null)}
        onConfirm={async () => {
          if (!confirmState) return
          const id = confirmState.notificationId
          setActionLoading(id)
          setMessage(null)
          try {
            if (confirmState.type === 'accept') {
              const res = await adminNotificationsApi.approve(id)
              setMessage({ text: res.data.message ?? 'Registration request approved successfully.' })
            } else {
              const res = await adminNotificationsApi.reject(id)
              setMessage({ text: res.data.message ?? 'Registration request rejected and account deleted.' })
            }
            setConfirmState(prev => prev ? { ...prev, isOpen: false } : null)
            fetchNotifications()
            window.dispatchEvent(new Event('notifications_updated'))
          } catch (err: any) {
            setMessage({ text: err.response?.data?.message ?? 'Action failed.', isError: true })
          } finally {
            setActionLoading(null)
          }
        }}
      />
    </div>
  )
}

export default NotificationsPage
