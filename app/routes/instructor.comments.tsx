import { useEffect, useState } from "react";
import { Link, data, isRouteErrorResponse, useFetcher } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Route } from "./+types/instructor.comments";
import { requireStaffRole, requireStaff } from "~/lib/access.server";
import { renderComment } from "~/lib/comment-markdown.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/user-avatar";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { cn, daysSince, formatRelativeTime } from "~/lib/utils";
import { MIN_COMMENT_LENGTH, MAX_COMMENT_LENGTH } from "~/lib/comments";
import { pluralize } from "~/lib/pluralize";
import { parseFormData } from "~/lib/validation";
import { db } from "~/db";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import { eq, ne, or, and, isNull, notExists, sql, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

type QueuedComment = {
  id: number;
  body: string;
  createdAt: string;
  lessonId: number;
  lessonTitle: string;
  courseTitle: string;
  courseSlug: string;
  authorId: number;
  authorName: string;
  authorAvatarUrl: string | null;
};

function getUnansweredComments(instructorId: number | null): QueuedComment[] {
  const author = alias(users, "author");
  const reply = alias(comments, "reply");
  const replyAuthor = alias(users, "reply_author");

  // Correlated: matches a live reply, by Staff, to the outer comment.
  const staffReply = db
    .select({ one: sql`1` })
    .from(reply)
    .innerJoin(replyAuthor, eq(replyAuthor.id, reply.userId))
    .where(
      and(
        eq(reply.parentId, comments.id),
        isNull(reply.deletedAt),
        or(
          eq(replyAuthor.role, UserRole.Admin),
          eq(reply.userId, courses.instructorId)
        )
      )
    );

  const conditions = [
    isNull(comments.parentId),
    isNull(comments.deletedAt),
    // Staff posting their own comment shouldn't queue up as work for themselves.
    ne(author.role, UserRole.Admin),
    ne(comments.userId, courses.instructorId),
    notExists(staffReply),
  ];

  if (instructorId !== null) {
    conditions.push(eq(courses.instructorId, instructorId));
  }

  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      authorId: author.id,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
    })
    .from(comments)
    .innerJoin(author, eq(comments.userId, author.id))
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .all();
}

function getCommentById(commentId: number) {
  return db.select().from(comments).where(eq(comments.id, commentId)).get();
}

function getCourseForLesson(lessonId: number) {
  return db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

function createComment(
  userId: number,
  lessonId: number,
  parentId: number | null,
  body: string
) {
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }

  const course = getCourseForLesson(lessonId);
  if (!course) {
    throw new Error("Lesson not found");
  }

  if (parentId !== null) {
    const parent = getCommentById(parentId);
    if (!parent) {
      throw new Error("Parent comment not found");
    }
    if (parent.lessonId !== lessonId) {
      throw new Error("Parent comment belongs to a different lesson");
    }
    if (parent.parentId !== null) {
      throw new Error("Replies can only be one level deep");
    }
  }

  return db
    .insert(comments)
    .values({ userId, lessonId, parentId, body: trimmed })
    .returning()
    .get();
}

// A comment left unanswered this long gets called out visually.
const STALE_AFTER_DAYS = 3;

const replySchema = z.object({
  intent: z.literal("reply"),
  commentId: z.coerce.number().int(),
  body: z.string(),
});

export function meta() {
  return [{ title: "Unanswered comments — Cadence" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { userId, isAdmin } = await requireStaffRole(request);

  // Admins span every course; instructors see only the courses they own.
  const unansweredComments = getUnansweredComments(isAdmin ? null : userId);

  const rendered = await Promise.all(
    unansweredComments.map(async (comment) => ({
      ...comment,
      bodyHtml: await renderComment(comment.body),
    }))
  );

  return { unansweredComments: rendered, isAdmin };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = parseFormData(formData, replySchema);

  if (!parsed.success) {
    return { ok: false, error: "Enter a reply before posting." };
  }

  const comment = getCommentById(parsed.data.commentId);
  if (!comment) {
    throw data("Comment not found.", { status: 404 });
  }

  const course = getCourseForLesson(comment.lessonId);
  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  // Replying as the course's voice — so it must be Staff on this course.
  const access = await requireStaff(request, course.courseId);

  try {
    createComment(
      access.userId!,
      comment.lessonId,
      comment.id,
      parsed.data.body
    );
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  return { ok: true };
}

type UnansweredComment = Awaited<
  ReturnType<typeof loader>
>["unansweredComments"][number];

function UnansweredCommentCard({ comment }: { comment: UnansweredComment }) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [body, setBody] = useState("");
  const daysUnanswered = daysSince(comment.createdAt);
  const stale = daysUnanswered >= STALE_AFTER_DAYS;
  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.error) {
      toast.error(fetcher.data.error);
    } else if (fetcher.data.ok) {
      setBody("");
      toast.success("Reply posted.");
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {comment.courseTitle}
          </span>
          <span>/</span>
          <span>{comment.lessonTitle}</span>
          <Link
            to={`/courses/${comment.courseSlug}/lessons/${comment.lessonId}`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            Open lesson
          </Link>

          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
              stale
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
            )}
            suppressHydrationWarning
          >
            {daysUnanswered === 0
              ? "Unanswered today"
              : `Unanswered for ${pluralize(daysUnanswered, "day")}`}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <UserAvatar
            name={comment.authorName}
            avatarUrl={comment.authorAvatarUrl}
            className="size-8 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{comment.authorName}</span>
              <span
                className="text-xs text-muted-foreground"
                suppressHydrationWarning
              >
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>
            <div
              className="prose prose-sm prose-neutral dark:prose-invert mt-1 max-w-none"
              dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
            />
          </div>
        </div>

        <fetcher.Form method="post" className="mt-4 space-y-2">
          <input type="hidden" name="intent" value="reply" />
          <input type="hidden" name="commentId" value={comment.id} />

          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Reply to this comment..."
            rows={3}
            aria-label={`Reply to ${comment.authorName}`}
          />

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={
                submitting ||
                body.trim().length === 0 ||
                body.length > MAX_COMMENT_LENGTH
              }
            >
              {submitting ? "Posting..." : "Post reply"}
            </Button>
            <span
              className={cn(
                "ml-auto text-xs",
                body.length > MAX_COMMENT_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {body.length} / {MAX_COMMENT_LENGTH}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

export default function InstructorComments({
  loaderData,
}: Route.ComponentProps) {
  const { unansweredComments, isAdmin } = loaderData;

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        {/* /instructor is instructor-only, so admins go back to their own list. */}
        <Link
          to={isAdmin ? "/admin/courses" : "/instructor"}
          className="hover:text-foreground"
        >
          {isAdmin ? "Manage courses" : "My courses"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Comments</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Unanswered comments</h1>
        <p className="mt-1 text-muted-foreground">
          {isAdmin
            ? "Comments across every course that no staff member has replied to yet."
            : "Comments on your courses that you haven't replied to yet."}{" "}
          Replying here marks them answered.
        </p>
      </div>

      {unansweredComments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 size-12 text-green-600" />
            <p className="font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every comment on your courses has been answered.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {unansweredComments.map((comment) => (
            <UnansweredCommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-8">
      <Skeleton className="mb-6 h-4 w-40" />
      <Skeleton className="mb-2 h-9 w-72" />
      <Skeleton className="mb-6 h-4 w-96" />
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading your comments.";
  let showLogIn = false;

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Log in required";
      showLogIn = true;
      message =
        typeof error.data === "string" ? error.data : "Log in to continue.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have access to this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          {showLogIn && (
            <Link to="/login">
              <Button>Log in</Button>
            </Link>
          )}
          <Link to="/instructor">
            <Button>My courses</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
