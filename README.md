# Backend API

This backend now supports separate student and teacher logins with role-based access control.

## Security

- Passwords are stored as bcrypt hashes.
- Login returns a signed JWT bearer token.
- Protected routes require an `Authorization: Bearer <token>` header.
- Users, courses, and enrollments are stored in a local SQLite database file.
- Set `JWT_SECRET` in your environment for production.
- Use HTTPS in production so data stays encrypted in transit.

## Data Storage

- SQLite file: `database.sqlite`
- Schema is created automatically when the server starts.
- Starter student, teacher, and course data are seeded only if the tables are empty.
- Data now survives server restarts.

## Demo Accounts

- Student: `student1` / `StudentPass123!`
- Teacher: `teacher1` / `TeacherPass123!`

## Auth Endpoints

### `POST /auth/login`

Request body:

```json
{
  "username": "student1",
  "password": "StudentPass123!"
}
```

Response:

```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": {
    "id": "student-1001",
    "username": "student1",
    "role": "student",
    "name": "Student One",
    "enrolledCourses": []
  }
}
```

### `GET /auth/me`

Returns the logged-in user profile from the bearer token.

## Course Endpoints

### `GET /courses`

- Student response includes `enrolled`, `enrolledCount`, and `availableSeats`.
- Teacher response also includes the `students` roster for each course.

### `POST /enroll`

- Student only
- Body:

```json
{
  "courseCode": "WEB-220"
}
```

### `POST /drop`

- Student only
- Body:

```json
{
  "courseCode": "WEB-220"
}
```

### `POST /courses`

- Teacher only
- Create a class

### `PUT /courses/:code`

- Teacher only
- Edit a class

### `DELETE /courses/:code`

- Teacher only
- Remove a class

## Frontend Notes

- Log in once, store the returned JWT, and send it in the `Authorization` header.
- Use `user.role` to decide which screens and actions to show.
- Students should only call enroll/drop endpoints.
- Teachers should only call create/update/delete course endpoints.
- The frontend can rely on course, enrollment, and account data remaining available after a backend restart.
