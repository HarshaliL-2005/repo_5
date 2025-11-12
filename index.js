// server.js
const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.urlencoded({ extended: false })) // parse form data
app.use(express.json())

// Serve index
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

// Mongo
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exercise-tracker'
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err))

// Schemas
const exerciseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
}, { _id: false })

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSchema]
})

const User = mongoose.model('User', userSchema)

// 1) Create user
app.post('/api/users', async (req, res) => {
  try {
    const username = req.body.username
    if (!username) return res.status(400).json({ error: 'username required' })

    const user = new User({ username, log: [] })
    await user.save()
    res.json({ username: user.username, _id: user._id.toString() })
  } catch (err) {
    res.status(500).json({ error: 'server error' })
  }
})

// 2) Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id').exec()
    // return array of { username, _id }
    res.json(users.map(u => ({ username: u.username, _id: u._id.toString() })))
  } catch (err) {
    res.status(500).json({ error: 'server error' })
  }
})

// 3) Add exercise to user
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id
    const { description, duration, date } = req.body

    if (!description || !duration) {
      return res.status(400).json({ error: 'description and duration are required' })
    }

    const durNum = Number(duration)
    if (Number.isNaN(durNum)) return res.status(400).json({ error: 'duration must be a number' })

    // parse date (optional). If missing or invalid -> today
    let parsedDate = date ? new Date(date) : new Date()
    if (isNaN(parsedDate.getTime())) parsedDate = new Date()

    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const exercise = {
      description: description,
      duration: durNum,
      date: parsedDate
    }

    user.log.push(exercise)
    await user.save()

    // Response shape per task:
    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
      _id: user._id.toString()
    })
  } catch (err) {
    res.status(500).json({ error: 'server error' })
  }
})

// 4) Get user logs with optional from, to, limit
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id
    const { from, to, limit } = req.query

    const user = await User.findById(userId).exec()
    if (!user) return res.status(404).json({ error: 'user not found' })

    // Clone user's log
    let log = user.log.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date
    }))

    // Apply from/to
    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate.getTime())) {
        log = log.filter(e => e.date >= fromDate)
      }
    }
    if (to) {
      const toDate = new Date(to)
      if (!isNaN(toDate.getTime())) {
        log = log.filter(e => e.date <= toDate)
      }
    }

    // Sort by date ascending (optional; tests don't enforce order but it's predictable)
    log.sort((a, b) => a.date - b.date)

    // Apply limit
    if (limit) {
      const lim = parseInt(limit)
      if (!isNaN(lim) && lim >= 0) log = log.slice(0, lim)
    }

    // Format log dates as strings
    const formattedLog = log.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }))

    res.json({
      username: user.username,
      count: formattedLog.length,
      _id: user._id.toString(),
      log: formattedLog
    })
  } catch (err) {
    res.status(500).json({ error: 'server error' })
  }
})

// listener
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
