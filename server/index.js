// ========================================================================
// Copyright Universidade Federal do Espirito Santo (Ufes)
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//
// This program is released under license GNU GPL v3+ license.
//
// ========================================================================

// Refs:
//     https://medium.com/byte-sized-react/hosting-react-and-a-rest-api-with-express-28f7ba5a4cc4
//     https://www.freecodecamp.org/news/how-to-create-a-react-app-with-a-node-backend-the-complete-guide/
//     https://www.luiztools.com.br/post/logging-de-aplicacoes-node-js-com-winston/

const express = require('express')
const apiApp = express()
const relaxApp = express()
// For limiting number of incoming requests
const rateLimit = require('express-rate-limit')
const bodyParser = require('body-parser')
const path = require('path')
const puppeteer = require('puppeteer')
// const logger = require('./logger')

// Remove the X-Powered-By header
apiApp.disable('x-powered-by')
relaxApp.disable('x-powered-by')

// Creating a limiter by calling rateLimit function with options:
// max contains the maximum number of request and windowMs
// contains the time in millisecond so only max amount of
// request can be made in windowMS time.
const limiterRelax = rateLimit({
  max: 50,
  windowMs: 1 * 60 * 1000, // 1 minute
  message: 'Too many request from this IP'
})

const limiterAPI = rateLimit({
  max: 100,
  windowMs: 1 * 60 * 1000, // 1 minute
  message: 'Too many request from this IP'
})

relaxApp.use(express.static(path.join(__dirname, '../dist')))
apiApp.use(limiterRelax)
apiApp.use(bodyParser.json())
apiApp.use(limiterAPI)

async function processAPIRequest (source, id, filename, index, query) {
  // console.log("loadResults")
  // logger.info("loadResults")

  const browser = await puppeteer.launch({
    // Running Puppeteer on a Docker container requires some additional dependencies
    // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker
    args: [
      '--no-sandbox'
    ]
  })

  const page = await browser.newPage()

  // Increases GitHub rate limit for API requests using Basic Authentication
  // https://docs.github.com/en/rest/overview/resources-in-the-rest-api
  // https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api
  if (process.env.GITHUB_ACCESS_TOKEN) {
    await page.setExtraHTTPHeaders({
      Authorization: 'token ' + process.env.GITHUB_ACCESS_TOKEN
    })
  }

  let urlPath = ''
  if (filename !== undefined && index !== undefined) {
    urlPath = source + '/' + id + '/' + filename + '/' + index
  } else urlPath = source + '/' + id

  urlPath = urlPath + '?query=' + query
  // console.log(urlPath)
  // console.log('http://127.0.0.1:' + relaxPort + '/relax/api/' + urlPath)
  // logger.info(urlPath)
  // logger.info('http://127.0.0.1:' + relaxPort + '/relax/api/' + urlPath)
  await page.goto('http://127.0.0.1:' + relaxPort + '/relax/api/' + urlPath, {
    // 1 min
    timeout: 60000
  })

  let json = await page.evaluate(() => {
    const value1 = document.getElementById('success').firstChild.nodeValue
    const value2 = document.getElementById('query').firstChild.nodeValue
    const value3 = document.getElementById('result').firstChild.nodeValue

    return {
      success: value1,
      query: value2,
      result: value3
    }
  })

  // Close it
  await page.close()
  await browser.close()

  console.log(json)
  return json
}

// Handling URL path with filename and index
apiApp.get('/relax/api/:source/:id/:filename/:index', async function (req, res) {
  // console.log("Handling URL path with filename and index")
  // console.log(req.params)
  // console.log(req.query)

  // logger.info("Handling URL path with filename and index")
  // logger.info(req.params)
  // logger.info(req.query)

  const { source, id, filename, index } = req.params
  const query = req.query.query

  try {
    const jsonResponse = await processAPIRequest(source, id, filename, index, query)
    res.json(jsonResponse)
  } catch (error) {
    res.status(error.response.status)
    return res.send(error.message);
  }
})

// Handling URL path with source and id only
apiApp.get('/relax/api/:source/:id', async function (req, res) {
  // console.log("Handling URL path with source and id only")
  // console.log(req.params)
  // console.log(req.query)

  // logger.info("Handling URL path with source and id only")
  // logger.info(req.params)
  // logger.info(req.query)

  const { source, id } = req.params
  const query = req.query.query

  try {
    const jsonResponse = await processAPIRequest(source, id, undefined, undefined, query)
    res.json(jsonResponse)
  } catch (error) {
    res.status(error.response.status)
    return res.send(error.message);
  }
})

// Handling all other URLs by returning an empty json
apiApp.get('*', (req, res) => {
  // console.log("Handling all other URLs by returning an empty json")
  // logger.info("Handling all other URLs by returning an empty json")
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ }))
})

// Handling RelaX routing in production
// https://www.pluralsight.com/guides/handling-react-routing-in-production
relaxApp.get('/*', function (req, res) {
  // console.log("Handling RelaX routing in production")
  // logger.info("Handling RelaX routing in production")
  res.sendFile(path.join(__dirname, '../dist/relax', 'index.html'))
})

const apiPort = process.env.RELAX_API_PORT || 3000
const relaxPort = process.env.RELAX_PORT || 8080

apiApp.listen(apiPort, () => {
  console.log('RelaX API listening on port', apiPort)
  // logger.info('RelaX API listening on port', apiPort)
})

relaxApp.listen(relaxPort, () => {
  console.log('RelaX Web application listening on port', relaxPort)
  // logger.info('RelaX Web application listening on port', relaxPort)
})
