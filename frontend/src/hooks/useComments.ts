import { useCallback, useEffect, useState } from "react"
import type { Comment, CommentTarget } from "@/types"
import { useAuth } from "@/context/AuthContext"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"

function targetQuery(target: CommentTarget): string {
  const params = new URLSearchParams({ targetType: target.type })
  if (target.type === "pin" && target.pinId) params.set("pinId", target.pinId)
  if (target.type === "location" && target.placeId) params.set("placeId", target.placeId)
  if (target.type === "route" && target.routeStartPinId && target.routeEndPinId) {
    params.set("routeStartPinId", target.routeStartPinId)
    params.set("routeEndPinId", target.routeEndPinId)
  }
  return params.toString()
}

export function useComments(target: CommentTarget | null) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!target) {
      setComments([])
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/comments?${targetQuery(target)}`, {
        credentials: "include",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Failed to load comments")
      setComments(data.comments)
    } catch (err) {
      console.error("Failed to load comments:", err)
    } finally {
      setLoading(false)
    }
  }, [target?.type, target?.pinId, target?.placeId, target?.routeStartPinId, target?.routeEndPinId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addComment(body: string, parentId?: string, imageUrl?: string): Promise<Comment> {
    const payload: Record<string, unknown> = {
      body,
      targetType: target?.type,
    }
    if (imageUrl) payload.imageUrl = imageUrl
    if (parentId) {
      payload.parentId = parentId
    } else {
      if (target?.type === "pin") payload.pinId = target.pinId
      if (target?.type === "location") {
        payload.placeId = target.placeId
        payload.latitude = target.latitude
        payload.longitude = target.longitude
      }
      if (target?.type === "route") {
        payload.routeStartPinId = target.routeStartPinId
        payload.routeEndPinId = target.routeEndPinId
      }
    }

    const response = await fetch(`${API_BASE}/comments`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Failed to post comment")
    await refresh()
    return data.comment
  }

  async function vote(commentId: string, value: 1 | -1) {
    const response = await fetch(`${API_BASE}/comments/${commentId}/vote`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? "Failed to vote")
    // Apply the returned vote state locally so the UI updates instantly
    // without a full refetch.
    setComments((prev) => updateVoteState(prev, commentId, data))
  }

  async function removeComment(commentId: string) {
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error ?? "Failed to delete comment")
    }
    setComments((prev) => removeCommentTree(prev, commentId))
  }

  return { comments, loading, user, addComment, vote, removeComment, refresh }
}

// Recursively apply { netVotes, myVote } returned by the vote endpoint.
function updateVoteState(
  list: Comment[],
  id: string,
  state: { netVotes: number; myVote: 1 | -1 | null }
): Comment[] {
  return list.map((c) => {
    if (c.id === id) return { ...c, netVotes: state.netVotes, myVote: state.myVote }
    if (c.replies?.length) return { ...c, replies: updateVoteState(c.replies, id, state) }
    return c
  })
}

// Remove a comment and its entire reply subtree.
function removeCommentTree(list: Comment[], id: string): Comment[] {
  return list
    .filter((c) => c.id !== id)
    .map((c) => ({
      ...c,
      replies: c.replies?.length ? removeCommentTree(c.replies, id) : c.replies,
    }))
}
