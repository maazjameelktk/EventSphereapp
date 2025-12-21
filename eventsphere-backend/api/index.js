const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// ✅ CORRECT: Wildcard WITHOUT credentials
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// ✅ ENVIRONMENT VARIABLES (NO HARDCODED SECRETS)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/eventsphere';
const JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-for-testing-only';

// ============ FIXED: DEMO MODE - NO DATABASE CONNECTION ============
// ⚠️ COMMENT OUT THE MONGOOSE CONNECT - This is why you're getting timeout errors
console.log('📱 DEMO MODE: Running without database connection');

// Create empty models for demo
const Event = { find: () => [], findById: () => null, countDocuments: () => 0 };
const User = { 
  find: () => [], 
  findOne: () => null,
  findById: () => null 
};
const Ticket = { 
  find: () => [], 
  findOne: () => null,
  countDocuments: () => 0 
};

// ============ MIDDLEWARE ============
const logRequest = (req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
};
app.use(logRequest);

// JWT Authentication Middleware (DEMO VERSION)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required. Please login first.' 
    });
  }
  
  // DEMO: Accept any token that starts with "demo-"
  if (token.startsWith('demo-')) {
    req.user = { userId: 'demo-user-id', role: 'user' };
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid token. Use demo accounts.' 
    });
  }
};

// Admin Middleware (DEMO)
const isAdmin = (req, res, next) => {
  if (req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
};

// Organizer Middleware (DEMO)
const isOrganizer = (req, res, next) => {
  if (req.user.role === 'organizer' || req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Organizer or admin access required' 
    });
  }
};

// ============ API ROUTES ============

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    message: 'Eventsphere API v2.0 is running (DEMO MODE)',
    mongodb: 'DEMO MODE - No database',
    timestamp: new Date().toISOString(),
    version: '2.0',
    cors: 'Enabled for all origins',
    demo_note: 'Running in demo mode without database'
  });
});

// 2. AUTHENTICATION ROUTES

// DEMO ACCOUNTS DATA
const demoAccounts = {
  'john@eventsphere.com': { 
    id: 'demo-user-1',
    name: 'John Attendee', 
    role: 'user', 
    password: 'user123',
    avatar: 'https://ui-avatars.com/api/?name=John+Attendee&background=6200ee&color=fff'
  },
  'organizer@eventsphere.com': { 
    id: 'demo-organizer-1',
    name: 'Event Organizer', 
    role: 'organizer', 
    password: 'organizer123',
    avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
  },
  'admin@eventsphere.com': { 
    id: 'demo-admin-1',
    name: 'Admin User', 
    role: 'admin', 
    password: 'admin123',
    avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=dc3545&color=fff'
  }
};

// Register with password hashing (DEMO)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    
    // Validate
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }
    
    // Check if user exists in demo accounts
    if (demoAccounts[email]) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // DEMO: Return success without saving
    const token = 'demo-register-token-' + Date.now();
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully! (DEMO MODE)',
      data: {
        token,
        user: {
          id: 'demo-' + Date.now(),
          name: name,
          email: email,
          phone: phone || '',
          role: role || 'user',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6200ee&color=fff`
        }
      },
      demo_note: 'No actual user created - demo mode'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Demo mode error' 
    });
  }
});

// Login (DEMO)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists in demo accounts
    const user = demoAccounts[email];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password (Try: john@eventsphere.com / user123)'
      });
    }
    
    // Check password (DEMO - plain text comparison)
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate DEMO JWT token
    const token = 'demo-token-' + Date.now();
    
    res.json({
      success: true,
      message: 'Login successful! (DEMO MODE)',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: email,
          phone: '+1234567890',
          role: user.role,
          avatar: user.avatar
        }
      },
      demo_note: 'Using demo accounts - no database'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Demo login error' 
    });
  }
});

// Get current user profile (DEMO)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.userId,
      name: 'Demo User',
      email: 'demo@eventsphere.com',
      phone: '+1234567890',
      role: req.user.role || 'user',
      avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=6200ee&color=fff',
      registeredEvents: []
    },
    demo_note: 'Demo profile data'
  });
});

// Update profile (DEMO)
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  const { name, phone, avatar } = req.body;
  
  res.json({
    success: true,
    message: 'Profile updated successfully (DEMO MODE)',
    data: {
      id: req.user.userId,
      name: name || 'Updated User',
      email: 'demo@eventsphere.com',
      phone: phone || '+1234567890',
      role: req.user.role || 'user',
      avatar: avatar || 'https://ui-avatars.com/api/?name=User&background=6200ee&color=fff'
    }
  });
});

// 3. EVENTS ROUTES (DEMO)

// DEMO EVENTS DATA
const demoEvents = [
  {
    _id: 'demo-event-1',
    title: "Tech Innovators Conference 2024",
    description: "Join us for the biggest tech conference of the year! Featuring keynote speeches from industry leaders, hands-on workshops, and networking opportunities.",
    date: "2024-03-15",
    time: "09:00 AM",
    location: {
      venue: "Convention Center",
      address: "123 Tech Street",
      city: "San Francisco",
      country: "USA"
    },
    category: "Conference",
    price: 299,
    capacity: 500,
    attendees: 150,
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
    organizer: {
      _id: 'demo-organizer-1',
      name: 'Event Organizer',
      email: 'organizer@eventsphere.com',
      avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
    }
  },
  {
    _id: 'demo-event-2',
    title: "Summer Music Festival",
    description: "3-day music festival featuring top artists from around the world. Multiple stages, food trucks, and camping available.",
    date: "2024-06-20",
    time: "02:00 PM",
    location: {
      venue: "Central Park",
      address: "Park Avenue",
      city: "New York",
      country: "USA"
    },
    category: "Concert",
    price: 89,
    capacity: 1000,
    attendees: 500,
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
    organizer: {
      _id: 'demo-organizer-1',
      name: 'Event Organizer',
      email: 'organizer@eventsphere.com',
      avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
    }
  },
  {
    _id: 'demo-event-3',
    title: "React Native Workshop",
    description: "Hands-on workshop for building mobile apps with React Native. Perfect for beginners and intermediate developers.",
    date: "2024-04-10",
    time: "10:00 AM",
    location: {
      venue: "Tech Hub",
      address: "456 Developer Road",
      city: "Austin",
      country: "USA"
    },
    category: "Workshop",
    price: 49,
    capacity: 100,
    attendees: 75,
    imageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800",
    organizer: {
      _id: 'demo-organizer-1',
      name: 'Event Organizer',
      email: 'organizer@eventsphere.com',
      avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
    }
  },
  {
    _id: 'demo-event-4',
    title: "Startup Networking Mixer",
    description: "Connect with entrepreneurs, investors, and innovators. Perfect for startup founders looking to network.",
    date: "2024-05-05",
    time: "06:30 PM",
    location: {
      venue: "Innovation Center",
      address: "789 Startup Blvd",
      city: "Boston",
      country: "USA"
    },
    category: "Networking",
    price: 25,
    capacity: 200,
    attendees: 120,
    imageUrl: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
    organizer: {
      _id: 'demo-organizer-1',
      name: 'Event Organizer',
      email: 'organizer@eventsphere.com',
      avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
    }
  }
];

// Get all events with filters (DEMO)
app.get('/api/events', async (req, res) => {
  const { category, search, sort = 'date', page = 1, limit = 10 } = req.query;
  
  let filteredEvents = [...demoEvents];
  
  // Apply filters (demo version)
  if (category && category !== 'all') {
    filteredEvents = filteredEvents.filter(event => event.category === category);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredEvents = filteredEvents.filter(event => 
      event.title.toLowerCase().includes(searchLower) ||
      event.description.toLowerCase().includes(searchLower) ||
      event.location.venue.toLowerCase().includes(searchLower)
    );
  }
  
  // Sorting (demo version)
  if (sort === 'price_asc') filteredEvents.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') filteredEvents.sort((a, b) => b.price - a.price);
  if (sort === 'newest') filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sort === 'popular') filteredEvents.sort((a, b) => b.attendees - a.attendees);
  
  // Pagination (demo version)
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    count: paginatedEvents.length,
    total: filteredEvents.length,
    page: pageNum,
    pages: Math.ceil(filteredEvents.length / limitNum),
    data: paginatedEvents,
    demo_note: 'Demo events - no database'
  });
});

// Get single event with details (DEMO)
app.get('/api/events/:id', async (req, res) => {
  const event = demoEvents.find(e => e._id === req.params.id);
  
  if (!event) {
    return res.status(404).json({ 
      success: false, 
      message: 'Event not found (DEMO)' 
    });
  }
  
  res.json({
    success: true,
    data: event
  });
});

// Create event (organizer only) - DEMO
app.post('/api/events', authenticateToken, isOrganizer, async (req, res) => {
  const eventData = req.body;
  
  // DEMO: Create mock event
  const newEvent = {
    _id: 'demo-event-' + Date.now(),
    ...eventData,
    organizer: {
      _id: req.user.userId,
      name: 'Demo Organizer',
      email: 'organizer@eventsphere.com'
    },
    attendees: 0,
    imageUrl: eventData.imageUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'
  };
  
  res.status(201).json({
    success: true,
    message: 'Event created successfully (DEMO MODE)',
    data: newEvent,
    demo_note: 'No actual event created - demo mode'
  });
});

// 4. TICKET & BOOKING SYSTEM (DEMO)

// Book ticket with payment simulation (DEMO)
app.post('/api/tickets/book', authenticateToken, async (req, res) => {
  const { eventId } = req.body;
  
  // Find event (demo)
  const event = demoEvents.find(e => e._id === eventId);
  if (!event) {
    return res.status(404).json({ 
      success: false, 
      message: 'Event not found (DEMO)' 
    });
  }
  
  // DEMO: Simulate payment (90% success rate)
  const paymentSuccess = Math.random() > 0.1;
  
  if (!paymentSuccess) {
    return res.status(400).json({ 
      success: false, 
      message: 'Payment failed. Please try again or use a different payment method. (DEMO)' 
    });
  }
  
  // Generate DEMO ticket
  const ticketNumber = `TKT-DEMO-${Date.now().toString(36).toUpperCase()}`;
  const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`DEMO-TICKET: ${ticketNumber}\nEvent: ${event.title}`)}`;
  
  res.status(201).json({
    success: true,
    message: '🎉 Ticket booked successfully! (DEMO MODE)',
    data: {
      ticket: {
        _id: 'demo-ticket-' + Date.now(),
        ticketNumber,
        eventId: event._id,
        userId: req.user.userId,
        price: event.price,
        status: 'confirmed',
        paymentMethod: 'card',
        paymentStatus: 'completed',
        qrCode,
        seatNumber: `A${Math.floor(Math.random() * 50) + 1}`,
        purchaseDate: new Date().toISOString(),
        eventId: {
          _id: event._id,
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          imageUrl: event.imageUrl,
          category: event.category
        }
      },
      receipt: {
        transactionId: `TRX-DEMO-${Date.now()}`,
        amount: event.price,
        paymentMethod: 'card',
        status: 'completed',
        date: new Date().toISOString()
      }
    },
    demo_note: 'Demo booking - no actual ticket created'
  });
});

// Get user tickets (DEMO)
app.get('/api/tickets/my-tickets', authenticateToken, async (req, res) => {
  // DEMO: Return sample tickets
  const demoTickets = [
    {
      _id: 'demo-ticket-1',
      ticketNumber: 'TKT-DEMO-001',
      eventId: {
        _id: 'demo-event-1',
        title: 'Tech Innovators Conference 2024',
        date: '2024-03-15',
        time: '09:00 AM',
        location: {
          venue: 'Convention Center',
          city: 'San Francisco'
        },
        imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
        category: 'Conference'
      },
      price: 299,
      status: 'confirmed',
      paymentMethod: 'card',
      seatNumber: 'A12',
      purchaseDate: new Date().toISOString()
    },
    {
      _id: 'demo-ticket-2',
      ticketNumber: 'TKT-DEMO-002',
      eventId: {
        _id: 'demo-event-2',
        title: 'Summer Music Festival',
        date: '2024-06-20',
        time: '02:00 PM',
        location: {
          venue: 'Central Park',
          city: 'New York'
        },
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
        category: 'Concert'
      },
      price: 89,
      status: 'confirmed',
      paymentMethod: 'paypal',
      seatNumber: 'VIP-03',
      purchaseDate: new Date().toISOString()
    }
  ];
  
  res.json({
    success: true,
    count: demoTickets.length,
    data: demoTickets,
    demo_note: 'Demo tickets - no database'
  });
});

// 5. USER DASHBOARD (DEMO)

// Get user dashboard stats (DEMO)
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    data: {
      totalTickets: 2,
      upcomingEvents: 1,
      pastEvents: 1,
      totalSpent: 388,
      favoriteCategory: 'Conference'
    },
    demo_note: 'Demo statistics - no database'
  });
});

// 6. ADMIN ROUTES (DEMO)

// Get all users (admin only) - DEMO
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  const demoUsers = [
    {
      _id: 'demo-user-1',
      name: 'John Attendee',
      email: 'john@eventsphere.com',
      role: 'user',
      avatar: 'https://ui-avatars.com/api/?name=John+Attendee&background=6200ee&color=fff',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'demo-organizer-1',
      name: 'Event Organizer',
      email: 'organizer@eventsphere.com',
      role: 'organizer',
      avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff',
      createdAt: new Date().toISOString()
    },
    {
      _id: 'demo-admin-1',
      name: 'Admin User',
      email: 'admin@eventsphere.com',
      role: 'admin',
      avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=dc3545&color=fff',
      createdAt: new Date().toISOString()
    }
  ];
  
  res.json({
    success: true,
    count: demoUsers.length,
    data: demoUsers,
    demo_note: 'Demo users - no database'
  });
});

// 7. SEED DATABASE WITH ENHANCED DATA (DEMO VERSION - NO DATABASE)
app.post('/api/seed', async (req, res) => {
  // ⚠️ NO DATABASE OPERATIONS - Just return success
  console.log('📱 DEMO: Seed endpoint called (no database operations)');
  
  res.json({
    success: true,
    message: '✅ DEMO: Database seeded successfully! (No actual database)',
    data: {
      users: 3,
      events: 4,
      tickets: 2
    },
    demo_note: 'Demo mode - No database operations performed',
    demo_accounts: {
      user: { email: 'john@eventsphere.com', password: 'user123' },
      organizer: { email: 'organizer@eventsphere.com', password: 'organizer123' },
      admin: { email: 'admin@eventsphere.com', password: 'admin123' }
    }
  });
});

// ============ ERROR HANDLING ============
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'Demo mode error'
  });
});

// ============ START SERVER ============
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║     🚀 EventSphere DEMO Server Started!          ║
╠═══════════════════════════════════════════════════╣
║ 📍 Port:          ${PORT}                         ║
║ 🔗 URL:           http://localhost:${PORT}       ║
║ 📊 Health Check:  /api/health                    ║
║ 🛠️  Mode:         DEMO MODE                      ║
║ 📱 Database:      NONE (Demo Mode)              ║
╚═══════════════════════════════════════════════════╝
    `);
    console.log(`\n📱 DEMO ACCOUNTS:`);
    console.log(`   👤 User:      john@eventsphere.com / user123`);
    console.log(`   🎪 Organizer: organizer@eventsphere.com / organizer123`);
    console.log(`   👑 Admin:     admin@eventsphere.com / admin123`);
    console.log(`\n🔧 Seed Database (Demo): POST /api/seed`);
    console.log(`\n💡 Tip: This is DEMO MODE - No database required!`);
  });
}

module.exports = app;