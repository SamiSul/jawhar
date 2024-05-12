import { Injectable, inject, signal } from '@angular/core';
import { GithubService } from '../github/github.service';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
//@ts-ignore
import customHeadingId from 'marked-custom-heading-id';
import { Post } from './post.model';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private readonly ghService = inject(GithubService);
  private readonly marked = new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang, _) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
    }),
  )
    .use({
      gfm: true,
      breaks: true,
    })
    .use(customHeadingId());

  private readonly $posts = signal<Post[]>([]);

  async getParsedPosts(): Promise<Post[]> {
    const _currPosts = this.$posts();
    if (_currPosts.length) return _currPosts;

    const _files = this.ghService.$gistFiles();
    if (!_files) return [];

    const _rawPosts = await Promise.all(
      _files.map((p) => this.marked.parse(p)),
    );

    const _parsed = (
      await Promise.all(_rawPosts.map((p) => this.parsePost(p)))
    ).filter((p): p is Post => !!p);

    this.$posts.set(_parsed);
    return [];
  }

  async refreshPosts(): Promise<Post[]> {
    this.$posts.set([]);
    return await this.getParsedPosts();
  }

  private async parsePost(post: string): Promise<Post | undefined> {
    const _postInHTML = await this.marked.parse(post);

    const html = new DOMParser().parseFromString(_postInHTML, 'text/html');

    const _title = html.getElementById('title');
    const _tags = html.getElementById('tags');

    const _titleContent = _title?.textContent;
    const _tagsContent = _tags?.textContent?.split(',');

    if (!_titleContent || !_tagsContent) return;

    _title.remove();
    _tags?.remove();

    return {
      title: _titleContent,
      content: html.body.innerHTML,
      tags: _tagsContent,
    };
  }
}
