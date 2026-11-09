import { redirect } from "react-router";
import type { Route } from "./+types/instructor.questions";

// The unanswered-comments queue used to live at /instructor/questions.
// Keep old bookmarks and links working by sending them to its new URL.
export function loader({ request }: Route.LoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(`/instructor/comments${search}`, 301);
}
