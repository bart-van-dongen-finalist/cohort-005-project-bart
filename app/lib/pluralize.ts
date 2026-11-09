/**
 * A count with its noun in the right form — "1 lesson", "0 lessons",
 * "3 quizzes". Pass `plural` when adding an "s" is wrong.
 *
 * The number is formatted as en-US so the server and the client render the
 * same string whatever the visitor's locale.
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string = `${singular}s`
): string {
  const noun = count === 1 ? singular : plural;
  return `${count.toLocaleString("en-US")} ${noun}`;
}
