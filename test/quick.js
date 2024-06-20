//quick.js

require('dotenv').config({ path: '../.env.local' });
const Seneca = require('seneca');

async function run() {
  const seneca = Seneca({ legacy: false })
    .test() // Test mode to suppress unnecessary logs
    .use('promisify') // For using promises with Seneca actions
    .use('entity') // Basic entity handling
    .use('..', {
      map: {
        'foo/chunk': '*',
      },
      elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE
      },
      index: {
        exact: 'vector-index',
      },
      field: {
        vector: { name: 'vector' }
      }
    });

  await seneca.ready();
  console.log("Seneca is ready.");

  const id = 'a9O_M5ABbttIYY-jv_Vt'; 
  // Replace 'a9O_M5ABbttIYY_Vt' with a valid ID from Elasticsearch data
  const load0 = await seneca.entity('foo/chunk').load$(id);
  console.log('Loaded entity:', load0);

  const list0 = await seneca.entity('foo/chunk').list$();
  console.log('List of entities:', list0);
}

run().catch(err => console.error('Error running Seneca with Elasticsearch:', err));
