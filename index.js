const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// ===== MongoDB =====
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exercise-tracker';
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ===== Schemas =====
const exerciseSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: Date,
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  log: [exerciseSchema],
});

const User = mongoose.model('User', userSchema);

// ===== Routes =====

// 1️⃣ Create user
app.post('/api/users', async (req, res) => {
  try {
    const { username } = req.body;
    const newUser = new User({ username });
    await newUser.save();
    res.json({ username: newUser.username, _id: newUser._id });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// 2️⃣ Get all users
app.get('/api/users', async (req, res) => {
  const users = await User.find({}, 'username _id');
  res.json(users);
});

// 3️⃣ Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const user = await User.findById(req.params._id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const { description, duration, date } = req.body;

    const exercise = {
      description,
      duration: Number(duration),
      date: date ? new Date(date) : new Date(),
    };

    user.log.push(exercise);
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// 4️⃣ Get user logs
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    const user = await User.findById(req.params._id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    let log = user.log.map((e) => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString(),
    }));

    if (from) {
      const fromDate = new Date(from);
      log = log.filter((e) => new Date(e.date) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      log = log.filter((e) => new Date(e.date) <= toDate);
    }
    if (limit) {
      log = log.slice(0, parseInt(limit));
    }

    res.json({
      username: user.username,
      count: log.length,
      _id: user._id,
      log,
    });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
});

// ===== Listener =====
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
