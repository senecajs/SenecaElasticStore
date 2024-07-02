/* Copyright © 2024 Seneca Project Contributors, MIT License. */

require('dotenv').config({ path: '../.env.local' })
import Seneca from 'seneca'

import ElasticSearchStoreDoc from '../src/ElasticSearchStoreDoc'
import ElasticSearchStore from '../src/ElasticSearchStore'

describe('ElasticsearchStore', () => {

  test('load-plugin', async () => {
    expect(ElasticSearchStore).toBeDefined()
    expect(ElasticSearchStoreDoc).toBeDefined()

    const seneca = Seneca({ legacy: false })
      .test()
      .use('promisify')
      .use('entity')
      .use(ElasticSearchStore)
    await seneca.ready()

    expect(seneca.export('ElasticSearchStore/native')).toBeDefined()
  })

  test('utils.resolveIndex', () => {
    const utils = ElasticSearchStore['utils']
    const resolveIndex = utils.resolveIndex
    const seneca = makeSeneca()
    const ent0 = seneca.make('foo')
    const ent1 = seneca.make('foo/bar')

    expect(resolveIndex(ent0, { index: {} })).toEqual('foo')
    expect(resolveIndex(ent0, { index: { exact: 'qaz' } })).toEqual('qaz')

    expect(resolveIndex(ent1, { index: {} })).toEqual('foo_bar')
    expect(
      resolveIndex(ent1, { index: { prefix: 'p0', suffix: 's0' } }),
    ).toEqual('p0_foo_bar_s0')
    expect(
      resolveIndex(ent1, {
        index: { map: { '-/foo/bar': 'FOOBAR' }, prefix: 'p0', suffix: 's0' },
      }),
    ).toEqual('FOOBAR')
  }, 22222)

  test('insert-remove', async () => {
    const seneca = await makeSeneca()
    await seneca.ready()

    clearData(seneca) // Clear all the data before the test

    // no query params means no results
    const list0 = await seneca.entity('foo/chunk').list$()
    expect(0 === list0.length)

    const list1 = await seneca
      .entity('foo/chunk')
      .list$({ test: 'insert-remove' })

    let ent0: any

    if (0 === list1.length) {
      ent0 = await seneca
        .entity('foo/chunk')
        .make$()
        .data$({
          test: 'insert-remove',
          text: 't01',
          vector: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          directive$: { vector$: true },
        })
        .save$()
      expect(ent0).toMatchObject({ test: 'insert-remove', text: 't01'})
      await new Promise((r) => setTimeout(r, 2222))
    } else {
      ent0 = list1[0]
    }

    await seneca.entity('foo/chunk').remove$(ent0.id)

    await new Promise((r) => setTimeout(r, 2222))

    const list2 = await seneca
      .entity('foo/chunk')
      .list$({ test: 'insert-remove' })
    expect(list2.filter((n: any) => n.id === ent0.id)).toEqual([])
  }, 22222)

  test('vector-cat', async () => {
    const seneca = await makeSeneca()
    await seneca.ready()

    const list1 = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })

    if (!list1.find((n: any) => 'code0' === n.code)) {
      await seneca
        .entity('foo/chunk')
        .make$()
        .data$({
          code: 'code0',
          test: 'vector-cat',
          text: 't01',
          vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
          directive$: { vector$: true },
        })
        .save$()
    }

    if (!list1.find((n: any) => 'code1' === n.code)) {
      await seneca
        .entity('foo/chunk')
        .make$()
        .data$({
          code: 'code1',
          test: 'vector-cat',
          text: 't01',
          vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
          directive$: { vector$: true },
        })
        .save$()
    }

    await new Promise((r) => setTimeout(r, 2222))

    const list2 = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    })
    expect(1 < list2.length).toEqual(true)

    const list3 = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      code: 'code0',
    })
    expect(list3.length).toEqual(1)
  }, 22222)

  test('knn-search', async () => {
    const seneca = await makeSeneca();
    await seneca.ready();

    await clearData(seneca); // Clear all the data before the test
  
    await createChunk(seneca, 'code0', [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    await createChunk(seneca, 'code1', [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
  
    await new Promise((r) => setTimeout(r, 2222));
  
    // Perform the kNN search
    const list = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
      test: 'knn-search'
    });
  
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((item: any) => 'code' === item.code || 'code1' === item.code)).toEqual(true);
  }, 22222);

  test('knn-search-sparse-vector', async () => {
    const seneca = await makeSeneca();
    await seneca.ready();
  
    await clearData(seneca); // Clear all the data before the test
  
    await createChunk(seneca, 'code0', [0.1, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.1]);
    await createChunk(seneca, 'code1', [0.0, 0.2, 0.0, 0.2, 0.0, 0.2, 0.0, 0.2]);
  
    await new Promise((r) => setTimeout(r, 2222));
  
    // Perform the kNN search with a sparse vector
    const list = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.1, 0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0],
      test: 'knn-search'
    });
  
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((item: any) => 'code' === item.code || 'code1' === item.code)).toEqual(true);
  }, 22222);

  test('knn-search-distant-vector', async () => {
    const seneca = await makeSeneca();
    await seneca.ready();
  
    await clearData(seneca); // Clear all the data before the test
    
    await createChunk(seneca, 'code0', [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    await createChunk(seneca, 'code1', [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
    
    await new Promise((r) => setTimeout(r, 2222));
    
    // Perform the kNN search with a far away vector
    const list = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [-10, -10, -10, -10, -10, -10, -10, -10],
      test: 'knn-search',
    });
    
    expect(list.length).toEqual(2);
  }, 22222);

  test('knn-search-list-reponse-object-check', async () => {
    const seneca = await makeSeneca();
    await seneca.ready();
  
    await clearData(seneca); // Clear all the data before the test
    
    await createChunk(seneca, 'code0', [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    
    await new Promise((r) => setTimeout(r, 2222));
    
    // Perform the kNN search with a far away vector
    const list = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
      test: 'knn-search',
    });
    
    expect(list.length).toEqual(1);
  }, 22222);

  test('knn-search-load-response-object-check', async () => {
    const seneca = await makeSeneca();
    await seneca.ready();
  
    await clearData(seneca);
    
    const code0 = await createChunk(seneca, 'code0', [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);

    await new Promise((r) => setTimeout(r, 2222));

    // Perform the kNN search using load$
    const ent = await seneca.entity('foo/chunk').load$({ id: code0.id, test: 'knn-search'});
    expect(ent).toMatchObject({ code: 'code0', test: 'knn-search', text: 't01', id: code0.id });
  }, 22222);
  
})

describe('ElasticSearchStore Utilities', () => {

  const utils = ElasticSearchStore['utils'];

  describe('resolveIndex', () => {
    const resolveIndex = utils.resolveIndex;

    test('should resolve index correctly', () => {
      const seneca = makeSeneca();
      const ent0 = seneca.make('foo');
      const ent1 = seneca.make('foo/bar');

      expect(resolveIndex(ent0, { index: {} })).toEqual('foo');
      expect(resolveIndex(ent0, { index: { exact: 'qaz' } })).toEqual('qaz');
      expect(resolveIndex(ent1, { index: {} })).toEqual('foo_bar');
      expect(resolveIndex(ent1, { index: { prefix: 'p0', suffix: 's0' } })).toEqual('p0_foo_bar_s0');
      expect(resolveIndex(ent1, {
        index: { map: { '-/foo/bar': 'FOOBAR' }, prefix: 'p0', suffix: 's0' },
      })).toEqual('FOOBAR');
    });
  });

  describe('buildQuery', () => {
    const buildQuery = utils.buildQuery;

    test('should build a query object excluding the vector key', () => {
      const cleanedQuery = {
        field1: 'value1',
        field2: 'value2',
        vector: [0.1, 0.2],
      };
      const expectedQuery = {
        bool: {
          must: [],
          filter: [
            { term: { field1: 'value1' } },
            { term: { field2: 'value2' } },
          ],
        },
      };
      const result = buildQuery(cleanedQuery);
      expect(result).toEqual(expectedQuery);
    });
  });

  describe('isKnnSearch', () => {
    const isKnnSearch = utils.isKnnSearch;

    test('should return true if query contains directive$ and vector$', () => {
      const query = {
        directive$: { vector$: { k: 10 } },
        vector: [0.1, 0.2],
      };
      const result = isKnnSearch(query);
      expect(result).toBe(true);
    });

    test('should return false if query does not contain directive$ or vector$', () => {
      const query = {
        directive$: {},
        vector: [0.1, 0.2],
      };
      const result = isKnnSearch(query);
      expect(result).toBe(false);
    });
  });

});

async function clearData(seneca: any) {
  const list = await seneca.entity('foo/chunk').list$()
  for (const doc of list) {
    await seneca.entity('foo/chunk').remove$(doc.id)
  }
}

async function createChunk(seneca: any, code: string, vector: number[]) {
  const chunk = await seneca.entity('foo/chunk').make$().data$({
    code,
    test: 'knn-search',
    text: 't01',
    vector,
    directive$: { vector$: true },
  }).save$();

  return chunk;
}

function makeSeneca() {
  return Seneca({ legacy: false })
    .test()
    .use('promisify')
    .use('entity')
    .use('..', {
      map: {
        'foo/chunk': '*',
      },
      elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE,
      },
      index: {
        exact: 'vector-index',
      },
      field: {
        vector: { name: 'vector' },
      },
    })
}