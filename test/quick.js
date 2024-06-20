//quick.js

require('dotenv').config({ path: '../.env.local' });
const Seneca = require('seneca');

async function run() {
  const seneca = Seneca({ legacy: false })
    .test() // Test mode to suppress unnecessary logs
    .use('promisify') // For using promises with Seneca actions
    .use('entity') // Basic entity handling
    .use('..', { // Use your custom ElasticsearchStore plugin
      map: {
        'foo/chunk': '*',
      },
      elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE // Ensure this matches your .env settings
      },
      index: {
        exact: 'vector-index', // Specify the exact index or use env var
      },
      field: {
        vector: { name: 'vector' } // Correctly define this according to your Elasticsearch schema
      }
    });

  await seneca.ready();
  console.log("Seneca is ready.");

  // Example ID, ensure this is a valid Elasticsearch document ID
  const id = 'a9O_M5ABbttIYY-jv_Vt'; // Replace '1' with a valid ID from your Elasticsearch data
  const load0 = await seneca.entity('foo/chunk').load$(id);
  console.log('Loaded entity:', load0);

  const list0 = await seneca.entity('foo/chunk').list$();
  console.log('List of entities:', list0);
}

run().catch(err => console.error('Error running Seneca with Elasticsearch:', err));
