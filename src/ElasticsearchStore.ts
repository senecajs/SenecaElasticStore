// SenecaElasticsearchStore.ts

import { Client } from '@elastic/elasticsearch';

type ElasticsearchStoreOptions = {
  debug: boolean;
  map?: any;
  index: {
    prefix: string;
    suffix: string;
    map: Record<string, string>;
    exact: string;
  };
  field: {
    zone: { name: string };
    base: { name: string };
    name: { name: string };
    vector: { name: string };
  };
  cmd: {
    list: {
      size: number;
    };
  };
  elasticsearch: {
    node: string;
  };
};

function ElasticsearchStore(this: any, options: ElasticsearchStoreOptions) {
  const seneca: any = this;
  console.log("Initializing ElasticsearchStore with options:", options); // Debug output

  const init = seneca.export('entity/init')

  let client = new Client({
    node: options.elasticsearch.node
  });

  let desc: any = 'ElasticsearchStore'

  let store = {
    name: 'ElasticsearchStore',

    save: async function (msg: any, reply: any) {
      const ent = msg.ent;
      const index = resolveIndex(ent, options);
      const body = ent.data$(false);

      // Mapping fields according to the schema
      const document = {
        ...body,
        vector: body.vector 
      };

      try {
        const { body: result } = await client.index({
          index,
          body: document,
          id: ent.id || undefined,
          refresh: 'wait_for'
        });
        ent.id = result._id;
        reply(null, ent);
      } catch (err) {
        reply(err);
      }
    },

    load: async function (this: any, msg: any, reply: any) {
      // console.log("Loading document with ID:", msg); // Debug output
      const ent = msg.ent
      // console.log("Entity on load", ent); // Debug output
      const index = resolveIndex(msg.ent, options);
      try {
        const { body } = await client.get({
          index,
          id: msg.q.id
        });
        if (body.found) {
            ent.data$(body._source)
            ent.id = body._id
            reply(ent)
        } else {
          reply(null, null);
        }
      } catch (err: any) {
        console.error("Failed to load document:", err);
        reply(err);
      }
    },
    

    list: async function (this: any, msg: any, reply: any) {
      console.log("Listing documents...");
      console.log("Message:", msg);
      const index = resolveIndex(msg.ent, options);
      const vectorFieldName = options.field && options.field.vector ? options.field.vector.name : 'defaultVectorFieldName';
    
      const query = {
        bool: {
          must: [{ match_all: {} }],
          filter: [{ exists: { field: vectorFieldName } }]
        }
      };

      
      if (!msg.q) {
        return reply([])
      }
    
      try {
        const { body } = await client.search({
          index,
          body: {
            query: query
          }
        });
        const results = body.hits.hits.map((hit: any) => ({
          id: hit._id,
          ...hit._source
        }));
        reply(null, results);
      } catch (err) {
        console.error("Error in listing documents:", err);
        reply(err);
      }
    },
    
    

    remove(this: any, msg: any, reply: any) {
      const ent = msg.ent;
      const index = resolveIndex(ent, options);
      client.delete({
        index,
        id: ent.id,
        refresh: 'wait_for'
      }, (err: any) => {
        if (err) {
          console.error("Error in removing document:", err);
          reply(err);
        } else {
          reply(null, ent);
        }
      });
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

  };

  init(seneca, options, store)
  // desc = meta.desc

  // seneca.prepare(async function () {
  //   try {
  //     // Perform async initialization tasks, e.g., check Elasticsearch cluster health
  //     const health = await client.cluster.health();
  //     console.log("Elasticsearch cluster health:", health);
  //     // Further client configuration or setup can go here
  //   } catch (error) {
  //     console.error("Failed to initialize Elasticsearch client:", error);
  //   }
  // });

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

function resolveIndex(ent: any, options: ElasticsearchStoreOptions): string {
  let index = options.index.exact || ent.canon$({ string: true });
  console.log("Resolving index to:", index); // Debug output
  return index;
}


export default ElasticsearchStore;
