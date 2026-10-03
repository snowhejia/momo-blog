import { articleDateSchema, formatArticleDate } from "../../../shared/articles";

export function ArticleTime({
  date,
  timeZone,
}: {
  date: string;
  timeZone: string;
}) {
  const valid = articleDateSchema.safeParse(date).success;
  return (
    <time
      className="article-time"
      dateTime={valid ? date : undefined}
      title={
        valid ? `${formatArticleDate(date, timeZone)} · ${timeZone}` : undefined
      }
    >
      {formatArticleDate(date, timeZone)}
    </time>
  );
}
