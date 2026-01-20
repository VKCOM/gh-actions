import * as github from '@actions/github';

import { getPullRequestNumber } from './shared.ts';

/**
 * Префикс комментария, для его обнаружения
 */
const commentPrefix = '<!--GitHub Comment Builder-->\n';

/**
 * Сборщик комментария для PR-а. Создает или редактирует комментарий.
 */
export class GitHubCommentBuilder {
  public message = commentPrefix;
  private readonly prNumber: number;
  private readonly gh: ReturnType<typeof github.getOctokit>;

  public constructor(gh: ReturnType<typeof github.getOctokit>, prNumber?: number) {
    this.gh = gh;
    this.prNumber = typeof prNumber === 'number' ? prNumber : getPullRequestNumber();
  }

  /**
   * Добавляет текст к комментарию.
   */
  public add(text: string) {
    this.message += `${text}\n\n`;
  }

  /**
   * Пытаемся найти уже существующий комментарий
   */
  private async getCommentId() {
    const comments = await this.gh.rest.issues.listComments({
      ...github.context.repo,
      issue_number: this.prNumber,
    });

    const comment = comments.data.find((item) => item.body?.startsWith(commentPrefix));

    return comment?.id;
  }

  /**
   * Создает или редактирует комментарий
   */
  public async write() {
    const comment_id = await this.getCommentId();

    // Если сообщение пустое, то удаляем старый комментарий
    if (this.message === commentPrefix) {
      if (comment_id) {
        await this.gh.rest.issues.deleteComment({
          ...github.context.repo,
          comment_id,
        });
      }

      return;
    }

    // Если в PR-е есть комментарий, редактируем его
    if (comment_id) {
      await this.gh.rest.issues.updateComment({
        ...github.context.repo,
        comment_id,
        body: this.message,
      });
      return;
    }

    await this.gh.rest.issues.createComment({
      ...github.context.repo,
      issue_number: this.prNumber,
      body: this.message,
    });
  }
}
