const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();
const connectDB = require('./config/db');
const passport = require('./config/passport');
const { startInsightWorker } = require('./jobs/insightWorker');

const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const smsRoutes = require('./routes/smsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const insightRoutes = require('./routes/insightRoutes');
const goalRoutes = require('./routes/goalRoutes');
const statementRoutes = require('./routes/statementRoutes');
const importRoutes = require('./routes/importRoutes');

const app = express();

connectDB();

const allowedOrigins = [
  process.env.CLIENT_URL?.replace(/\/$/, ''), // strip trailing slash just in case
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transactions/import', importRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/statements', statementRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'FinGenie API is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Handling 404
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack); // Log internally
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.WORKER_MODE === 'true') {
  console.log('Starting in Background Worker mode...');
  startInsightWorker();
  const importWorker = require('./jobs/importWorker');
  console.log('Workers started successfully.');
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // If not on separate architecture, optionally run both, but better separate
    if (process.env.NODE_ENV !== 'production') {
      startInsightWorker();
      const importWorker = require('./jobs/importWorker');
      console.log('Workers started alongside web server (Development Mode).');
    } else {
      console.log('Production mode: Please ensure WORKER_MODE=true runs in a separate Render Background Worker.');
    }
  });
}