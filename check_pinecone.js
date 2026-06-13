const { Pinecone } = require('@pinecone-database/pinecone');

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

async function check() {
  const index = pc.index('belleforet-cs');
  const stats = await index.describeIndexStats();
  console.log('Stats:', stats);
  
  if (stats.dimension) {
    const queryRes = await index.query({
      topK: 1,
      vector: new Array(stats.dimension).fill(0.1),
      includeMetadata: true
    });
    console.log('Sample Metadata:', queryRes.matches[0]?.metadata);
  }
}

check().catch(console.error);
