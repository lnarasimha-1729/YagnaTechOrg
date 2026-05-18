import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
    listQuestions,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    toggleDislike,
    reportPost,
} from './api/forumApi';
import { API_BASE } from '@/admin/api/client';

/**
 * Course discussion forum — body of the player's "Discussion" tab.
 *
 * Faithful port of the lms-cp reference:
 *   resources/views/course_player/forum/index.blade.php
 *   resources/views/course_player/forum/review.blade.php       (questions)
 *   resources/views/course_player/forum/child_review.blade.php (nested replies)
 *
 * Layout matches the reference exactly:
 *   - one scrollable screen, ALL questions with their replies nested inline
 *   - per-post 3-dot kebab menu: Edit + Delete (own) / Report (others')
 *   - Like / Dislike with counts
 *   - Reply form expands inline under a question
 *   - relative timestamps ("3 hours ago")
 *
 * Built with project conventions (react-toastify, plain useState, white-card
 * player body) rather than the reference's react-hot-toast / useApi.
 */

/* ----------------------------- helpers ----------------------------- */

// Relative time — mirrors the reference's timeAgo() Blade helper.
const timeAgo = (s) => {
    if (!s) return '';
    const then = new Date(s).getTime();
    if (Number.isNaN(then)) return '';
    const secs = Math.floor((Date.now() - then) / 1000);
    if (secs < 45) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
};

const photoUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE}/${String(path).replace(/^\/+/, '')}`;
};

const Avatar = ({ user, size = 36 }) => {
    const url = photoUrl(user?.photo);
    const initials = (user?.name || user?.email || 'U')
        .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    if (url) {
        return (
            <img src={url} alt="" className="rounded-full object-cover shrink-0"
                style={{ width: size, height: size }} />
        );
    }
    return (
        <span
            className="rounded-full bg-skin/10 text-skin font-semibold flex items-center justify-center shrink-0"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
            aria-hidden
        >
            {initials}
        </span>
    );
};

/* --------------------------- kebab menu --------------------------- */

// 3-dot menu — Edit/Delete for the owner, Report for everyone else.
// `can_edit` / `can_delete` come from the backend serializer; when the post
// is the current user's, those are true and Report is hidden.
function KebabMenu({ post, onEdit, onDelete, onReport }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const isOwn = post.can_edit !== false && post.can_delete !== false;

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
                onClick={() => setOpen((o) => !o)}
                aria-label="Post actions"
            >
                <i className="fa fa-ellipsis-v" />
            </button>
            {open && (
                <ul className="absolute right-0 z-20 mt-1 min-w-[140px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-[13px] list-none">
                    {isOwn && (
                        <li>
                            <button
                                type="button"
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50"
                                onClick={() => { setOpen(false); onEdit(); }}
                            >
                                <i className="fi fi-rr-edit" /> Edit
                            </button>
                        </li>
                    )}
                    {isOwn && (
                        <li>
                            <button
                                type="button"
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-red-600 hover:bg-red-50"
                                onClick={() => { setOpen(false); onDelete(); }}
                            >
                                <i className="fi fi-rr-trash" /> Delete
                            </button>
                        </li>
                    )}
                    {!isOwn && (
                        <li>
                            <button
                                type="button"
                                className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50"
                                onClick={() => { setOpen(false); onReport(); }}
                            >
                                <i className="fi fi-rr-exclamation" /> Report
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

/* ----------------------------- vote bar ----------------------------- */

function VoteBar({ post, onVote, onReplyClick, showReply }) {
    return (
        <div className="flex items-center gap-1 mt-2">
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-md hover:bg-gray-100 ${
                    post.liked_by_me ? 'text-skin font-semibold' : 'text-gray-600'
                }`}
                onClick={() => onVote('like')}
                title="Like"
            >
                <i className="fa fa-thumbs-up" />
                <span>Like</span>
                {post.likes_count > 0 && <span>{post.likes_count}</span>}
            </button>
            <button
                type="button"
                className={`inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-md hover:bg-gray-100 ${
                    post.disliked_by_me ? 'text-red-600 font-semibold' : 'text-gray-600'
                }`}
                onClick={() => onVote('dislike')}
                title="Dislike"
            >
                <i className="fa fa-thumbs-down" />
                <span>Dislike</span>
                {post.dislikes_count > 0 && <span>{post.dislikes_count}</span>}
            </button>
            {showReply && (
                <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-md text-gray-600 hover:bg-gray-100"
                    onClick={onReplyClick}
                    title="Reply"
                >
                    <i className="fa fa-reply" />
                    <span>Reply</span>
                </button>
            )}
        </div>
    );
}

/* ----------------------------- main tab ----------------------------- */

export default function ForumTab({ course }) {
    const courseId = course?.id;

    const [questions, setQuestions] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Ask form toggle.
    const [composing, setComposing] = useState(false);
    const [qTitle, setQTitle] = useState('');
    const [qDescription, setQDescription] = useState('');

    // Per-post inline state: which question's reply box is open, which post
    // is being edited.
    const [replyOpenFor, setReplyOpenFor] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');

    /* -------------------- load -------------------- */
    const fetchQuestions = useCallback(async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const r = await listQuestions(courseId);
            setQuestions(r.questions || []);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to load discussion');
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

    /* -------------------- ask -------------------- */
    const askQuestion = async (e) => {
        e.preventDefault();
        if (!qTitle.trim() || !qDescription.trim() || saving) return;
        setSaving(true);
        try {
            await createPost({ course_id: courseId, title: qTitle, description: qDescription });
            toast.success('Question posted');
            setQTitle('');
            setQDescription('');
            setComposing(false);
            fetchQuestions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to post question');
        } finally {
            setSaving(false);
        }
    };

    /* -------------------- reply -------------------- */
    const openReply = (questionId) => {
        setReplyOpenFor(questionId);
        setReplyText('');
        setEditingId(null);
    };

    const submitReply = async (questionId, e) => {
        e.preventDefault();
        if (!replyText.trim() || saving) return;
        setSaving(true);
        try {
            await createPost({
                course_id: courseId,
                parent_id: questionId,
                title: 'reply',           // discriminator — matches the reference
                description: replyText,
            });
            toast.success('Reply posted');
            setReplyText('');
            setReplyOpenFor(null);
            fetchQuestions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to post reply');
        } finally {
            setSaving(false);
        }
    };

    /* -------------------- edit -------------------- */
    const startEdit = (post, isReply) => {
        setEditingId(post.id);
        setEditTitle(isReply ? 'reply' : post.title);
        setEditBody(post.description || '');
        setReplyOpenFor(null);
    };

    const submitEdit = async (post, isReply, e) => {
        e.preventDefault();
        if (saving) return;
        if (!isReply && !editTitle.trim()) return;
        if (!editBody.trim()) return;
        setSaving(true);
        try {
            await updatePost(post.id, {
                title: isReply ? 'reply' : editTitle,
                description: editBody,
            });
            toast.success(isReply ? 'Reply updated' : 'Question updated');
            setEditingId(null);
            fetchQuestions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    /* -------------------- delete -------------------- */
    const removePost = async (id, isReply) => {
        try {
            await deletePost(id);
            toast.success(isReply ? 'Reply deleted' : 'Question deleted');
            fetchQuestions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete');
        }
    };

    /* -------------------- report -------------------- */
    const handleReport = async (id) => {
        try {
            const r = await reportPost(id, '');
            if (r.already_reported) toast.info(r.message);
            else toast.success(r.message);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to report');
        }
    };

    /* -------------------- vote -------------------- */
    // Updates the matching question OR reply in local state in place.
    const pickVote = (r) => ({
        likes_count: r.likes_count,
        dislikes_count: r.dislikes_count,
        liked_by_me: r.liked_by_me,
        disliked_by_me: r.disliked_by_me,
    });

    const handleVote = async (post, kind) => {
        try {
            const r = kind === 'like' ? await toggleLike(post.id) : await toggleDislike(post.id);
            const patch = (p) => (p.id === post.id ? { ...p, ...pickVote(r) } : p);
            setQuestions((qs) => qs.map((q) => ({
                ...patch(q),
                replies: (q.replies || []).map(patch),
            })));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to vote');
        }
    };

    /* -------------------- filter -------------------- */
    const filtered = search.trim()
        ? questions.filter((q) =>
            (q.title || '').toLowerCase().includes(search.toLowerCase()) ||
            (q.description || '').toLowerCase().includes(search.toLowerCase())
        )
        : questions;

    /* ============================== render ============================== */
    return (
        <div>
            {/* Search + Ask */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex-grow max-w-[320px]">
                    <input
                        type="text"
                        className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-skin"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search questions…"
                    />
                </div>
                <button
                    type="button"
                    className="ol-btn-primary inline-flex items-center gap-1"
                    onClick={() => setComposing((c) => !c)}
                >
                    <span className="fi-rr-plus" />
                    {composing ? 'Close' : 'Ask question'}
                </button>
            </div>

            {/* Ask form */}
            {composing && (
                <form
                    onSubmit={askQuestion}
                    className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50"
                >
                    <div className="mb-3">
                        <label className="block text-[13px] font-medium text-gray-700 mb-1">
                            Title <span className="text-red-600">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-skin"
                            value={qTitle}
                            onChange={(e) => setQTitle(e.target.value)}
                            placeholder="Question title"
                            maxLength={255}
                            required
                        />
                    </div>
                    <div className="mb-3">
                        <label className="block text-[13px] font-medium text-gray-700 mb-1">
                            Description <span className="text-red-600">*</span>
                        </label>
                        <textarea
                            className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-skin"
                            rows="4"
                            value={qDescription}
                            onChange={(e) => setQDescription(e.target.value)}
                            placeholder="Provide more details…"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="ol-btn-primary"
                        disabled={saving || !qTitle.trim() || !qDescription.trim()}
                    >
                        {saving ? 'Posting…' : 'Post question'}
                    </button>
                </form>
            )}

            <p className="text-[13px] text-gray-500 mb-3 m-0">
                {filtered.length} {filtered.length === 1 ? 'question' : 'questions'} in this course
            </p>

            {loading ? (
                <p className="text-[13px] text-gray-500">Loading…</p>
            ) : filtered.length === 0 ? (
                <p className="text-[13px] text-gray-500">
                    No questions yet. Be the first to ask!
                </p>
            ) : (
                <ul className="list-none p-0 m-0 flex flex-col gap-4">
                    {filtered.map((q) => (
                        <li key={q.id} className="border border-gray-200 rounded-lg p-4">
                            {/* ---- Question ---- */}
                            <div className="flex items-start gap-3">
                                <Avatar user={q.user} size={40} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-[14px] font-semibold text-gray-900">
                                                {q.user?.name || 'Unknown'}
                                            </div>
                                            <div className="text-[12px] text-gray-500">
                                                {timeAgo(q.created_at)}
                                            </div>
                                        </div>
                                        <KebabMenu
                                            post={q}
                                            onEdit={() => startEdit(q, false)}
                                            onDelete={() => removePost(q.id, false)}
                                            onReport={() => handleReport(q.id)}
                                        />
                                    </div>

                                    {editingId === q.id ? (
                                        <form onSubmit={(e) => submitEdit(q, false, e)} className="mt-2">
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[14px] mb-2 focus:outline-none focus:ring-2 focus:ring-skin"
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                maxLength={255}
                                                required
                                            />
                                            <textarea
                                                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-skin"
                                                rows="3"
                                                value={editBody}
                                                onChange={(e) => setEditBody(e.target.value)}
                                                required
                                            />
                                            <div className="flex gap-2 mt-2">
                                                <button type="submit" className="ol-btn-primary" disabled={saving}>
                                                    {saving ? 'Saving…' : 'Save'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ol-btn-outline-secondary"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <h6 className="text-[15px] font-semibold text-gray-900 mt-2 mb-1">
                                                {q.title}
                                            </h6>
                                            <p className="text-[14px] text-gray-800 whitespace-pre-wrap m-0">
                                                {q.description}
                                            </p>
                                            <VoteBar
                                                post={q}
                                                onVote={(k) => handleVote(q, k)}
                                                onReplyClick={() => openReply(q.id)}
                                                showReply
                                            />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ---- Reply form (inline) ---- */}
                            {replyOpenFor === q.id && (
                                <form
                                    onSubmit={(e) => submitReply(q.id, e)}
                                    className="mt-3 ml-12"
                                >
                                    <textarea
                                        className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-skin"
                                        rows="2"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Write a reply…"
                                        required
                                        autoFocus
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button type="submit" className="ol-btn-primary" disabled={saving || !replyText.trim()}>
                                            {saving ? 'Posting…' : 'Reply'}
                                        </button>
                                        <button
                                            type="button"
                                            className="ol-btn-outline-secondary"
                                            onClick={() => setReplyOpenFor(null)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* ---- Replies (nested, indented like the reference's ps-5) ---- */}
                            {(q.replies || []).length > 0 && (
                                <ul className="list-none p-0 m-0 mt-3 ml-12 flex flex-col gap-3">
                                    {q.replies.map((r) => (
                                        <li key={r.id} className="border-l-2 border-gray-100 pl-3">
                                            <div className="flex items-start gap-2">
                                                <Avatar user={r.user} size={28} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <span className="text-[13px] font-semibold text-gray-800">
                                                                {r.user?.name || 'Unknown'}
                                                            </span>
                                                            <span className="text-[12px] text-gray-500 ml-2">
                                                                {timeAgo(r.created_at)}
                                                            </span>
                                                        </div>
                                                        <KebabMenu
                                                            post={r}
                                                            onEdit={() => startEdit(r, true)}
                                                            onDelete={() => removePost(r.id, true)}
                                                            onReport={() => handleReport(r.id)}
                                                        />
                                                    </div>

                                                    {editingId === r.id ? (
                                                        <form onSubmit={(e) => submitEdit(r, true, e)} className="mt-1">
                                                            <textarea
                                                                className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-skin"
                                                                rows="2"
                                                                value={editBody}
                                                                onChange={(e) => setEditBody(e.target.value)}
                                                                required
                                                            />
                                                            <div className="flex gap-2 mt-2">
                                                                <button type="submit" className="ol-btn-primary" disabled={saving}>
                                                                    {saving ? 'Saving…' : 'Save'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="ol-btn-outline-secondary"
                                                                    onClick={() => setEditingId(null)}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <p className="text-[13px] text-gray-800 whitespace-pre-wrap m-0 mt-1">
                                                                {r.description}
                                                            </p>
                                                            <VoteBar
                                                                post={r}
                                                                onVote={(k) => handleVote(r, k)}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
