/* Copyright © 2024 Seneca Project Contributors, MIT License. */

require('dotenv').config({ path: '../.env.local' })
// console.log(process.env) // remove this


import Seneca from 'seneca'
// import SenecaMsgTest from 'seneca-msg-test'
// import { Maintain } from '@seneca/maintain'

import ElasticsearchStoreDoc from '../src/ElasticsearchStoreDoc'
import ElasticsearchStore from '../src/ElasticsearchStore'


describe('ElasticsearchStore', () => {
  test('load-plugin', async () => {
    expect(ElasticsearchStore).toBeDefined()
    expect(ElasticsearchStoreDoc).toBeDefined()

    const seneca = Seneca({ legacy: false })
      .test()
      .use('promisify')
      .use('entity')
      .use(ElasticsearchStore)
    await seneca.ready()

    expect(seneca.export('ElasticsearchStore/native')).toBeDefined()
  })


  test('utils.resolveIndex', () => {
    const utils = ElasticsearchStore['utils']
    const resolveIndex = utils.resolveIndex
    const seneca = makeSeneca()
    const ent0 = seneca.make('foo')
    const ent1 = seneca.make('foo/bar')

    expect(resolveIndex(ent0, { index: {} })).toEqual('foo')
    expect(resolveIndex(ent0, { index: { exact: 'qaz' } })).toEqual('qaz')

    expect(resolveIndex(ent1, { index: {} })).toEqual('foo_bar')
    expect(resolveIndex(ent1, { index: { prefix: 'p0', suffix: 's0' } })).toEqual('p0_foo_bar_s0')
    expect(resolveIndex(ent1, {
      index: { map: { '-/foo/bar': 'FOOBAR' }, prefix: 'p0', suffix: 's0' }
    }))
      .toEqual('FOOBAR')
  }, 22222)


  test('insert-remove', async () => {
    const seneca = await makeSeneca()
    await seneca.ready()


    // no query params means no results
    const list0 = await seneca.entity('foo/chunk').list$()
    console.log('list0ddddddddddddddddddddddddddddddddddddddddddddddddddddddd')
    expect(0 === list0.length)

    const list1 = await seneca.entity('foo/chunk').list$({ test: 'insert-remove' })
    console.log(list1)

    let ent0: any

    if (0 === list1.length) {
      ent0 = await seneca.entity('foo/chunk')
        .make$()
        .data$({
          test: 'insert-remove',
          text: 't01',
          vector: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          directive$: { vector$: true },
        })
        .save$()
      expect(ent0).toMatchObject({ test: 'insert-remove' })
      await new Promise((r) => setTimeout(r, 2222))
    }
    else {
      ent0 = list1[0]
    }

    await seneca.entity('foo/chunk').remove$(ent0.id)

    await new Promise((r) => setTimeout(r, 2222))

    const list2 = await seneca.entity('foo/chunk').list$({ test: 'insert-remove' })
    // console.log(list2)
    expect(list2.filter((n: any) => n.id === ent0.id)).toEqual([])
  }, 22222)


  test('vector-cat', async () => {
    const seneca = await makeSeneca()
    await seneca.ready()

    // const list0 = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })
    // console.log('list0', list0)

    // NOT AVAILABLE ON AWS
    // await seneca.entity('foo/chunk').remove$({ all$: true, test: 'vector-cat' })

    const list1 = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })
    // console.log('list1', list1)

    /*
    for (let i = 0; i < list1.length; i++) {
      await list1[i].remove$()
    }

    await new Promise((r) => setTimeout(r, 2222))

    const list1r = await seneca.entity('foo/chunk').list$({ test: 'vector-cat' })
    // console.log('list1r', list1r)
    */

    if (!list1.find((n: any) => 'code0' === n.code)) {
      await seneca.entity('foo/chunk')
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
      await seneca.entity('foo/chunk')
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
    // console.log('list2', list2.map((n: any) => ({ ...n })))
    expect(1 < list2.length).toEqual(true)

    const list3 = await seneca.entity('foo/chunk').list$({
      directive$: { vector$: { k: 2 } },
      vector: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      code: 'code0'
    })
    // console.log('list3', list3.map((n: any) => ({ ...n })))
    expect(list3.length).toEqual(1)

  }, 22222)



})


function makeSeneca() {
  return Seneca({ legacy: false })
  .test() // Test mode to suppress unnecessary logs
  .use('promisify') // For using promises with Seneca actions
  .use('entity') // Basic entity handling
  .use('..', { // Use your custom ElasticsearchStore plugin
    map: {
      'foo/chunk': '*',
    },
    elasticsearch: {
      // node: process.env.ELASTICSEARCH_NODE // Ensure this matches your .env settings
      node: 'http://localhost:9200'
    },
    index: {
      exact: 'vector-index', // Specify the exact index or use env var
    },
    field: {
      vector: { name: 'vector' } // Correctly define this according to your Elasticsearch schema
    }
  });
}