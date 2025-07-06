const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'SafetyCheck Backend is running!',
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'SafetyCheck Backend'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
