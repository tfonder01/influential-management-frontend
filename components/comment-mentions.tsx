"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { USERS } from "@/lib/mock-data"
import { listMentionableUsers, type CommentMention, type MentionableUser } from "@/lib/mentions-api"
import { roleLabel } from "@/lib/role-labels"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MentionCommentComposerProps {
  locationId: string
  value: string
  onChange: (value: string) => void
  onSubmit: (mentionedUserIds: string[]) => void | Promise<void>
  currentUserId: string
  isDemoMode: boolean
  disabled?: boolean
  rows?: number
  placeholder: string
  submitLabel?: string
}

interface ActiveMention {
  start: number
  end: number
  query: string
}

const ROLE_TO_API: Record<Role, MentionableUser["role"]> = {
  owner: "OWNER",
  director: "DIRECTOR",
  assistant_director: "ASSISTANT_DIRECTOR",
}

export function MentionCommentComposer({
  locationId,
  value,
  onChange,
  onSubmit,
  currentUserId,
  isDemoMode,
  disabled = false,
  rows = 3,
  placeholder,
  submitLabel = "Add comment",
}: MentionCommentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [users, setUsers] = useState<MentionableUser[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Map<string, MentionableUser>>(new Map())
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) {
      setUsers(USERS.filter((user) => user.id !== currentUserId && (user.role === "owner" || user.locationId === locationId))
        .map((user) => ({ id: user.id, displayName: user.name, role: ROLE_TO_API[user.role] })))
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    listMentionableUsers(locationId)
      .then((result) => { if (!cancelled) setUsers(result) })
      .catch(() => { if (!cancelled) setUsers([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentUserId, isDemoMode, locationId])

  useEffect(() => {
    if (!value) setSelectedUsers(new Map())
  }, [value])

  const filteredUsers = useMemo(() => {
    if (!activeMention) return []
    const query = activeMention.query.toLocaleLowerCase()
    return users.filter((user) => user.displayName.toLocaleLowerCase().includes(query))
  }, [activeMention, users])

  const updateActiveMention = (text: string, caret: number) => {
    const beforeCaret = text.slice(0, caret)
    const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/)
    if (!match) {
      setActiveMention(null)
      return
    }
    const atOffset = match[0].lastIndexOf("@")
    setActiveMention({ start: caret - match[0].length + atOffset, end: caret, query: match[1] })
    setActiveIndex(0)
  }

  const selectUser = (user: MentionableUser) => {
    if (!activeMention) return
    const nextValue = `${value.slice(0, activeMention.start)}@${user.displayName} ${value.slice(activeMention.end)}`
    const nextCaret = activeMention.start + user.displayName.length + 2
    onChange(nextValue)
    setSelectedUsers((previous) => new Map(previous).set(user.id, user))
    setActiveMention(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const submit = () => {
    if (!value.trim() || disabled) return
    const mentionedUserIds = [...selectedUsers.values()]
      .filter((user) => value.includes(`@${user.displayName}`))
      .map((user) => user.id)
    setActiveMention(null)
    void onSubmit(mentionedUserIds)
  }

  const menuOpen = activeMention !== null

  return (
    <div className="relative min-w-0 flex-1">
      <Textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          updateActiveMention(event.target.value, event.target.selectionStart)
        }}
        onClick={(event) => updateActiveMention(event.currentTarget.value, event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (menuOpen && event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((index) => Math.min(index + 1, Math.max(filteredUsers.length - 1, 0)))
          } else if (menuOpen && event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((index) => Math.max(index - 1, 0))
          } else if (menuOpen && event.key === "Enter" && filteredUsers[activeIndex]) {
            event.preventDefault()
            selectUser(filteredUsers[activeIndex])
          } else if (menuOpen && event.key === "Escape") {
            event.preventDefault()
            setActiveMention(null)
          } else if (!menuOpen && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="resize-none text-sm"
        aria-autocomplete="list"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "mention-options" : undefined}
      />
      {menuOpen && (
        <div id="mention-options" role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg sm:max-w-sm">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading coworkers…</div>
          ) : filteredUsers.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matching coworkers for this location.</p>
          ) : filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn("flex w-full flex-col rounded px-3 py-2 text-left", index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60")}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectUser(user)}
            >
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="text-xs text-muted-foreground">{roleLabel(user.role.toLowerCase() as Role)}</span>
            </button>
          ))}
        </div>
      )}
      <Button size="sm" className="mt-2 min-h-10 w-full gap-1.5 sm:min-h-8 sm:w-auto" onClick={submit} disabled={!value.trim() || disabled}>
        {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {submitLabel}
      </Button>
    </div>
  )
}

export function MentionText({ text, mentions, className }: { text: string; mentions?: CommentMention[]; className?: string }) {
  const names = [...new Set((mentions ?? []).map((mention) => mention.displayName))]
    .sort((left, right) => right.length - left.length)
  if (names.length === 0) return <span className={className}>{text}</span>
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const pattern = new RegExp(`(@(?:${escaped.join("|")}))`, "g")
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {text.split(pattern).map((part, index) => names.some((name) => part === `@${name}`)
        ? <mark key={index} className="rounded bg-blue-100 px-0.5 font-medium text-blue-900">{part}</mark>
        : part)}
    </span>
  )
}
