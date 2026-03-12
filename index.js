const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.t2y7ypa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function run() {
  try {
    await client.connect();
    const db = client.db("service-hub-db");
    const bookingCollection = db.collection("booking");
    const usersCollection = db.collection("users");
    const paymentCollection = db.collection("payment");

    /* ---------------- ADMIN VERIFY ---------------- */

    const verifyAdmin = async (req, res, next) => {

      const email = req.query.email;

      if (!email) {
        return res.status(403).send({ message: "Unauthorized" });
      }

      const user = await usersCollection.findOne({ email });

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Admin only access" });
      }

      next();
    };

    /* ---------------- USER ROUTES ---------------- */

    // create user
    app.post('/users', async (req, res) => {

      const user = req.body;

      const existing = await usersCollection.findOne({ email: user.email });

      if (existing) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne({
        email: user.email,
        role: "user",
        createdAt: new Date()
      });

      res.send(result);
    });

    app.get('/users', verifyAdmin, async (req, res) => {
      try {

        const users = await usersCollection.find().toArray();

        res.send(users);

      } catch (error) {

        res.status(500).send({ message: "Server error" });

      }
    });

    // GET USER BY EMAIL
    app.get('/users/:email/role', async (req, res) => {

      try {

        const email = req.params.email;

        const user = await usersCollection.findOne({ email: email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(user);

      } catch (error) {

        res.status(500).send({ message: "Server error" });

      }

    });

    // DELETE USER BY EMAIL
    app.delete('/users/:email', async (req, res) => {

      try {

        const email = req.params.email;

        const result = await usersCollection.deleteOne({ email: email });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({
          success: true,
          message: "User deleted successfully"
        });

      } catch (error) {

        console.error(error);

        res.status(500).send({
          success: false,
          message: "Failed to delete user"
        });

      }

    });

    // make admin
    app.patch('/users/:email/admin', async (req, res) => {

      const email = req.params.email;



      const result = await usersCollection.updateOne(
        { email },
        { $set: { role: "admin" } }
      );

      res.send(result);
    });


    app.patch('/users/:email/user', async (req, res) => {

      const email = req.params.email;



      const result = await usersCollection.updateOne(
        { email },
        { $set: { role: "user" } }
      );

      res.send(result);
    });

    // ------------------------------
    // CREATE USER
    // ------------------------------
    app.post('/users', async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) return res.send({ message: "User already exists" });

      const result = await usersCollection.insertOne({ email: user.email, role: "user" });
      res.send(result);
    });

    // ------------------------------
    // CREATE BOOKING
    // ------------------------------
    app.post('/booking', async (req, res) => {
      try {
        const booking = req.body;
        booking.status = "pending";
        booking.payment_status = "unpaid";
        const result = await bookingCollection.insertOne(booking);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ message: "Booking failed" });
      }
    });

    app.patch('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const result = await bookingCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "completed" } });
      res.send(result);
    });

    // ------------------------------
    // GET USER BOOKINGS
    // ------------------------------
    app.get('/my-books/:email', async (req, res) => {
      const email = req.params.email;
      if (!email) return res.status(400).send({ message: "Email required" });

      try {
        const result = await bookingCollection
          .find({ userEmail: email })
          .sort({ _id: -1 })   // reverse order (newest first)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching bookings" });
      }
    });

    app.get('/my-books', async (req, res) => {
      try {

        const myBooks = await bookingCollection.find().toArray();

        res.send(myBooks);

      } catch (error) {

        res.status(500).send({ message: "Server error" });

      }
    });

    // ------------------------------
    // GET BOOKING BY ID
    // ------------------------------
    app.get('/data/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await bookingCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Booking not found" });
      }
    });

    // ------------------------------
    // STRIPE CHECKOUT
    // ------------------------------
    app.post('/create-checkout-session', async (req, res) => {
      try {
        const { price, serviceName, userEmail, bookingId } = req.body;

        const numericPrice = Number(price.toString().replace(/[^0-9.]/g, ''));
        if (!numericPrice || isNaN(numericPrice)) {
          return res.status(400).send({ message: "Invalid price format" });
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: serviceName },
              unit_amount: Math.round(numericPrice * 100)
            },
            quantity: 1
          }],
          customer_email: userEmail,
          metadata: { bookingId, serviceName },
          success_url: `${process.env.SITE_DOMAIN}/my-booking?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`
        });

        // Send session URL to frontend
        res.send({ url: session.url });

      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Stripe checkout failed" });
      }
    });

    // ------------------------------
    // STRIPE PAYMENT SUCCESS (Webhook alternative)
    // ------------------------------
    app.patch('/payment-success', async (req, res) => {
      try {
        const sessionId = req.query.session_id;
        if (!sessionId) return res.status(400).send({ message: "Session ID missing" });

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
          return res.status(400).send({ success: false, message: "Payment not completed" });
        }

        const bookingId = session.metadata?.bookingId;
        const serviceName = session.metadata?.serviceName;
        const transactionId = session.payment_intent;

        // Avoid duplicate payments
        const paymentExist = await paymentCollection.findOne({ transactionId });
        if (paymentExist) return res.send({ message: "Payment already exists", transactionId });

        // Update booking
        await bookingCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: { payment_status: 'paid' } }
        );

        // Insert payment record
        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          bookingId,
          serviceName,
          transactionId,
          paymentStatus: session.payment_status,
          paidAt: new Date()
        };

        await paymentCollection.insertOne(payment);

        // Send confirmation email

        console.log(session.customer_email);
        try {
          await transporter.sendMail({
            from: `"ServiceHub" <${process.env.EMAIL_USER}>`,
            to: session.customer_email,

            subject: 'Booking Confirmed',
            html: `
              <h2>Booking Confirmed</h2>
              <p>Thank you for your payment.</p>
              <ul>
                <li>Service: ${serviceName}</li>
                <li>Amount: ${(session.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()}</li>
                <li>Booking ID: ${bookingId}</li>
              </ul>
            `
          });
        } catch (mailError) {
          console.error("Email send failed:", mailError);
        }

        res.send({ success: true, payment, transactionId });

      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: error.message });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected");

  } finally {
    // Keep client open
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => res.send('Service Hub Server Running'));

// Server listen
app.listen(port, () => console.log(`Server running on port ${port}`));