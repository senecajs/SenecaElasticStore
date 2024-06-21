const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const { Client } = require('@elastic/elasticsearch');

async function run() {
  console.log('ElasticSearch node URL:', process.env.ELASTICSEARCH_NODE);

  const client = new Client({
    node: process.env.ELASTICSEARCH_NODE
  });

  try {
    // Check Elasticsearch cluster health
    const health = await client.cluster.health();
    console.log('Cluster health:', health);

    // Delete the previous vector-index if it exists
    try {
      const deleteResponse = await client.indices.delete({
        index: 'vector-index'
      });
      console.log('Previous vector-index deleted:', deleteResponse);
    } catch (error) {
      if (error.meta && error.meta.statusCode === 404) {
        console.log('Previous vector-index does not exist.');
      } else {
        throw error;
      }
    }

    // Create the vector-index with k-NN feature
    const indexResponse = await client.indices.create({
      index: 'vector-index', 
      body: {
        mappings: {
          properties: {
            "vector": {
              "type": "dense_vector",
              "dims": 8,
              "index": true, // Enable k-NN indexing
              "similarity": "l2_norm" // Specify similarity metric
            },
            "test": {
              "type": "keyword"
            },
            "text": {
              "type": "text"
            }
          }
        }
      }
    }, { ignore: [400] }); 

    console.log('Index creation response:', indexResponse);
    console.log('Index with k-NN vector field created or already exists.');

  } catch (error) {
    console.error('ElasticSearch operation failed:', error);
  }
}

run();
