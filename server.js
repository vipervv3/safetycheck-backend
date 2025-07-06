const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many SMS requests, please try again later.'
  }
});

app.use('/api/sms', limiter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'SafetyCheck Backend is running!', 
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      testSms: 'POST /api/sms/test',
      emergencySms: 'POST /api/sms/emergency'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'SafetyCheck Backend'
  });
});

// Test SMS endpoint
app.post('/api/sms/test', async (req, res) => {
  try {
    console.log('📱 Test SMS request received');
    
    const { username, apiKey, phoneNumber, contactName } = req.body;
    
    if (!username || !apiKey || !phoneNumber || !contactName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, apiKey, phoneNumber, contactName'
      });
    }

    if (!phoneNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must include country code (e.g., +1234567890)'
      });
    }

    const testMessage = `📱 SafetyCheck Test Message

This is a test message from your SafetyCheck app to verify SMS functionality is working correctly.

✅ If you receive this message, your emergency alerts are properly configured.

Time: ${new Date().toLocaleString()}

You can safely ignore this test message.`;

    // Use native fetch (available in Node 18+)
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(username + ':' + apiKey).toString('base64')
      },
      body: JSON.stringify({
        messages: [
          {
            to: phoneNumber,
            body: testMessage,
            source: 'SafetyCheck-Test'
          }
        ]
      })
    });

    const result = await response.json();
    console.log('📡 ClickSend response:', response.status, result);

    if (response.ok && result.http_code === 200) {
      const message = result.data.messages[0];
      res.json({
        success: true,
        data: {
          messageId: message.message_id,
          cost: message.message_price,
          status: message.status,
          contact: contactName,
          phone: phoneNumber
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.response_msg || 'SMS sending failed',
        code: result.response_code
      });
    }

  } catch (error) {
    console.error('❌ Test SMS error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
});

// Emergency SMS endpoint
app.post('/api/sms/emergency', async (req, res) => {
  try {
    console.log('🚨 Emergency SMS request received');
    
    const { username, apiKey, contacts, location } = req.body;
    
    if (!username || !apiKey || !contacts || !Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, apiKey, contacts (array)'
      });
    }

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No emergency contacts provided'
      });
    }

    const locationText = location 
      ? `📍 LOCATION: https://maps.google.com/maps?q=${location.lat},${location.lng}
📍 Coordinates: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
🕐 Time: ${new Date().toLocaleString()}`
      : '📍 LOCATION: Not available';

    const emergencyMessage = `🚨 EMERGENCY ALERT 🚨

Your emergency contact has NOT responded to their safety check-in and may need immediate assistance.

${locationText}

⚠️ Please check on them IMMEDIATELY or contact local emergency services if needed.

This is an automated safety alert from SafetyCheck app.`;

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const contact of contacts) {
      try {
        const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(username + ':' + apiKey).toString('base64')
          },
          body: JSON.stringify({
            messages: [
              {
                to: contact.phone,
                body: emergencyMessage,
                source: 'SafetyCheck-Emergency'
              }
            ]
          })
        });

        const result = await response.json();

        if (response.ok && result.http_code === 200) {
          const message = result.data.messages[0];
          results.push({
            contact: contact.name,
            phone: contact.phone,
            status: 'success',
            messageId: message.message_id,
            cost: message.message_price
          });
          successCount++;
        } else {
          results.push({
            contact: contact.name,
            phone: contact.phone,
            status: 'failed',
            error: result.response_msg || 'Unknown error'
          });
          failCount++;
        }

      } catch (error) {
        results.push({
          contact: contact.name,
          phone: contact.phone,
          status: 'failed',
          error: error.message
        });
        failCount++;
      }
    }

    res.json({
      success: successCount > 0,
      summary: {
        total: contacts.length,
        sent: successCount,
        failed: failCount
      },
      results: results
    });

  } catch (error) {
    console.error('❌ Emergency SMS error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SafetyCheck Backend Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
