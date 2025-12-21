const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

console.log('📱 DEMO MODE: Running without database');

// DEMO ACCOUNTS
const demoAccounts = {
  'john@eventsphere.com': { 
    id: 'demo-user-1', name: 'John Attendee', role: 'user', password: 'user123',
    avatar: 'https://ui-avatars.com/api/?name=John+Attendee&background=6200ee&color=fff'
  },
  'organizer@eventsphere.com': { 
    id: 'demo-organizer-1', name: 'Event Organizer', role: 'organizer', password: 'organizer123',
    avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
  },
  'admin@eventsphere.com': { 
    id: 'demo-admin-1', name: 'Admin User', role: 'admin', password: 'admin123',
    avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=dc3545&color=fff'
  }
};

// DEMO EVENTS
const demoEvents = [
  {
    _id: 'demo-event-1', title: "Tech Conference 2024", date: "2024-03-15",
    description: "Annual tech conference", price: 299, category: "Conference",
    location: { venue: "Convention Center", city: "San Francisco" },
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400",
    capacity: 500, attendees: 150
  },
  {
    _id: 'demo-event-2', title: "Summer Music Festival", date: "2024-06-20",
    description: "3-day music festival", price: 89, category: "Concert",
    location: { venue: "Central Park", city: "New York" },
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400",
    capacity: 1000, attendees: 500
  }
];

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    success: true, status: 'OK', message: 'Eventsphere DEMO API',
    mongodb: 'DEMO MODE - No database', timestamp: new Date().toISOString()
  });
});

// 2. SEED ENDPOINT (NO DATABASE)
app.post('/api/seed', (req, res) => {
  console.log('📱 DEMO: Seed called (no database)');
  res.json({
    success: true, message: '✅ DEMO: Database seeded!',
    data: { users: 3, events: 4, tickets: 2 },
    demo_accounts: demoAccounts
  });
});

// 3. LOGIN (DEMO)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = demoAccounts[email];
  
  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password (Try: john@eventsphere.com / user123)'
    });
  }
  
  const token = 'demo-token-' + Date.now();
  res.json({
    success: true, message: 'Login successful! (DEMO)',
    data: { token, user: { id: user.id, name: user.name, email, role: user.role, avatar: user.avatar } }
  });
});

// 4. GET EVENTS (DEMO)
app.get('/api/events', (req, res) => {
  res.json({
    success: true, count: demoEvents.length, total: demoEvents.length,
    data: demoEvents, demo_note: 'Demo events'
  });
});

// 5. BOOK TICKET (DEMO)
app.post('/api/tickets/book', (req, res) => {
  const ticketNumber = `TKT-DEMO-${Date.now()}`;
  res.json({
    success: true, message: '🎉 Ticket booked! (DEMO)',
    data: {
      ticket: { ticketNumber, status: 'confirmed', price: 299, seatNumber: 'A12' }
    }
  });
});

// 6. DASHBOARD STATS (DEMO)
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    success: true, data: {
      totalTickets: 2, upcomingEvents: 1, pastEvents: 1,
      totalSpent: 388, favoriteCategory: 'Conference'
    }
  });
});

// 7. REGISTER (DEMO)
app.post('/api/auth/register', (req, res) => {
  const { name, email } = req.body;
  const token = 'demo-register-' + Date.now();
  res.status(201).json({
    success: true, message: 'Account created! (DEMO)',
    data: {
      token, user: { id: 'demo-' + Date.now(), name, email, role: 'user' }
    }
  });
});

// ERROR HANDLER
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📱 DEMO Server running on port ${PORT}`);
});

module.exports = app;