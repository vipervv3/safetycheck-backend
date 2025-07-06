const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// YOUR CLICKSEND CREDENTIALS - Replace with your actual credentials
const CLICKSEND_USERNAME = 'yardie524@gmail.com';  // Your ClickSend username
const CLICKSEND_API_KEY = '26985186-F808-EBBB-C1B9-4D73CD20D803';  // Your actual API key

// Middleware
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 emergency requests per 15 minutes
  message: { 
    error: 'Too many emergency requests from this IP. Please wait before sending another alert.',
    retryAfter: '15 minutes'
  }
});
app.use('/api/sms', limiter);

// Helper function to validate location data
const validateLocation = (location) => {
  console.log('🔍 Validating location:', JSON.stringify(location, null, 2));
  
  if (!location) {
    console.log('❌ No location object provided');
    return { valid: false, reason: 'No location data provided' };
  }
  
  // Check if lat and lng exist and are numbers
  if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    console.log('❌ Lat/Lng are not numbers:', {
      lat: location.lat,
      lng: location.lng,
      latType: typeof location.lat,
      lngType: typeof location.lng
    });
    return { valid: false, reason: 'Latitude and longitude must be numbers' };
  }
  
  // Check if lat and lng are valid ranges
  if (isNaN(location.lat) || isNaN(location.lng)) {
    console.log('❌ Lat/Lng are NaN');
    return { valid: false, reason: 'Latitude and longitude cannot be NaN' };
  }
  
  if (location.lat < -90 || location.lat > 90) {
    console.log('❌ Invalid latitude range:', location.lat);
    return { valid: false, reason: 'Latitude must be between -90 and 90' };
  }
  
  if (location.lng < -180 || location.lng > 180) {
    console.log('❌ Invalid longitude range:', location.lng);
    return { valid: false, reason: 'Longitude must be between -180 and 180' };
  }
  
  console.log('✅ Location validation passed');
  return { valid: true };
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SafetyCheck Emergency Alert System',
    status: 'ready',
    timestamp: new Date().toISOString(),
    info: 'Centralized emergency SMS service - no API keys required for users'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'SafetyCheck Emergency Backend',
    timestamp: new Date().toISOString(),
    smsService: 'ClickSend ready'
  });
});

// Emergency SMS endpoint - No user credentials required
app.post('/api/sms/emergency', async (req, res) => {
  try {
    console.log('🚨 Emergency SMS request received');
    console.log('📍 Raw request body:', JSON.stringify(req.body, null, 2));
    
    const { contacts, location, userInfo } = req.body;
    
    // Validate required fields
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        error: 'Emergency contacts are required'
      });
    }

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one emergency contact is required'
      });
    }

    // Validate phone numbers
    for (const contact of contacts) {
      if (!contact.phone || !contact.phone.startsWith('+')) {
        return res.status(400).json({
          success: false,
          error: `Invalid phone number for ${contact.name}. Must include country code (e.g., +1234567890)`
        });
      }
    }

    // Check if ClickSend credentials are configured
    if (!CLICKSEND_USERNAME || !CLICKSEND_API_KEY || CLICKSEND_API_KEY === 'YOUR_API_KEY_HERE') {
      return res.status(500).json({
        success: false,
        error: 'SMS service not configured. Please contact the app administrator.'
      });
    }

    // Validate and process location data
    const locationValidation = validateLocation(location);
    let locationText;
    let hasValidLocation = locationValidation.valid;
    
    if (hasValidLocation) {
      // Ensure we have clean number values
      const lat = Number(location.lat);
      const lng = Number(location.lng);
      
      locationText = `🗺️ LOCATION INFORMATION:
📍 Google Maps: https://maps.google.com/maps?q=${lat},${lng}
📐 Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}
🎯 Accuracy: ${location.accuracy ? Math.round(Number(location.accuracy)) + ' meters' : 'Unknown'}
⏰ Timestamp: ${location.timestamp || new Date().toISOString()}

Click the Google Maps link above to see their exact location.`;
      
      console.log('✅ Using valid location data - Lat:', lat, 'Lng:', lng);
    } else {
      locationText = `⚠️ LOCATION UNAVAILABLE:
Location data could not be determined at the time of emergency.
Reason: ${locationValidation.reason || 'Unknown'}
Time of alert: ${new Date().toLocaleString()}

IMPORTANT: Please contact them immediately to determine their current location.`;
      
      console.log('❌ Invalid location data:', locationValidation.reason);
    }

    // Create emergency message with better formatting
    const emergencyMessage = `🚨 EMERGENCY SAFETY ALERT 🚨

Your emergency contact has FAILED to respond to their safety check-in and may require IMMEDIATE assistance.

${locationText}

🚨 REQUIRED IMMEDIATE ACTIONS:
1. Contact them RIGHT NOW by phone
2. If unreachable, consider contacting local emergency services
3. Check their last known location using coordinates above
4. Verify their safety as soon as possible

⏰ Alert generated: ${new Date().toLocaleString()}
📱 Sent by: SafetyCheck Emergency App

TIME IS CRITICAL - PLEASE RESPOND IMMEDIATELY`;

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Send to each contact using centralized credentials
    for (const contact of contacts) {
      try {
        console.log(`📤 Sending emergency alert to ${contact.name} (${contact.phone})`);
        
        const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(CLICKSEND_USERNAME + ':' + CLICKSEND_API_KEY).toString('base64')
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
        console.log(`📡 ClickSend response for ${contact.name}:`, result);

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
          console.log(`✅ Emergency SMS sent to ${contact.name} - Message ID: ${message.message_id}`);
        } else {
          const errorMsg = result.response_msg || result.data?.messages?.[0]?.message_status || 'Unknown ClickSend error';
          results.push({
            contact: contact.name,
            phone: contact.phone,
            status: 'failed',
            error: errorMsg
          });
          failCount++;
          console.log(`❌ Failed to send to ${contact.name}:`, errorMsg);
        }

      } catch (error) {
        results.push({
          contact: contact.name,
          phone: contact.phone,
          status: 'failed',
          error: 'Network error: ' + error.message
        });
        failCount++;
        console.log(`❌ Network error sending to ${contact.name}:`, error.message);
      }
    }

    // Log emergency alert for monitoring
    console.log(`🚨 EMERGENCY ALERT SUMMARY:`);
    console.log(`   Location: ${hasValidLocation ? `${location.lat}, ${location.lng}` : 'UNAVAILABLE'}`);
    console.log(`   Location Status: ${hasValidLocation ? 'VALID' : locationValidation.reason}`);
    console.log(`   Contacts notified: ${successCount}/${contacts.length}`);
    console.log(`   Success rate: ${((successCount/contacts.length)*100).toFixed(1)}%`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);

    res.json({
      success: successCount > 0,
      summary: {
        total: contacts.length,
        sent: successCount,
        failed: failCount,
        locationAvailable: hasValidLocation
      },
      results: results,
      locationStatus: {
        available: hasValidLocation,
        reason: hasValidLocation ? 'Valid location data received' : locationValidation.reason
      }
    });

  } catch (error) {
    console.error('❌ Emergency SMS system error:', error);
    res.status(500).json({
      success: false,
      error: 'Emergency alert system temporarily unavailable. Please try again or contact emergency services directly.'
    });
  }
});

// Debug endpoint to test location validation (remove in production)
app.post('/api/debug/location', (req, res) => {
  const { location } = req.body;
  const validation = validateLocation(location);
  
  res.json({
    location: location,
    validation: validation,
    received: {
      hasLocation: !!location,
      lat: location?.lat,
      lng: location?.lng,
      latType: typeof location?.lat,
      lngType: typeof location?.lng
    }
  });
});

// Block test endpoint completely
app.post('/api/sms/test', (req, res) => {
  res.status(403).json({
    success: false,
    error: 'Test messaging not available. This system is for emergency alerts only.'
  });
});

// Global error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal system error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SafetyCheck Emergency Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🚨 Emergency SMS endpoint: POST http://localhost:${PORT}/api/sms/emergency`);
  console.log(`🔐 Using centralized ClickSend credentials: ${CLICKSEND_USERNAME}`);
  console.log(`⚠️  EMERGENCY ALERTS ONLY - No user credentials required`);
});

module.exports = app;
