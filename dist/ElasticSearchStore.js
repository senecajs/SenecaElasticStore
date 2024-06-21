"use strict";
// SenecaElasticSearchStore.ts
Object.defineProperty(exports, "__esModule", { value: true });
const elasticsearch_1 = require("@elastic/elasticsearch");
function ElasticSearchStore(options) {
    const seneca = this;
    // console.log("Initializing ElasticSearchStore with options:", options); // Debug output
    const init = seneca.export('entity/init');
    let client;
    let desc = 'ElasticSearchStore';
    let store = {
        name: 'ElasticSearchStore',
        save: async function (msg, reply) {
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
            }
            catch (err) {
                reply(err);
            }
        },
        load: async function (msg, reply) {
            // console.log("Loading document with ID:", msg); // Debug output
            const ent = msg.ent;
            // console.log("Entity on load", ent); // Debug output
            const index = resolveIndex(msg.ent, options);
            try {
                const { body } = await client.get({
                    index,
                    id: msg.q.id
                });
                if (body.found) {
                    ent.data$(body._source);
                    ent.id = body._id;
                    reply(ent);
                }
                else {
                    reply(null, null);
                }
            }
            catch (err) {
                console.error("Failed to load document:", err);
                reply(err);
            }
        },
        list: async function (msg, reply) {
            const index = resolveIndex(msg.ent, options);
            const vectorFieldName = options.field && options.field.vector ? options.field.vector.name : 'defaultVectorFieldName';
            let query = { bool: { must: [], filter: [] } };
            console.log("Query:", msg.q);
            if (msg.q) {
                Object.keys(msg.q).forEach(key => {
                    if (key !== 'directive$' && key !== 'vector') {
                        query.bool.filter.push({ term: { [key]: msg.q[key] } });
                    }
                });
            }
            if (msg.directive$ && msg.directive$.vector$) {
                query.bool.must.push({
                    knn: {
                        field: vectorFieldName,
                        query_vector: msg.vector,
                        k: msg.directive$.vector$.k,
                        num_candidates: 100
                    }
                });
            }
            else {
                query.bool.must.push({ match_all: {} });
            }
            try {
                const { body } = await client.search({
                    index,
                    body: { query }
                });
                const results = body.hits.hits.map((hit) => ({
                    id: hit._id,
                    ...hit._source
                }));
                reply(null, results);
            }
            catch (err) {
                console.error("Error in listing documents:", err);
                reply(err);
            }
        },
        // list: async function (this: any, msg: any, reply: any) {
        //   const index = resolveIndex(msg.ent, options);
        //   const vectorFieldName = options.field && options.field.vector ? options.field.vector.name : 'defaultVectorFieldName';
        //   let query: any = { bool: { must: [], filter: [] } };
        //   if (msg.q) {
        //     Object.keys(msg.q).forEach(key => {
        //       if (key !== 'directive$' && key !== 'vector') {
        //         query.bool.filter.push({ term: { [key]: msg.q[key] } });
        //       }
        //     });
        //   }
        //   if (msg.directive$ && msg.directive$.vector$) {
        //     query.bool.must.push({
        //       knn: {
        //         field: vectorFieldName,
        //         query_vector: msg.vector,
        //         k: msg.directive$.vector$.k,
        //         num_candidates: 100
        //       }
        //     });
        //   } else {
        //     query.bool.must.push({ match_all: {} });
        //   }
        //   try {
        //     const { body } = await client.search({
        //       index,
        //       body: { query }
        //     });
        //     const results = body.hits.hits.map((hit: any) => ({
        //       id: hit._id,
        //       ...hit._source
        //     }));
        //     reply(null, results);
        //   } catch (err) {
        //     console.error("Error in listing documents:", err);
        //     reply(err);
        //   }
        // },         
        remove(msg, reply) {
            const ent = msg.ent;
            const idToBeRemoved = msg.q.id;
            // console.log("Message remove:", msg);
            const index = resolveIndex(ent, options);
            client.delete({
                index,
                id: idToBeRemoved,
                refresh: 'wait_for'
            }, (err) => {
                if (err) {
                    console.error("Error in removing document:", err);
                    reply(err);
                }
                else {
                    reply(null, ent);
                }
            });
        },
        close: function (_msg, reply) {
            this.log.debug('close', desc);
            reply();
        },
        native: function (_msg, reply) {
            reply(null, {
                client: () => client,
            });
        },
    };
    init(seneca, options, store);
    // desc = meta.desc
    seneca.prepare(async function () {
        try {
            client = new elasticsearch_1.Client({
                node: options.elasticsearch.node
            });
        }
        catch (error) {
            console.error("Failed to initialize ElasticSearch client:", error);
        }
    });
    return {
        name: store.name,
        // tag: meta.tag,
        exportmap: {
            native: () => {
                return { client };
            },
        },
    };
}
function resolveIndex(ent, options) {
    let indexOpts = options.index;
    if ('' != indexOpts.exact && null != indexOpts.exact) {
        return indexOpts.exact;
    }
    let canonstr = ent.canon$({ string: true });
    indexOpts.map = indexOpts.map || {};
    if ('' != indexOpts.map[canonstr] && null != indexOpts.map[canonstr]) {
        return indexOpts.map[canonstr];
    }
    let prefix = indexOpts.prefix;
    let suffix = indexOpts.suffix;
    prefix = '' == prefix || null == prefix ? '' : prefix + '_';
    suffix = '' == suffix || null == suffix ? '' : '_' + suffix;
    // TOOD: need ent.canon$({ external: true }) : foo/bar -> foo_bar
    let infix = ent
        .canon$({ string: true })
        .replace(/-\//g, '')
        .replace(/\//g, '_');
    return prefix + infix + suffix;
}
// Default options.
const defaults = {
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
    }
};
Object.assign(ElasticSearchStore, {
    defaults,
    utils: { resolveIndex },
});
exports.default = ElasticSearchStore;
if ('undefined' !== typeof module) {
    module.exports = ElasticSearchStore;
}
//# sourceMappingURL=ElasticSearchStore.js.map