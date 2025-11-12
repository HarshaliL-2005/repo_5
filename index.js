// index.js
const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Mongo
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exercise-tracker';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const exerciseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSchema]
});

const User = mongoose.model('User', userSchema);

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const username = req.body.username;
    if (!username) return res.status(400).json({ error: 'username required' });

    const user = new User({ username, log: [] });
    await user.save();
    res.json({ username: user.username, _id: user._id.toString() });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id').exec();
    res.json(users.map(u => ({ username: u.username, _id: u._id.toString() })));
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id;
    const { description, duration, date } = req.body;

    if (!description || !duration) return res.status(400).json({ error: 'description and duration required' });

    const durNum = Number(duration);
    if (Number.isNaN(durNum)) return res.status(400).json({ error: 'duration must be a number' });

    let parsedDate = date ? new Date(date) : new Date();
    if (isNaN(parsedDate.getTime())) parsedDate = new Date();

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const exercise = { description: description, duration: durNum, date: parsedDate };
    user.log.push(exercise);
    await user.save();

    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
      _id: user._id.toString()
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// Get logs
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;

    const user = await User.findById(userId).exec();
    if (!user) return res.status(404).json({ error: 'user not found' });

    // copy and work with Date objects
    let logs = user.log.map(e => ({ description: e.description, duration: e.duration, date: e.date }));

    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) logs = logs.filter(e => e.date >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) logs = logs.filter(e => e.date <= toDate);
    }

    // sort by date ascending
    logs.sort((a, b) => a.date - b.date);

    if (limit) {
      const lim = parseInt(limit);
      if (!isNaN(lim) && lim >= 0) logs = logs.slice(0, lim);
    }

    const formattedLog = logs.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));

    res.json({
      username: user.username,
      count: formattedLog.length,
      _id: user._id.toString(),
      log: formattedLog
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
