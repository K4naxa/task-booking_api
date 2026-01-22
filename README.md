# Room Reservation API

A REST API for managing meeting room bookings built with NestJS, TypeScript, Prisma, and SQLite.

## 📋 Table of Contents

- [Requirements](#requirements)
- [Features](#features)
- [Setup](#setup)
  - [Local Development](#local-development)
  - [Docker](#docker)
- [API Documentation](#api-documentation)
  - [Rooms](#rooms)
  - [Bookings](#bookings)
- [Business Rules](#business-rules)
- [Error Codes](#error-codes)
- [Testing](#testing)

## 🔧 Requirements

- **Node.js**: v22 or higher
- **npm**: v9 or higher (comes with Node.js)
- **Docker** (optional, for containerized deployment)

## ✨ Features

- 10 pre-seeded meeting rooms (Room 1 - Room 10)
- Create bookings with time slot validation
- Cancel bookings with user authorization
- List bookings by user or room
- Filter bookings by status (confirmed/cancelled)
- Automatic overlap detection
- 10-minute time granularity enforcement
- UTC timezone support

## 🚀 Setup

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd booking_api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up the database**

   ```bash
   # Run migrations
   npx prisma migrate dev

   ```

4. **Start the development server**

   ```bash
   npm run start:dev
   ```

   The API will be available at `http://localhost:3000`

### Docker

1. **Start the application**

   ```bash
   docker-compose up -d
   ```

   This will:
   - Build the Docker image
   - Run database migrations
   - Seed 10 rooms
   - Start the API on port 3000

2. **Stop the application**

   ```bash
   docker-compose down
   ```

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

## 📚 API Documentation

### Base URL

```
http://localhost:3000
```

---

## Rooms

### Get All Rooms

Returns a list of all available rooms.

**Endpoint:** `GET /rooms`

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Room 1"
  },
  {
    "id": 2,
    "name": "Room 2"
  },
  ...
]
```

---

## Bookings

### Create Booking

Create a new booking for a room.

**Endpoint:** `POST /bookings`

**Request Body:**

```json
{
  "userId": "user123",
  "roomId": 1,
  "startTime": "2026-01-22T10:00:00.000Z",
  "endTime": "2026-01-22T11:00:00.000Z"
}
```

**Response:** `201 Created`

```json
{
  "id": 1,
  "userId": "user123",
  "roomId": 1,
  "startTime": "2026-01-22T10:00:00.000Z",
  "endTime": "2026-01-22T11:00:00.000Z",
  "status": "CONFIRMED",
  "cancelledAt": null,
  "createdAt": "2026-01-21T15:30:00.000Z",
  "updatedAt": "2026-01-21T15:30:00.000Z",
  "room": {
    "id": 1,
    "name": "Room 1"
  }
}
```

**Validation Rules:**

- `userId`: Alphanumeric characters only
- `roomId`: Must be a valid room ID (1-10)
- `startTime`: Must be in the future, aligned to 10-minute intervals
- `endTime`: Must be after startTime, aligned to 10-minute intervals
- Time slot must not overlap with existing CONFIRMED bookings

**Error Responses:**

`400 Bad Request` - Invalid time format or granularity

```json
{
  "statusCode": 400,
  "message": "startTime must align to 10-minute intervals (e.g., :00, :10, :20, :30, :40, :50) with no seconds or milliseconds",
  "error": "Bad Request"
}
```

`404 Not Found` - Room doesn't exist

```json
{
  "statusCode": 404,
  "message": "Room with id 99 not found",
  "error": "Not Found"
}
```

`409 Conflict` - Time slot already booked

```json
{
  "statusCode": 409,
  "message": "Time slot conflicts with existing booking",
  "error": "Conflict"
}
```

---

### Cancel Booking

Cancel an existing booking. Only the user who created the booking can cancel it.

**Endpoint:** `PATCH /bookings/:id/cancel`

**Request Body:**

```json
{
  "userId": "user123"
}
```

**Response:** `200 OK`

```json
{
  "id": 1,
  "userId": "user123",
  "roomId": 1,
  "startTime": "2026-01-22T10:00:00.000Z",
  "endTime": "2026-01-22T11:00:00.000Z",
  "status": "CANCELLED",
  "cancelledAt": "2026-01-21T16:00:00.000Z",
  "createdAt": "2026-01-21T15:30:00.000Z",
  "updatedAt": "2026-01-21T16:00:00.000Z",
  "room": {
    "id": 1,
    "name": "Room 1"
  }
}
```

**Error Responses:**

`400 Bad Request` - Booking has already started

```json
{
  "statusCode": 400,
  "message": "Cannot cancel a booking that has already started or is in the past",
  "error": "Bad Request"
}
```

`404 Not Found` - Booking not found or wrong user

```json
{
  "statusCode": 404,
  "message": "Booking with id 1 not found",
  "error": "Not Found"
}
```

`409 Conflict` - Already cancelled

```json
{
  "statusCode": 409,
  "message": "Booking is already cancelled",
  "error": "Conflict"
}
```

---

### Get User Bookings

Get all bookings for a specific user (both confirmed and cancelled).

**Endpoint:** `GET /bookings/user/:userId`

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "userId": "user123",
    "roomId": 1,
    "startTime": "2026-01-22T10:00:00.000Z",
    "endTime": "2026-01-22T11:00:00.000Z",
    "status": "CONFIRMED",
    "cancelledAt": null,
    "createdAt": "2026-01-21T15:30:00.000Z",
    "updatedAt": "2026-01-21T15:30:00.000Z",
    "room": {
      "id": 1,
      "name": "Room 1"
    }
  },
  {
    "id": 2,
    "userId": "user123",
    "roomId": 2,
    "startTime": "2026-01-23T14:00:00.000Z",
    "endTime": "2026-01-23T15:30:00.000Z",
    "status": "CANCELLED",
    "cancelledAt": "2026-01-21T16:30:00.000Z",
    "createdAt": "2026-01-21T16:00:00.000Z",
    "updatedAt": "2026-01-21T16:30:00.000Z",
    "room": {
      "id": 2,
      "name": "Room 2"
    }
  }
]
```

**Notes:**

- Returns empty array `[]` if no bookings found
- Results ordered by `startTime` ascending
- `userId` must be alphanumeric

**Error Responses:**

`400 Bad Request` - Invalid userId format

```json
{
  "statusCode": 400,
  "message": "userId must contain only alphanumeric characters",
  "error": "Bad Request"
}
```

---

### Get Room Bookings (All)

Get all bookings for a specific room, including both confirmed and cancelled.

**Endpoint:** `GET /bookings/room/:roomId`

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "userId": "user123",
    "roomId": 1,
    "startTime": "2026-01-22T10:00:00.000Z",
    "endTime": "2026-01-22T11:00:00.000Z",
    "status": "CONFIRMED",
    "cancelledAt": null,
    "createdAt": "2026-01-21T15:30:00.000Z",
    "updatedAt": "2026-01-21T15:30:00.000Z",
    "room": {
      "id": 1,
      "name": "Room 1"
    }
  }
]
```

**Notes:**

- Returns empty array `[]` if no bookings found
- Results ordered by `startTime` ascending

**Error Responses:**

`404 Not Found` - Room doesn't exist

```json
{
  "statusCode": 404,
  "message": "Room with id 99 not found",
  "error": "Not Found"
}
```

---

### Get Room Bookings (Confirmed Only)

Get only confirmed bookings for a specific room.

**Endpoint:** `GET /bookings/room/:roomId/confirmed`

**Response:** `200 OK`

```json
[
  {
    "id": 1,
    "userId": "user123",
    "roomId": 1,
    "startTime": "2026-01-22T10:00:00.000Z",
    "endTime": "2026-01-22T11:00:00.000Z",
    "status": "CONFIRMED",
    "cancelledAt": null,
    "createdAt": "2026-01-21T15:30:00.000Z",
    "updatedAt": "2026-01-21T15:30:00.000Z",
    "room": {
      "id": 1,
      "name": "Room 1"
    }
  }
]
```

**Notes:**

- Only returns bookings with `status: "CONFIRMED"`
- Returns empty array `[]` if no confirmed bookings found
- Results ordered by `startTime` ascending

---

### Get Room Bookings (Cancelled Only)

Get only cancelled bookings for a specific room.

**Endpoint:** `GET /bookings/room/:roomId/cancelled`

**Response:** `200 OK`

```json
[
  {
    "id": 2,
    "userId": "user456",
    "roomId": 1,
    "startTime": "2026-01-23T14:00:00.000Z",
    "endTime": "2026-01-23T15:00:00.000Z",
    "status": "CANCELLED",
    "cancelledAt": "2026-01-21T16:00:00.000Z",
    "createdAt": "2026-01-21T15:00:00.000Z",
    "updatedAt": "2026-01-21T16:00:00.000Z",
    "room": {
      "id": 1,
      "name": "Room 1"
    }
  }
]
```

**Notes:**

- Only returns bookings with `status: "CANCELLED"`
- Returns empty array `[]` if no cancelled bookings found
- Results ordered by `startTime` ascending

---

## 📖 Business Rules

### Time Rules

- **Format:** All times must be in UTC ISO 8601 format
- **Granularity:** Times must align to 10-minute intervals (`:00`, `:10`, `:20`, `:30`, `:40`, `:50`)
- **No Seconds/Milliseconds:** Times must have zero seconds and milliseconds
- **Future Bookings:** `startTime` must be in the future
- **Duration:** `startTime` must be before `endTime`

**Valid Time Examples:**

```
2026-01-22T10:00:00.000Z  ✓
2026-01-22T10:30:00.000Z  ✓
2026-01-22T14:20:00.000Z  ✓
```

**Invalid Time Examples:**

```
2026-01-22T10:15:00.000Z  ✗ (not 10-minute interval)
2026-01-22T10:00:30.000Z  ✗ (has seconds)
2026-01-22T10:00:00.123Z  ✗ (has milliseconds)
```

### Booking Rules

- **No Overlaps:** A room cannot have overlapping CONFIRMED bookings
- **Cancelled Ignored:** Cancelled bookings don't block time slots
- **Status Transitions:** Bookings can only transition from CONFIRMED → CANCELLED
- **No Double Cancel:** Cannot cancel an already cancelled booking
- **Authorization:** Users can only cancel their own bookings

### Room Rules

- **Fixed Count:** Exactly 10 rooms exist (Room 1 through Room 10)
- **Read-Only:** Rooms cannot be created, updated, or deleted
- **Auto-Seeded:** Rooms are automatically created via seed script

### Authorization Rules

- **No Authentication:** No authentication system required
- **Simple userId:** User identification via string parameter
- **Self-Service:** Users can only cancel their own bookings (verified by userId match)

---

## 🚨 Error Codes

| Status Code       | Description        | When It Occurs                                                                                 |
| ----------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `400 Bad Request` | Validation failed  | Past time, invalid granularity, startTime >= endTime, invalid format, booking in past (cancel) |
| `404 Not Found`   | Resource not found | Room doesn't exist, booking not found, wrong userId for cancellation                           |
| `409 Conflict`    | Resource conflict  | Time slot already booked, booking already cancelled                                            |

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test -- rooms.controller.spec
npm test -- bookings.controller.spec
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Test Coverage

```bash
npm run test:cov
```

### Current Test Coverage

- **35 tests** across all endpoints
- Tests use real database (SQLite) for full integration testing
- Validation, business logic, and error handling fully covered

---

## 🗄️ Database Schema

### Room

```prisma
model Room {
  id       Int       @id @default(autoincrement())
  name     String
  bookings Booking[]
}
```

### Booking

```prisma
model Booking {
  id          Int           @id @default(autoincrement())
  userId      String
  roomId      Int
  room        Room          @relation(fields: [roomId], references: [id])
  startTime   DateTime
  endTime     DateTime
  status      BookingStatus
  cancelledAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}
```

### BookingStatus Enum

```prisma
enum BookingStatus {
  CONFIRMED
  CANCELLED
}
```

---

## 🔧 Development Commands

```bash
# Start development server with hot reload
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run linter
npm run lint

# Format code
npm run format

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name <migration-name>

# Reset database and reseed
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## 📝 Notes

- The API uses SQLite for simplicity and portability
- In Docker, the database is ephemeral (not persisted between restarts)
- Each Docker container start creates a fresh database with 10 seeded rooms
- All timestamps are stored and returned in UTC
- Validation is performed at both DTO and service layers

---

## 🤝 Contributing

1. Ensure all tests pass before committing
2. Follow the existing code style (use `npm run format`)
3. Add tests for new features
4. Update this README for API changes

---

## 📄 License

This project is part of a coding assessment.
