## ServiceHub Server

ServiceHub Server is a Node.js/Express backend for a service booking platform.  
It handles user management, service bookings, payments via Stripe, and email notifications to users.

---

### Features

- **User management**
  - Create users with a default `user` role
  - Promote or demote users between `user` and `admin` roles

- **Booking management**
  - Create new bookings
  - List all bookings (admin)
  - List bookings for a specific user (`/my-books/:email`)
  - Update booking status (for example, pending → approved)
  - Delete bookings

- **Stripe payments**
  - Create Stripe Checkout sessions
  - Mark bookings as `paid` after successful checkout

- **Email notifications**
  - Send confirmation emails after successful payments
  - Uses Nodemailer with SMTP (configurable via `.env`)

---

### Tech Stack

- **Runtime**: Node.js  
- **Framework**: Express  
- **Database**: MongoDB (Atlas)  
- **Payments**: Stripe Checkout  
- **Mail**: Nodemailer (SMTP)

---

### Getting Started

#### 1. Clone the repository

```bash
git clone <your-repo-url>
cd FixNow-server
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000

DB_NAME=<your-mongodb-username>
DB_PASSWORD=<your-mongodb-password>

STRIPE_KEY=<your-stripe-secret-key>
SITE_DOMAIN=<your-frontend-domain-eg-https://yourapp.com>

EMAIL_HOST=<smtp-host>
EMAIL_PORT=587
EMAIL_USER=<smtp-username-or-email>
EMAIL_PASS=<smtp-password-or-app-password>
```

Make sure your MongoDB connection string in `index.js` matches your Atlas credentials.

#### 4. Run the server

```bash
npm start
# or
node index.js
```

By default the server runs on `http://localhost:3000` (or the port you set in `.env`).

---

### Main API Endpoints

#### Health check

- **GET** `/`  
  Returns a simple `"Service Hub Server Running"` message.

#### Users

- **POST** `/users`  
  **Body**: `{ "email": "user@example.com" }`  
  Creates a new user with role `user` (if not already existing).

- **PATCH** `/users/:email`  
  **Body**: `{ "role": "admin" | "user" }`  
  Updates the user’s role.

#### Bookings

- **POST** `/booking`  
  **Body**: booking object from frontend  
  Creates a new booking with default:
  - `status: "pending"`
  - `payment_status: "unpaid"`

- **GET** `/booking`  
  Returns all bookings (for admin usage).

- **GET** `/my-books/:email`  
  Returns bookings for a specific user, sorted with newest first.

- **PATCH** `/booking/:id`  
  **Body**: `{ "status": "<new-status>" }`  
  Updates the status of a booking.

- **DELETE** `/booking/:id`  
  Deletes a booking by its ID.

- **GET** `/data/:id`  
  Fetches a single booking by its ID.

#### Payments

- **POST** `/create-checkout-session`  
  **Body**:

  ```json
  {
    "price": "From $39",
    "serviceName": "AC Repair",
    "userEmail": "user@example.com",
    "bookingId": "<booking-id>"
  }
  ```

  Creates a Stripe Checkout session and returns:

  ```json
  { "url": "<stripe-checkout-url>" }
  ```

  Also:
  - Marks the `booking` document as `payment_status: "paid"` after session creation  
  - Sends a confirmation email to `userEmail`

---

### Project Structure (simplified)

```text
FixNow-server/
├─ index.js        # Main Express server and routes
├─ package.json
├─ package-lock.json
├─ .env            # Environment variables (not committed)
└─ README.md
```

---

### Contributing

Pull requests and suggestions are welcome.  
If you find a bug or have an idea to improve the API, feel free to open an issue or a PR.

---

### License

This project is currently unlicensed by default.  
Add your preferred license here (for example, MIT) if you want others to reuse it.

