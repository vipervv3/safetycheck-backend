// server.js
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests' }
});
app.use('/api/sms', limiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SafetyCheck Backend is running!',
    status: 'success',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      testSms: 'POST /api/sms/test',
      emergencySms: 'POST /api/sms/emergency'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'SafetyCheck Backend',
    timestamp: new Date().toISOString()
  });
});

// Test SMS endpoint
app.post('/api/sms/test', async (req, res) => {
  const { username, apiKey, phoneNumber, contactName } = req.body;
  
  if (!username || !apiKey || !phoneNumber || !contactName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  // For now, return success (we'll add ClickSend later)
  res.json({
    success: true,
    message: 'Test endpoint working',
    data: { contact: contactName, phone: phoneNumber }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
