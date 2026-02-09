'use client'

/**
 * Intercepted Pulse Modal — @modal/(.)[id]
 *
 * This page is rendered by the @modal parallel slot when the user
 * soft-navigates (clicks) from /pulse to /pulse/[id].
 *
 * The feed stays mounted in the {children} slot behind this overlay.
 * On hard navigation (direct link / refresh), this file is NOT used —
 * the full [id]/page.tsx renders instead.
 */

import { useRouter, useParams } from 'next/navigation'
import { useCallback } from 'react'
import { PulseDetailModal } from '@/components/uicustom/pulse/PulseDetailModal'

export default function InterceptedPulsePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const pulseId = params.id

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  const handleTagClick = useCallback(
    (tag: string) => {
      // Navigate back to feed with tag filter applied
      // The feed reads ?tag= from searchParams
      router.back()
    },
    [router],
  )

  const handleOpenPoll = useCallback(
    (pollId: string) => {
      // Close pulse modal and open poll on the feed
      router.replace(`/pulse?poll=${encodeURIComponent(pollId)}`)
    },
    [router],
  )

  return (
    <PulseDetailModal
      pulseId={pulseId}
      onClose={handleClose}
      onTagClick={handleTagClick}
      onOpenPoll={handleOpenPoll}
    />
  )
}
