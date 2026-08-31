// components/comments/CommentSection.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  CornerDownRight,
  Send,
  Loader2,
} from "lucide-react"
import type { Comment, CommentTarget } from "@/types"
import { useComments } from "@/hooks/useComments"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function initialsOf(c: Comment): string {
  return `${c.author.firstName[0] ?? ""}${c.author.lastName[0] ?? ""}`.toUpperCase() || "?"
}

interface ComposerProps {
  onSubmit: (body: string) => Promise<unknown>
  placeholder?: string
  buttonLabel?: string
  autoFocus?: boolean
}

function Composer({ onSubmit, placeholder = "Write a comment...", buttonLabel = "Post", autoFocus }: ComposerProps) {
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || posting) return
    setPosting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setBody("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={!body.trim() || posting} className="gap-1.5">
          {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

function VoteRow({
  comment,
  loggedIn,
  onVote,
}: {
  comment: Comment
  loggedIn: boolean
  onVote: (commentId: string, value: 1 | -1) => Promise<void>
}) {
  const [voting, setVoting] = useState(false)
  const upActive = comment.myVote === 1
  const downActive = comment.myVote === -1

  async function handleVote(value: 1 | -1) {
    if (!loggedIn || voting) return
    setVoting(true)
    try {
      await onVote(comment.id, value)
    } finally {
      setVoting(false)
    }
  }

  const buttonClass = (active: boolean, color: "up" | "down") =>
    `rounded-md p-1 transition-colors ${
      active
        ? color === "up"
          ? "text-primary bg-primary/10"
          : "text-destructive bg-destructive/10"
        : "text-muted-foreground hover:bg-muted"
    } ${loggedIn ? "cursor-pointer" : "cursor-default"} ${voting ? "opacity-60" : ""}`

  return (
    <div className="flex items-center gap-1" onClick={loggedIn ? undefined : (e) => e.preventDefault()}>
      <button
        type="button"
        className={buttonClass(upActive, "up")}
        onClick={() => handleVote(1)}
        disabled={!loggedIn}
        title={loggedIn ? "Upvote" : "Log in to vote"}
        aria-label="Upvote"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <span className={`min-w-5 text-center text-xs font-semibold tabular-nums ${comment.netVotes > 0 ? "text-primary" : comment.netVotes < 0 ? "text-destructive" : "text-muted-foreground"}`}>
        {comment.netVotes}
      </span>
      <button
        type="button"
        className={buttonClass(downActive, "down")}
        onClick={() => handleVote(-1)}
        disabled={!loggedIn}
        title={loggedIn ? "Downvote" : "Log in to vote"}
        aria-label="Downvote"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function CommentItem({
  comment,
  depth,
  loggedIn,
  currentUserId,
  onVote,
  onReply,
  onDelete,
}: {
  comment: Comment
  depth: number
  loggedIn: boolean
  currentUserId?: string
  onVote: (commentId: string, value: 1 | -1) => Promise<void>
  onReply: (parentId: string, body: string) => Promise<unknown>
  onDelete: (commentId: string) => Promise<void>
}) {
  const [replying, setReplying] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isOwn = loggedIn && currentUserId === comment.author.id

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border/40 pl-3 space-y-2" : "space-y-2"}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5 rounded-full">
            <AvatarImage src={comment.author.profileImage || undefined} alt={comment.author.firstName} />
            <AvatarFallback className="text-[9px] font-medium">{initialsOf(comment)}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">{`${comment.author.firstName} ${comment.author.lastName}`}</span>
          <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
        </div>

        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{comment.body}</p>

        <div className="flex items-center gap-1.5">
          <VoteRow comment={comment} loggedIn={loggedIn} onVote={onVote} />
          <button
            type="button"
            className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setReplying((r) => !r)}
          >
            <CornerDownRight className="h-3 w-3" />
            Reply
          </button>
          {isOwn && (
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmingDelete((c) => !c)}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-2 py-1.5">
            <span className="text-xs text-destructive">Delete this comment?</span>
            <button
              type="button"
              className="rounded-md bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true)
                try {
                  await onDelete(comment.id)
                } finally {
                  setDeleting(false)
                  setConfirmingDelete(false)
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium hover:bg-muted/80"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {replying && (
          <Composer
            placeholder={`Reply to ${comment.author.firstName}...`}
            buttonLabel="Reply"
            autoFocus
            onSubmit={async (body) => {
              await onReply(comment.id, body)
              setReplying(false)
            }}
          />
        )}
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              loggedIn={loggedIn}
              currentUserId={currentUserId}
              onVote={onVote}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentSection({ target }: { target: CommentTarget }) {
  const navigate = useNavigate()
  const { comments, loading, user, addComment, vote, removeComment } = useComments(target)
  const loggedIn = Boolean(user)
  const total = countComments(comments)

  return (
    <div className="rounded-xl border bg-card/50 p-3 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold uppercase tracking-wider">Comments</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {total}
        </span>
      </div>

      {loggedIn ? (
        <Composer
          onSubmit={(body) => addComment(body)}
          placeholder="Add a comment..."
        />
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            Log in to join the conversation.
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/login")}>
            Log in to comment
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              loggedIn={loggedIn}
              currentUserId={user?.id}
              onVote={(id, value) => vote(id, value)}
              onReply={(parentId, body) => addComment(body, parentId)}
              onDelete={(id) => removeComment(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function countComments(list: Comment[]): number {
  return list.reduce((sum, c) => sum + 1 + (c.replies ? countComments(c.replies) : 0), 0)
}
