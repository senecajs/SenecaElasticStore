#!/bin/bash

# Pull the Elasticsearch Docker image
docker pull docker.elastic.co/elasticsearch/elasticsearch:8.14.0

# Run the Elasticsearch container
docker run -d --name elasticsearch -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.14.0

# Wait for Elasticsearch to start
echo "Waiting for Elasticsearch to start..."
sleep 20

# Check if Elasticsearch is running
if curl -X GET "localhost:9200" -u "elastic:changeme"; then
  echo "Elasticsearch is up and running."
else
  echo "Failed to start Elasticsearch. Please check the logs for more details."
fi