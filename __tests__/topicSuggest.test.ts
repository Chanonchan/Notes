import { buildSuggestIndex, tokenize } from '../services/topicSuggest';

describe('tokenize', () => {
  it('lowercases, strips accents, stopwords, short words and numbers', () => {
    expect(tokenize('Fixed the Café LOGIN bug #42 on API')).toEqual(['fixed', 'cafe', 'login', 'bug', 'api']);
  });
});

describe('topic suggestion', () => {
  const index = buildSuggestIndex([
    { topicId: 1, name: 'Website redesign', texts: ['Homepage hero layout', 'Navbar spacing fixes', 'Homepage footer'] },
    { topicId: 2, name: 'Hiring', texts: ['Interview frontend candidate', 'Reviewed resumes'] },
    { topicId: 3, name: 'Infra', texts: ['Fixed deploy pipeline', 'Fixed staging certs'] },
  ]);

  it('suggests the topic whose past entries share words', () => {
    expect(index.suggest('Tweak homepage colors')[0]?.topicId).toBe(1);
    expect(index.suggest('Second interview with candidate')[0]?.topicId).toBe(2);
  });

  it('matches the topic name', () => {
    expect(index.suggest('website copy review')[0]?.topicId).toBe(1);
  });

  it('matches a word while it is still being typed', () => {
    expect(index.suggest('pipel')[0]?.topicId).toBe(3);
  });

  it('suggests nothing when there is no overlap', () => {
    expect(index.suggest('Lunch with team')).toEqual([]);
    expect(index.suggest('')).toEqual([]);
  });
});
