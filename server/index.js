// ========================================================================
//  Copyright 2021 Rodrigo Laiola Guimarães <rodrigo@laiola.com.br>
// 
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
// 
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
// 
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <https://www.gnu.org/licenses/>.
//  
//  This program is released under license GNU GPL v3+ license.
// 
// ========================================================================

// Refs:
//     https://medium.com/byte-sized-react/hosting-react-and-a-rest-api-with-express-28f7ba5a4cc4
//     https://www.freecodecamp.org/news/how-to-create-a-react-app-with-a-node-backend-the-complete-guide/
//     https://www.luiztools.com.br/post/logging-de-aplicacoes-node-js-com-winston/

const express = require('express');
const api_app = express();
const relax_app = express();
const bodyParser = require('body-parser');
const path = require('path');
const puppeteer = require('puppeteer');
// const logger = require('./logger');

let jsonResponse = {}

relax_app.use(express.static(path.join(__dirname, '../dist')));
api_app.use(bodyParser.json());

async function processAPIRequest(source, id, filename, index, query) {
  //console.log("loadResults");
  //logger.info("loadResults");

  const browser = await puppeteer.launch({
    // Running Puppeteer on a Docker container requires some additional dependencies 
    // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // Increases GitHub rate limit for API requests using Basic Authentication
    // https://docs.github.com/en/rest/overview/resources-in-the-rest-api
    // https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api
    if (process.env.GITHUB_ACCESS_TOKEN) {
      await page.setExtraHTTPHeaders({
        'Authorization': 'token ' + process.env.GITHUB_ACCESS_TOKEN,
      });
    }
    
    let urlPath = "";
    if (filename != undefined && index != undefined) 
      urlPath = source + "/" + id + "/" + filename + "/" + index;
    else urlPath = source + "/" + id;

    urlPath = urlPath + "?query=" + query;
    //console.log(urlPath);
    //console.log('http://127.0.0.1:' + relax_port + '/relax/api/' + urlPath);
    //logger.info(urlPath);
    //logger.info('http://127.0.0.1:' + relax_port + '/relax/api/' + urlPath);
    await page.goto('http://127.0.0.1:' + relax_port + '/relax/api/' + urlPath, { timeout: 20000 });

    jsonResponse = await page.evaluate((source, query) => {
      try {
        const value1 = document.getElementById('success').firstChild.nodeValue
        const value2 = document.getElementById('query').firstChild.nodeValue
        const value3 = document.getElementById('result').firstChild.nodeValue

        const jsonResponse = {
            "success": value1,
            "query": value2,
            "result": value3
        }

        return jsonResponse;
      } catch (err) {
        const jsonResponse = {
          "success": "false",
          "query": query,
          "result": source == 'gist' ? 
              {
                "message":"GitHub API rate limit exceeded. (But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)",
                "documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
              } : {}
        }

        return jsonResponse;
      } 
    }, source, query);

    //console.log(jsonResponse);
    //logger.info(jsonResponse);
  } catch (err) {
    //console.error(err.message);
    //logger.error(err.message);
  } finally {
    await browser.close();
  }
}

// Handling URL path with filename and index
api_app.get('/relax/api/:source/:id/:filename/:index', async function (req, res) {
  // console.log("Handling URL path with filename and index");
  // console.log(req.params);
  // console.log(req.query);
  
  // logger.info("Handling URL path with filename and index");
  // logger.info(req.params);
  // logger.info(req.query);
  
  const {source , id, filename, index} = req.params;
  const query = req.query.query;
  
  await processAPIRequest(source, id, filename, index, query);
  
  res.json(jsonResponse);
})

// Handling URL path with source and id only
api_app.get('/relax/api/:source/:id', async function (req, res) {
  // console.log("Handling URL path with source and id only");
  // console.log(req.params);
  // console.log(req.query);

  // logger.info("Handling URL path with source and id only");
  // logger.info(req.params);
  // logger.info(req.query);
  
  const {source , id} = req.params;
  const query = req.query.query;
  
  await processAPIRequest(source, id, undefined, undefined, query);
  
  res.json(jsonResponse);
})

// Handling all other URLs by returning an empty json
api_app.get('*', (req,res) => {
  //console.log("Handling all other URLs by returning an empty json");
  //logger.info("Handling all other URLs by returning an empty json");
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ }));
});

// Handling RelaX routing in production
// https://www.pluralsight.com/guides/handling-react-routing-in-production
relax_app.get('/*', function(req,res) {
  //console.log("Handling RelaX routing in production");
  //logger.info("Handling RelaX routing in production");
  res.sendFile(path.join(__dirname, '../dist/relax', 'index.html'));
})

const api_port = process.env.RELAX_API_PORT || 3000;
const relax_port = process.env.RELAX_PORT || 8080;

api_app.listen(api_port, () => {
  console.log('RelaX API listening on port', api_port);
  //logger.info('RelaX API listening on port', api_port);
});

relax_app.listen(relax_port, () => {
  console.log('RelaX Web application listening on port', relax_port);
  //logger.info('RelaX Web application listening on port', relax_port);
});
