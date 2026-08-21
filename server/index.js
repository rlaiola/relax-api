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
const rateLimit = require('express-rate-limit')
const bodyParser = require('body-parser')
const path = require('path')
const { Cluster } = require('puppeteer-cluster')

// Configuration constants
const RATE_LIMIT_WINDOW_MS = 1 * 60 * 1000 // 1 minute
const RATE_LIMIT_RELAX_MAX = 50
const RATE_LIMIT_API_MAX = 100
const PUPPETEER_TIMEOUT = 30000 // 30 seconds
const API_PORT = process.env.RELAX_API_PORT || 3000
const RELAX_PORT = process.env.RELAX_PORT || 8080

// Remove the X-Powered-By header
apiApp.disable('x-powered-by')
relaxApp.disable('x-powered-by')

// Creating rate limiters
const limiterRelax = rateLimit({
  max: RATE_LIMIT_RELAX_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  message: 'Too many requests from this IP'
})

const limiterAPI = rateLimit({
  max: RATE_LIMIT_API_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
  message: 'Too many requests from this IP'
})

relaxApp.use(express.static(path.join(__dirname, '../dist')))
// relaxApp.use(limiterRelax)
apiApp.use(bodyParser.json())
// apiApp.use(limiterAPI)

;(async () => {
  try {
    const cluster = await Cluster.launch({
    puppeteerOptions: {
      args: [
        '--no-sandbox',
      ],
      headless: 'new',
      // https://stackoverflow.com/questions/57987585/puppeteer-how-to-store-a-session-including-cookies-page-state-local-storage
      userDataDir: '/tmp/browser'
    },
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 16,
    // The upper limit of the timeout is 2147483647 which is the max limit
    // of 32-bit int.
    // https://github.com/thomasdondorf/puppeteer-cluster/pull/280
    timeout: 2147483647
  })

  await cluster.task(async ({ page, data: [source, id, filename, index, query] }) => {
    let json = {}

    try {
      // Increases GitHub rate limit for API requests using Basic Authentication
      // https://docs.github.com/en/rest/overview/resources-in-the-rest-api
      // https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api
      if (process.env.GITHUB_ACCESS_TOKEN) {
        await page.setExtraHTTPHeaders({
          Authorization: `token ${process.env.GITHUB_ACCESS_TOKEN}`
        })
      }

      let urlPath = filename !== undefined && index !== undefined
        ? `${source}/${id}/${filename}/${index}`
        : `${source}/${id}`

      const fullUrl = `http://127.0.0.1:${RELAX_PORT}/relax/api/${urlPath}?query=${encodeURIComponent(query)}`
      
      await page.goto(fullUrl, {
        timeout: 0
      })

      await page.waitForFunction(() => {
        return document.getElementById('success') &&
               document.getElementById('query') &&
               document.getElementById('result')
      }, {
        timeout: PUPPETEER_TIMEOUT
      })
      
      json = await page.evaluate(() => {
        const value1 = document.getElementById('success').textContent
        const value2 = document.getElementById('query').textContent
        const value3 = document.getElementById('result').textContent
      
        return {
          success: value1,
          query: value2,
          result: value3
        }
      })
    } catch (err) {
      console.error('Cluster task error:', err);
      json = {
        success: false,
        error: err.message
      }
    }

    return json
  })

  // Handling URL path with filename and index
  apiApp.get('/relax/api/:source/:id/:filename/:index', async function (req, res) {
    const { source, id, filename, index } = req.params
    const { query } = req.query

    if (!query) {
      return res.status(400).json({ error: 'Missing required query parameter' })
    }

    try {
      const jsonResponse = await cluster.execute([source, id, filename, index, query])
      if (jsonResponse.success === false && jsonResponse.error) {
        res.status(500).json(jsonResponse)
      } else {
        res.json(jsonResponse)
      }
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', details: err.message })
    }
  })

  // Handling URL path with source and id only
  apiApp.get('/relax/api/:source/:id', async function (req, res) {
    const { source, id } = req.params
    const { query } = req.query

    if (!query) {
      return res.status(400).json({ error: 'Missing required query parameter' })
    }

    try {
      const jsonResponse = await cluster.execute([source, id, undefined, undefined, query])
      if (jsonResponse.success === false && jsonResponse.error) {
        res.status(500).json(jsonResponse)
      } else {
        res.json(jsonResponse)
      }
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', details: err.message })
    }
  })

  // Handling all other URLs
  apiApp.get('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })

  // Handling RelaX routing in production
  // https://www.pluralsight.com/guides/handling-react-routing-in-production
  relaxApp.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../dist/relax', 'index.html'))
  })

  apiApp.listen(API_PORT, () => {
    console.log(`RelaX API listening on port ${API_PORT}`)
  })

  relaxApp.listen(RELAX_PORT, () => {
    console.log(`RelaX Web application listening on port ${RELAX_PORT}`)
  })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
})()
