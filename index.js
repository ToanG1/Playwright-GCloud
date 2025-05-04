const express = require('express');
const { handleFetch } = require('./services/scraper');

const app = express();

app.use(express.json());

app.get('/', async (req, res) => {
  res.status(200).send("Service is healthy ! :>");
});

app.post('/scroll', async (req, res) => {
  const urls = req.body.urls;
  const result = await handleFetch(urls);
  
  if (result) {
    res.status(200).send(result);
  } else {
    res.status(500).send("Internal Server Error");
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(
    `Running on port: ${PORT}`
  );
});
