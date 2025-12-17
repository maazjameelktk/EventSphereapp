const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ YOUR MONGODB ATLAS CONNECTION STRING
const MONGODB_URI = 'mongodb+srv://maazkhattak155_db_user:Maaz12345@cluster0.a59mn8k.mongodb.net/eventsphere?retryWrites=true&w=majority';
const JWT_SECRET = 'eventsphere-secret-key-2024-maaz-khattak';

// Connect to MongoDB Atlas
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
    console.log('📊 Database: eventsphere');
  })
  .catch(err => {
    console.log('❌ MongoDB Connection Error:', err.message);
  });

// ============ ENHANCED SCHEMAS ============
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, default: '18:00' },
  location: { 
    venue: String,
    address: String,
    city: String,
    country: String
  },
  category: { 
    type: String, 
    enum: ['Conference', 'Workshop', 'Concert', 'Networking', 'Exhibition', 'Other'],
    default: 'Other'
  },
  price: { type: Number, default: 0 },
  capacity: { type: Number, default: 100 },
  attendees: { type: Number, default: 0 },
  imageUrl: { type: String },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  avatar: { type: String },
  role: { type: String, enum: ['user', 'organizer', 'admin'], default: 'user' },
  registeredEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  createdAt: { type: Date, default: Date.now }
});

const TicketSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ticketNumber: { type: String, unique: true },
  purchaseDate: { type: Date, default: Date.now },
  price: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'used'], default: 'pending' },
  paymentMethod: { type: String, enum: ['card', 'paypal', 'cash'], default: 'card' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  qrCode: { type: String },
  seatNumber: { type: String }
});

// Create Models
const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);

// ============ MIDDLEWARE ============
const logRequest = (req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
};
app.use(logRequest);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required. Please login first.' 
    });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid or expired token. Please login again.' 
      });
    }
    req.user = user;
    next();
  });
};

// Admin Middleware
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  next();
};

// Organizer Middleware
const isOrganizer = (req, res, next) => {
  if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Organizer access required' 
    });
  }
  next();
};

// ============ API ROUTES ============

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    message: 'Eventsphere API v2.0 is running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    version: '2.0'
  });
});

// 2. AUTHENTICATION ROUTES

// Register with password hashing
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
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone: phone || '',
      role: role || 'user',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6200ee&color=fff`
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        name: user.name,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        name: user.name,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('registeredEvents', 'title date location imageUrl');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { name, phone, avatar },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 3. EVENTS ROUTES

// Get all events with filters
app.get('/api/events', async (req, res) => {
  try {
    const { category, search, sort = 'date', page = 1, limit = 10 } = req.query;
    const query = {};
    
    // Apply filters
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.venue': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Sorting
    const sortOptions = {
      date: { date: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
      popular: { attendees: -1 }
    };
    
    const events = await Event.find(query)
      .sort(sortOptions[sort] || { date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('organizer', 'name email avatar');
    
    const total = await Event.countDocuments(query);
    
    res.json({
      success: true,
      count: events.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: events
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get single event with details
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email avatar')
      .populate('attendees', 'name email avatar');
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create event (organizer only)
app.post('/api/events', authenticateToken, isOrganizer, async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      organizer: req.user.userId,
      imageUrl: req.body.imageUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'
    };
    
    const event = new Event(eventData);
    await event.save();
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update event (organizer only)
app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    // Check if user is organizer or admin
    if (event.organizer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this event' 
      });
    }
    
    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      message: 'Event updated successfully',
      data: updatedEvent
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete event (organizer or admin)
app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    // Check authorization
    if (event.organizer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this event' 
      });
    }
    
    await event.deleteOne();
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get events by organizer
app.get('/api/events/organizer/:organizerId', async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.params.organizerId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 4. TICKET & BOOKING SYSTEM

// Book ticket with payment simulation
app.post('/api/tickets/book', authenticateToken, async (req, res) => {
  try {
    const { eventId, paymentMethod = 'card', seatNumber } = req.body;
    const userId = req.user.userId;
    
    // Get event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    // Check capacity
    if (event.attendees >= event.capacity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event is full. No tickets available.' 
      });
    }
    
    // Check if user already booked
    const existingTicket = await Ticket.findOne({ eventId, userId, status: { $in: ['pending', 'confirmed'] } });
    if (existingTicket) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already booked a ticket for this event' 
      });
    }
    
    // Simulate payment (90% success rate)
    const paymentSuccess = Math.random() > 0.1;
    
    if (!paymentSuccess) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment failed. Please try again or use a different payment method.' 
      });
    }
    
    // Generate ticket number
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Create QR code URL
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`Event: ${event.title}\nTicket: ${ticketNumber}\nDate: ${event.date}\nVenue: ${event.location.venue}`)}`;
    
    // Create ticket
    const ticket = new Ticket({
      eventId,
      userId,
      ticketNumber,
      price: event.price,
      paymentMethod,
      paymentStatus: 'completed',
      status: 'confirmed',
      qrCode,
      seatNumber: seatNumber || `A${Math.floor(Math.random() * 50) + 1}`
    });
    
    await ticket.save();
    
    // Update event attendees
    event.attendees += 1;
    await event.save();
    
    // Add to user's registered events
    await User.findByIdAndUpdate(userId, {
      $addToSet: { registeredEvents: eventId }
    });
    
    // Get ticket with event details
    const ticketWithDetails = await Ticket.findById(ticket._id)
      .populate('eventId', 'title date time location imageUrl')
      .populate('userId', 'name email');
    
    res.status(201).json({
      success: true,
      message: '🎉 Ticket booked successfully!',
      data: {
        ticket: ticketWithDetails,
        receipt: {
          transactionId: `TRX-${Date.now()}`,
          amount: event.price,
          paymentMethod,
          status: 'completed',
          date: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get user tickets
app.get('/api/tickets/my-tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.userId })
      .populate('eventId', 'title date time location imageUrl category')
      .sort({ purchaseDate: -1 });
    
    res.json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get ticket details - FIXED VERSION
app.get('/api/tickets/:ticketNumber', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber })
      .populate('eventId', 'title date time location venue address city imageUrl')
      .populate('userId', 'name email avatar');
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }
    
    // Check if user owns this ticket or is admin
    // FIX: Handle case where userId might not be populated properly
    const ticketUserId = ticket.userId ? 
      (ticket.userId._id ? ticket.userId._id.toString() : ticket.userId.toString()) : 
      null;
    
    const requestUserId = req.user.userId.toString();
    
    if (ticketUserId !== requestUserId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this ticket' 
      });
    }
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Ticket details error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Cancel ticket
app.post('/api/tickets/:ticketNumber/cancel', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber })
      .populate('eventId');
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }
    
    // Check if user owns this ticket
    if (ticket.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to cancel this ticket' 
      });
    }
    
    // Check if event has already passed
    const eventDate = new Date(ticket.eventId.date);
    if (eventDate < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel ticket for past events' 
      });
    }
    
    // Update ticket status
    ticket.status = 'cancelled';
    ticket.paymentStatus = 'refunded';
    await ticket.save();
    
    // Update event attendees count
    await Event.findByIdAndUpdate(ticket.eventId._id, {
      $inc: { attendees: -1 }
    });
    
    res.json({
      success: true,
      message: 'Ticket cancelled successfully. Refund initiated.',
      data: ticket
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 5. USER DASHBOARD - FIXED VERSION

// Get user dashboard stats - SIMPLE FIXED VERSION
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Simple counts without complex aggregation
    const totalTickets = await Ticket.countDocuments({ userId: userId, status: 'confirmed' });
    
    // Get all tickets with event details
    const tickets = await Ticket.find({ userId: userId, status: 'confirmed' })
      .populate('eventId', 'date price category');
    
    let totalSpent = 0;
    let upcomingEvents = 0;
    let pastEvents = 0;
    const now = new Date().toISOString().split('T')[0];
    
    // Calculate stats manually
    tickets.forEach(ticket => {
      totalSpent += ticket.price || 0;
      if (ticket.eventId && ticket.eventId.date) {
        if (ticket.eventId.date >= now) {
          upcomingEvents++;
        } else {
          pastEvents++;
        }
      }
    });
    
    // Find favorite category
    const categoryCount = {};
    tickets.forEach(ticket => {
      if (ticket.eventId && ticket.eventId.category) {
        categoryCount[ticket.eventId.category] = (categoryCount[ticket.eventId.category] || 0) + 1;
      }
    });
    
    let favoriteCategory = 'None';
    let maxCount = 0;
    for (const [category, count] of Object.entries(categoryCount)) {
      if (count > maxCount) {
        maxCount = count;
        favoriteCategory = category;
      }
    }
    
    res.json({
      success: true,
      data: {
        totalTickets,
        upcomingEvents,
        pastEvents,
        totalSpent,
        favoriteCategory: favoriteCategory === 'None' ? 'Not enough data' : favoriteCategory
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 6. ADMIN ROUTES

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all tickets (admin only)
app.get('/api/admin/tickets', authenticateToken, isAdmin, async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('eventId', 'title date')
      .populate('userId', 'name email')
      .sort({ purchaseDate: -1 });
    
    res.json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 7. SEED DATABASE WITH ENHANCED DATA
app.post('/api/seed', async (req, res) => {
  try {
    // Clear existing data
    await Event.deleteMany({});
    await User.deleteMany({});
    await Ticket.deleteMany({});
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@eventsphere.com',
      password: hashedPassword,
      role: 'admin',
      avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=dc3545&color=fff'
    });
    await adminUser.save();
    
    // Create organizer user
    const organizerPassword = await bcrypt.hash('organizer123', 10);
    const organizerUser = new User({
      name: 'Event Organizer',
      email: 'organizer@eventsphere.com',
      password: organizerPassword,
      role: 'organizer',
      phone: '+1234567890',
      avatar: 'https://ui-avatars.com/api/?name=Event+Organizer&background=198754&color=fff'
    });
    await organizerUser.save();
    
    // Create regular user
    const userPassword = await bcrypt.hash('user123', 10);
    const regularUser = new User({
      name: 'John Attendee',
      email: 'john@eventsphere.com',
      password: userPassword,
      role: 'user',
      phone: '+0987654321',
      avatar: 'https://ui-avatars.com/api/?name=John+Attendee&background=6200ee&color=fff'
    });
    await regularUser.save();
    
    // Create sample events
    const sampleEvents = [
      {
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
        organizer: organizerUser._id
      },
      {
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
        organizer: organizerUser._id
      },
      {
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
        organizer: organizerUser._id
      },
      {
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
        organizer: organizerUser._id
      }
    ];
    
    const events = await Event.insertMany(sampleEvents);
    
    // Create sample tickets
    const sampleTickets = [
      {
        eventId: events[0]._id,
        userId: regularUser._id,
        ticketNumber: `TKT-${Date.now()}-001`,
        price: events[0].price,
        status: 'confirmed',
        paymentMethod: 'card',
        paymentStatus: 'completed',
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TKT-001`,
        seatNumber: 'A12'
      },
      {
        eventId: events[1]._id,
        userId: regularUser._id,
        ticketNumber: `TKT-${Date.now()}-002`,
        price: events[1].price,
        status: 'confirmed',
        paymentMethod: 'paypal',
        paymentStatus: 'completed',
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TKT-002`,
        seatNumber: 'VIP-03'
      }
    ];
    
    await Ticket.insertMany(sampleTickets);
    
    res.json({
      success: true,
      message: 'Database seeded successfully with enhanced data!',
      data: {
        users: 3,
        events: events.length,
        tickets: sampleTickets.length
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
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
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Eventsphere Server v2.0 running on port ${PORT}`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 JWT Authentication Enabled`);
  console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Connecting...'}`);
  console.log(`\n📋 Available Routes:`);
  console.log(`   POST   /api/auth/register     - Register user`);
  console.log(`   POST   /api/auth/login        - Login user`);
  console.log(`   GET    /api/auth/me           - Get profile (Auth required)`);
  console.log(`   GET    /api/events            - Get all events`);
  console.log(`   POST   /api/events            - Create event (Organizer)`);
  console.log(`   POST   /api/tickets/book      - Book ticket (Auth required)`);
  console.log(`   GET    /api/tickets/my-tickets- Get user tickets (Auth required)`);
  console.log(`   POST   /api/seed              - Seed database with sample data`);
});