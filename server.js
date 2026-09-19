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

const app = express();

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL,
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
app.use('/api/sms', smsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/statements', statementRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'FinGenie API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start background worker
  startInsightWorker();
});