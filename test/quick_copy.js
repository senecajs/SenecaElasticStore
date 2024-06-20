require('dotenv').config({ path: '../.env.local' });
const { Client } = require('@elastic/elasticsearch');

async function run() {
  console.log('Elasticsearch node URL:', process.env.ELASTICSEARCH_NODE);

  const client = new Client({
    node: process.env.ELASTICSEARCH_NODE
  });

  try {
    // Check Elasticsearch cluster health
    const health = await client.cluster.health();
    console.log('Cluster health:', health);

    // Create an index with a vector field
    await client.indices.create({
      index: 'vector-index', // Consider a different index name to avoid conflicts
      body: {
        mappings: {
          properties: {
            title: { type: 'text' },
            content: { type: 'text' },
            vector: {
              type: 'dense_vector',
              dims: 128  // Specify the dimensionality of the vector
            }
          }
        }
      }
    }, { ignore: [400] });  // Ignore index already exists message

    console.log('Index with vector field created or already exists.');

    // Index a document including vector data
    const doc = {
      title: 'Test Title',
      content: 'Hello, Elasticsearch!',
      vector: Array(128).fill(0.5)  // Example vector data, modify as needed
    };

    const { body: indexResponse } = await client.index({
      index: 'vector-index',
      body: doc,
      refresh: true  // Make sure the document is searchable immediately after indexing
    });

    console.log('Document indexed:', indexResponse);

    // Search for the document
    const { body: searchResponse } = await client.search({
      index: 'vector-index',
      body: {
        query: {
          match: {
            title: 'Test'
          }
        }
      }
    });

    console.log('Search results:', searchResponse.hits.hits);

  } catch ( error ) {
    console.error('Elasticsearch operation failed:', error);
  }
}

run();
