// SenecaElasticSearchStore.ts

import { Client } from '@elastic/elasticsearch'

type ElasticSearchStoreOptions = {
  debug: boolean
  map?: any
  index: {
    prefix: string
    suffix: string
    map: Record<string, string>
    exact: string
  }
  field: {
    zone: { name: string }
    base: { name: string }
    name: { name: string }
    vector: { name: string }
  }
  cmd: {
    list: {
      size: number
    }
  }
  elasticsearch: {
    node: string
  }
  auth?: {
    username: string
    password: string
  }
}

function ElasticSearchStore(this: any, options: ElasticSearchStoreOptions) {
  const seneca: any = this

  const init = seneca.export('entity/init')

  let client: any

  let desc: any = 'ElasticSearchStore'

  let store = {
    name: 'ElasticSearchStore',

    save: async function (msg: any, reply: any) {
      const ent = msg.ent
      const index = resolveIndex(ent, options)
      const body = ent.data$(false)

      const document = {
        ...body,
        vector: body.vector,
      }

      try {
        const result = await client.index({
          index,
          document,
          id: ent.id || undefined,
          refresh: 'wait_for',
        })

        if (result && result._id) {
          ent.id = result._id
          reply(null, ent)
        } else {
          reply(new Error('Document creation/update failed: missing _id'))
        }
      } catch (err) {
        console.error('Error in save function:', err)
        reply(err)
      }
    },

    load: async function (this: any, msg: any, reply: any) {
      const ent = msg.ent
      const index = resolveIndex(msg.ent, options)

      try {
        const response = await client.get({
          index,
          id: msg.q.id,
        })

        if (response && response.found) {
          ent.data$(response._source)
          ent.id = response._id
          reply(null, ent)
        } else {
          reply(null, null)
        }
      } catch (err: any) {
        console.error('Failed to load document:', err)
        reply(err)
      }
    },

    list: async function (this: any, msg: any, reply: any) {
      let q = msg.q
      let cq = seneca.util.clean(q) // removes all properties ending in '$'
      let ent = msg.ent
      const index = resolveIndex(msg.ent, options)

      const query = buildQuery(cq)

      // Check if the query includes a kNN search directive
      if (isKnnSearch(q)) {
        try {
          const knnResults = await executeKnnSearch(client, index, q, query, ent)
          reply(null, knnResults)
        } catch (err) {
          console.error('Error in kNN search:', err)
          reply(err)
        }
      } else {
        try {
          const searchResults = await executeStandardSearch(
            client,
            index,
            query,
            ent
          )
          reply(null, searchResults)
        } catch (err) {
          console.error('Error in listing documents:', err)
          reply(err)
        }
      }
    },

    remove: async function (this: any, msg: any, reply: any) {
      const ent = msg.ent
      const idToBeRemoved = msg.q.id
      const index = resolveIndex(ent, options)

      try {
        await client.delete({
          index,
          id: idToBeRemoved,
          refresh: 'wait_for',
        })
        reply(null, ent)
      } catch (err) {
        console.error('Error in removing document:', err)
        reply(err)
      }
    },

    close: function (this: any, _msg: any, reply: any) {
      this.log.debug('close', desc)
      reply()
    },

    native: function (this: any, _msg: any, reply: any) {
      reply(null, {
        client: () => client,
      })
    },
  }

  init(seneca, options, store)
  // desc = meta.desc

  seneca.prepare(async function () {
    try {
      client = new Client({
        node: options.elasticsearch.node,
        auth: options.auth,
      })
    } catch (error) {
      console.error('Failed to initialize ElasticSearch client:', error)
    }
  })

  return {
    name: store.name,
    // tag: meta.tag,
    exportmap: {
      native: () => {
        return { client }
      },
    },
  }
}

function resolveIndex(ent: any, options: ElasticSearchStoreOptions): string {
  let indexOpts = options.index
  if ('' != indexOpts.exact && null != indexOpts.exact) {
    return indexOpts.exact
  }

  let canonstr = ent.canon$({ string: true })
  indexOpts.map = indexOpts.map || {}
  if ('' != indexOpts.map[canonstr] && null != indexOpts.map[canonstr]) {
    return indexOpts.map[canonstr]
  }

  let prefix = indexOpts.prefix
  let suffix = indexOpts.suffix

  prefix = '' == prefix || null == prefix ? '' : prefix + '_'
  suffix = '' == suffix || null == suffix ? '' : '_' + suffix

  let infix = ent
    .canon$({ string: true })
    .replace(/-\//g, '')
    .replace(/\//g, '_')

  return prefix + infix + suffix
}

function buildQuery(cleanedQuery: any) {
  const boolQuery: any = { must: [], filter: [] }
  Object.keys(cleanedQuery).forEach((key) => {
    if ('vector' !== key) {
      boolQuery.filter.push({ term: { [key]: cleanedQuery[key] } })
    }
  })
  return { bool: boolQuery }
}

function isKnnSearch(query: any) {
  return !!(query.directive$ && query.directive$.vector$ && query.vector)
}

async function executeKnnSearch(client: any, index: any, q: any, query: any, ent: any) {
  const knnResponse = await client.knnSearch({
    index,
    knn: {
      field: 'vector',
      query_vector: q.vector,
      k: q.directive$.vector$.k || 10,
      num_candidates: 100,
    },
    filter: query.bool.filter.length ? query : undefined,
  })

    const { hits } = knnResponse
    return hits.hits.map((hit: any) => {
      let item = ent.make$().data$(hit._source)
      item.custom$ = { score: hit._score }
      item.id = hit._id
      return item
    })
    
}

async function executeStandardSearch(client: any, index: any, query: any, ent: any) {
  const response = await client.search({ index, query })
  const { hits } = response

  return hits.hits.map((hit: any) => {
    let item = ent.make$().data$(hit._source)
    item.custom$ = { score: hit._score }
    item.id = hit._id
    return item
  })
}

// Default options.
const defaults: ElasticSearchStoreOptions = {
  debug: false,
  map: {},
  index: {
    prefix: '',
    suffix: '',
    map: {},
    exact: '',
  },
  field: {
    zone: { name: 'zone' },
    base: { name: 'base' },
    name: { name: 'name' },
    vector: { name: 'vector' },
  },
  cmd: {
    list: {
      size: 11,
    },
  },
  elasticsearch: {
    node: 'http://localhost:9200',
  },
}

Object.assign(ElasticSearchStore, {
  defaults,
  utils: { resolveIndex, buildQuery, isKnnSearch, executeKnnSearch, executeStandardSearch },
})

export default ElasticSearchStore

if ('undefined' !== typeof module) {
  module.exports = ElasticSearchStore
}
